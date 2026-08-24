#!/usr/bin/env python3
"""Local-only content editor server for the portfolio website."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


CONTENT_PREFIX = "window.PORTFOLIO_CONTENT = "
ALLOWED_UPLOADS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4"}
MAX_CONTENT_BYTES = 8 * 1024 * 1024
MAX_UPLOAD_BYTES = 30 * 1024 * 1024
WRITE_LOCK = threading.Lock()


def inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def read_content(root: Path) -> dict:
    source = (root / "content" / "site-content.js").read_text(encoding="utf-8").strip()
    if not source.startswith(CONTENT_PREFIX) or not source.endswith(";"):
        raise ValueError("site-content.js 格式不正确")
    return json.loads(source[len(CONTENT_PREFIX):-1])


def validate_content(content: object) -> dict:
    if not isinstance(content, dict):
        raise ValueError("内容必须是一个完整对象")
    if not isinstance(content.get("site"), dict) or not isinstance(content.get("pages"), dict):
        raise ValueError("缺少 site 或 pages")
    pages = content["pages"]
    missing = [name for name in ("home", "works", "resume", "contact") if not isinstance(pages.get(name), dict)]
    if missing:
        raise ValueError("缺少页面：" + "、".join(missing))
    projects = pages["works"].get("projects")
    if not isinstance(projects, list):
        raise ValueError("作品项目必须是列表")
    project_ids = [str(project.get("id", "")) for project in projects if isinstance(project, dict)]
    if any(not re.fullmatch(r"[a-z0-9][a-z0-9-]*", item) for item in project_ids):
        raise ValueError("项目识别名只能使用英文小写、数字和短横线")
    if len(project_ids) != len(set(project_ids)):
        raise ValueError("项目识别名不能重复")
    for project in projects:
        items = project.get("items", [])
        if not isinstance(items, list):
            raise ValueError(f"项目 {project.get('id')} 的作品列表格式不正确")
        ids = [str(item.get("id", "")) for item in items if isinstance(item, dict)]
        if any(not re.fullmatch(r"[a-z0-9][a-z0-9-]*", item) for item in ids):
            raise ValueError(f"项目 {project.get('id')} 中的作品识别名格式不正确")
        if len(ids) != len(set(ids)):
            raise ValueError(f"项目 {project.get('id')} 中存在重复的作品识别名")
    return content


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class EditorHandler(SimpleHTTPRequestHandler):
    server_version = "PortfolioEditor/1.0"

    def __init__(self, *args, directory: str, **kwargs):
        self.root = Path(directory).resolve()
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format_string: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def json_response(self, status: HTTPStatus, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, maximum: int) -> bytes:
        raw_length = self.headers.get("Content-Length")
        if not raw_length or not raw_length.isdigit():
            raise ValueError("请求缺少有效的文件大小")
        length = int(raw_length)
        if length > maximum:
            raise OverflowError("文件过大")
        return self.rfile.read(length)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.json_response(HTTPStatus.OK, {"ok": True})
            return
        if parsed.path == "/api/content":
            try:
                self.json_response(HTTPStatus.OK, read_content(self.root))
            except Exception as error:  # local tool: surface a useful message
                self.json_response(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/content":
                self.save_content()
                return
            if parsed.path == "/api/upload":
                self.save_upload(parse_qs(parsed.query))
                return
            self.json_response(HTTPStatus.NOT_FOUND, {"error": "接口不存在"})
        except OverflowError as error:
            self.json_response(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": str(error)})
        except (ValueError, json.JSONDecodeError) as error:
            self.json_response(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:  # local tool: preserve content and report failure
            self.json_response(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"操作失败：{error}"})

    def save_content(self) -> None:
        if "application/json" not in self.headers.get("Content-Type", ""):
            raise ValueError("保存内容必须是 JSON")
        content = validate_content(json.loads(self.read_body(MAX_CONTENT_BYTES).decode("utf-8")))
        content_path = (self.root / "content" / "site-content.js").resolve()
        if not inside(content_path, self.root):
            raise ValueError("内容路径超出网站目录")
        stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}"
        backup_path = self.root / "content" / "backups" / f"site-content-{stamp}.json"
        encoded_json = json.dumps(content, ensure_ascii=False, indent=2)
        encoded_js = f"{CONTENT_PREFIX}{encoded_json};\n".encode("utf-8")
        with WRITE_LOCK:
            previous = read_content(self.root)
            atomic_write(backup_path, (json.dumps(previous, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
            atomic_write(content_path, encoded_js)
        self.json_response(HTTPStatus.OK, {"ok": True, "backup": backup_path.name})

    def save_upload(self, query: dict[str, list[str]]) -> None:
        project = unquote(query.get("project", ["site"])[0]).lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", project):
            project = "site"
        original = Path(unquote(query.get("filename", ["asset"])[0])).name
        suffix = Path(original).suffix.lower()
        if suffix not in ALLOWED_UPLOADS:
            raise ValueError("仅支持 PNG、JPG、GIF、WebP、SVG 和 MP4")
        stem = re.sub(r"[^\w.-]+", "-", Path(original).stem, flags=re.UNICODE).strip(".-") or "asset"
        filename = f"{int(time.time() * 1000)}-{stem[:80]}{suffix}"
        target = (self.root / "assets" / "uploads" / project / filename).resolve()
        if not inside(target, self.root / "assets" / "uploads"):
            raise ValueError("上传路径不安全")
        body = self.read_body(MAX_UPLOAD_BYTES)
        with WRITE_LOCK:
            atomic_write(target, body)
        relative = target.relative_to(self.root).as_posix()
        self.json_response(HTTPStatus.CREATED, {"ok": True, "path": f"./{relative}"})


def main() -> None:
    parser = argparse.ArgumentParser(description="在本机运行作品集内容编辑器")
    parser.add_argument("--host", default="127.0.0.1", help="默认只允许本机访问")
    parser.add_argument("--port", type=int, default=4175)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="网站目录")
    parser.add_argument("--open", action="store_true", help="启动后打开编辑器")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    required = root / "content" / "site-content.js"
    if not required.is_file():
        raise SystemExit(f"找不到内容文件：{required}")

    handler = lambda *args, **kwargs: EditorHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer((arguments.host, arguments.port), handler)
    url = f"http://{arguments.host}:{arguments.port}/editor/"
    print("作品集内容编辑器已启动：")
    print(url)
    print("请保持此窗口开启；编辑结束后按 Ctrl+C 关闭。")
    if arguments.open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n编辑器已关闭。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
