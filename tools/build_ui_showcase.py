from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


UNITY_ROOT = Path(r"E:\Eggisland\eggisland0126")
WEBSITE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = WEBSITE_ROOT / "assets" / "project" / "ui"

INK = "#20251c"
PAPER = "#e9e6c9"
DARK = "#10170f"
ACCENT = "#a23f2e"
MUTED = "#777861"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(str(Path(r"C:\Windows\Fonts") / name), size)


def open_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_nearest(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    width, height = box
    scale = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.NEAREST)


def paste_center(canvas: Image.Image, image: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    fitted = fit_nearest(image, (x1 - x0, y1 - y0))
    x = x0 + (x1 - x0 - fitted.width) // 2
    y = y0 + (y1 - y0 - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)


def referenced_icons() -> list[Path]:
    assets = UNITY_ROOT / "Assets"
    guid_to_png: dict[str, Path] = {}
    for meta in assets.rglob("*.png.meta"):
        match = re.search(r"^guid:\s*(\w+)", meta.read_text(encoding="utf-8", errors="ignore"), re.M)
        if match:
            guid_to_png[match.group(1)] = Path(str(meta)[:-5])

    references: Counter[str] = Counter()
    for pattern in ("*.prefab", "*.unity", "*.asset", "*.mat", "*.anim", "*.controller"):
        for source in assets.rglob(pattern):
            text = source.read_text(encoding="utf-8", errors="ignore")
            references.update(re.findall(r"guid:\s*([0-9a-f]{32})", text))

    result = []
    for guid, path in guid_to_png.items():
        normalized = path.as_posix().lower()
        is_icon = any(
            marker in normalized
            for marker in ("/ui/art/icon/", "/crops/art/hudicon/", "/ui/art/sprites/egg/")
        )
        if is_icon and references[guid] > 0:
            result.append(path)
    return sorted(result, key=lambda path: path.as_posix().lower())


def classify_icon(path: Path) -> str:
    normalized = path.as_posix().lower()
    stem = path.stem.lower()
    if "/geneicon/" in normalized or "基因" in stem:
        if "budgerigar" in normalized:
            return "gene_budgie"
        if "cockatiel" in normalized:
            return "gene_cockatiel"
        if "lovebird" in normalized:
            return "gene_lovebird"
        if "sunconure" in normalized:
            return "gene_sunconure"
        if "gouldianfinch" in normalized:
            return "gene_gouldian"
        return "gene_common"
    if "/crops/art/hudicon/" in normalized:
        return "crop"
    if "/筛选icon/" in normalized:
        return "filter"
    if (
        "/ui/art/sprites/egg/" in normalized
        or "egg" in stem
        or "蛋壳" in stem
    ):
        return "egg"
    status_markers = (
        "health", "hunger", "hungry", "happy", "sad", "unhappy", "grow", "feel",
        "warning", "unhealthy", "progress", "unlock", "jindutiao", "zhuangtai",
        "成鸟", "雏鸟", "雄icon", "雌icon", "进度条",
    )
    if any(marker in stem for marker in status_markers):
        return "status"
    return "action"


def draw_icon_panel(
    canvas: Image.Image,
    title: str,
    paths: list[Path],
    box: tuple[int, int, int, int],
    columns: int,
    icon_size: int,
) -> None:
    draw = ImageDraw.Draw(canvas)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=14, fill="#171e15", outline="#4a5140", width=2)
    draw.text((x0 + 18, y0 + 12), title, font=font(22, True), fill="#f0edd4")
    draw.text((x1 - 18, y0 + 14), f"{len(paths):02d}", font=font(18, True), fill="#c05b45", anchor="ra")
    grid_top = y0 + 50
    rows = max(1, (len(paths) + columns - 1) // columns)
    cell_w = (x1 - x0 - 24) / columns
    cell_h = (y1 - grid_top - 12) / rows
    for index, path in enumerate(paths):
        col, row = index % columns, index // columns
        cx = round(x0 + 12 + (col + 0.5) * cell_w)
        cy = round(grid_top + (row + 0.5) * cell_h)
        image = fit_nearest(open_rgba(path), (icon_size, icon_size))
        canvas.paste(image, (cx - image.width // 2, cy - image.height // 2), image)


def build_icon_matrix() -> None:
    paths = referenced_icons()
    groups: dict[str, list[Path]] = {}
    for path in paths:
        groups.setdefault(classify_icon(path), []).append(path)

    canvas = Image.new("RGB", (1920, 900), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((46, 28), "蛋岛的鸟 · 实装 UI / ICON 矩阵", font=font(34, True), fill=INK)
    draw.text(
        (1874, 42),
        f"场景 / Prefab / 配置实际引用 · {len(paths)} 项",
        font=font(18),
        fill=MUTED,
        anchor="ra",
    )
    draw.line((46, 78, 1874, 78), fill="#96957b", width=2)

    draw_icon_panel(canvas, "状态与 HUD", groups.get("status", []), (40, 100, 430, 392), 5, 44)
    draw_icon_panel(canvas, "交互 / 入口 / 导航", groups.get("action", []), (448, 100, 1408, 392), 12, 38)
    draw_icon_panel(canvas, "物品与稀有度筛选", groups.get("filter", []), (1426, 100, 1880, 392), 6, 48)
    draw_icon_panel(canvas, "作物状态", groups.get("crop", []), (40, 410, 520, 622), 5, 52)
    draw_icon_panel(canvas, "蛋种与孵化序列", groups.get("egg", []), (538, 410, 1418, 622), 11, 50)
    draw_icon_panel(canvas, "通用遗传标记", groups.get("gene_common", []), (1436, 410, 1880, 622), 6, 52)

    gene_boxes = [
        ("虎皮鹦鹉", "gene_budgie", (40, 640, 370, 874), 7),
        ("玄凤鹦鹉", "gene_cockatiel", (388, 640, 672, 874), 4),
        ("牡丹鹦鹉", "gene_lovebird", (690, 640, 1016, 874), 6),
        ("小太阳鹦鹉", "gene_sunconure", (1034, 640, 1306, 874), 4),
        ("七彩文鸟", "gene_gouldian", (1324, 640, 1880, 874), 7),
    ]
    for title, key, box, columns in gene_boxes:
        draw_icon_panel(canvas, f"遗传 · {title}", groups.get(key, []), box, columns, 38)

    canvas.save(OUTPUT_ROOT / "icon-matrix.png", optimize=True)


def build_bird_cards() -> None:
    source = open_rgba(UNITY_ROOT / "Assets" / "Screenshots" / "bar_bottom_aligned_after_fix.png")
    canvas = Image.new("RGB", (1600, 800), DARK)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 42), "小鸟卡片 · 收集、身份与状态入口", font=font(32, True), fill="#eee9cb")
    draw.text((1540, 54), "实机界面截取", font=font(18), fill="#96977f", anchor="ra")
    draw.line((60, 90, 1540, 90), fill="#4f5646", width=2)

    board = source.crop((456, 66, 820, 507))
    board = fit_nearest(board, (630, 650))
    canvas.paste(board, (85, 120), board)

    card_boxes = [(486, 120, 584, 235), (589, 120, 687, 235), (693, 120, 791, 235)]
    labels = ["稀有外观", "成鸟档案", "物种识别"]
    for index, (crop_box, label) in enumerate(zip(card_boxes, labels)):
        card = source.crop(crop_box)
        card = fit_nearest(card, (235, 278))
        x = 770 + index * 255
        canvas.paste(card, (x, 210), card)
        draw.text((x + 117, 518), label, font=font(20, True), fill="#e8dfbc", anchor="ma")
    draw.text(
        (770, 604),
        "统一卡面承载头像、命名、物种与提醒；\n选中后继续展开个体状态。",
        font=font(21),
        fill="#bfc1a7",
        spacing=10,
    )
    canvas.save(OUTPUT_ROOT / "bird-cards.png", optimize=True)


def build_bird_hud() -> None:
    source = open_rgba(UNITY_ROOT / "Assets" / "Screenshots" / "bar_bottom_aligned_after_fix.png")
    profile = open_rgba(WEBSITE_ROOT / "assets" / "project" / "ingame-bird-profile-crop.png")
    canvas = Image.new("RGB", (1600, 800), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((60, 42), "小鸟 HUD · 快速状态与完整档案", font=font(32, True), fill=INK)
    draw.text((1540, 54), "两级信息密度", font=font(18), fill=MUTED, anchor="ra")
    draw.line((60, 90, 1540, 90), fill="#96957b", width=2)

    selected_card = source.crop((585, 242, 692, 356))
    selected_card = fit_nearest(selected_card, (360, 385))
    canvas.paste(selected_card, (175, 125), selected_card)
    quick = source.crop((545, 334, 685, 416))
    quick = fit_nearest(quick, (560, 300))
    canvas.paste(quick, (75, 430), quick)
    draw.text((355, 750), "卡片选中态 · 四项即时状态", font=font(20, True), fill=ACCENT, anchor="ma")

    detailed = profile.crop((184, 164, 860, 352))
    detailed = fit_nearest(detailed, (800, 420))
    canvas.paste(detailed, (730, 190), detailed)
    draw.text((1130, 650), "档案态 · 性别、等级、状态与喜好食物", font=font(20, True), fill=ACCENT, anchor="ma")
    canvas.save(OUTPUT_ROOT / "bird-hud.png", optimize=True)


def guid_lookup() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for meta in (UNITY_ROOT / "Assets").rglob("*.meta"):
        match = re.search(r"^guid:\s*(\w+)", meta.read_text(encoding="utf-8", errors="ignore"), re.M)
        if match:
            result[match.group(1)] = Path(str(meta)[:-5])
    return result


def shop_item(asset_name: str, lookup: dict[str, Path]) -> tuple[str, int, Path]:
    asset = UNITY_ROOT / "Assets" / "Resources" / "Item_Definition" / "Shop" / asset_name
    text = asset.read_text(encoding="utf-8", errors="ignore")
    raw_name = re.search(r"displayNameCN:\s*\"?([^\"\r\n]+)", text).group(1)
    display_name = raw_name.encode("ascii").decode("unicode_escape") if "\\u" in raw_name else raw_name
    price = int(re.search(r"price:\s*(\d+)", text).group(1))
    icon_guid = re.search(r"icon:.*guid:\s*([0-9a-f]{32})", text).group(1)
    return display_name, price, lookup[icon_guid]


def find_art(name: str) -> Path:
    return next((UNITY_ROOT / "Assets" / "UI" / "art").rglob(name))


def build_shop() -> None:
    canvas = Image.new("RGB", (1600, 800), DARK)
    draw = ImageDraw.Draw(canvas)
    panel = open_rgba(find_art("商店次级底板.png")).resize((1370, 650), Image.Resampling.NEAREST)
    canvas.paste(panel, (115, 105), panel)

    store_icon = open_rgba(find_art("商店icon.png")).resize((80, 112), Image.Resampling.NEAREST)
    canvas.paste(store_icon, (170, 130), store_icon)
    draw.text((275, 142), "岛屿商店", font=font(34, True), fill="#5b3c24")
    draw.text((275, 190), "种子 / 食物 / 鸟蛋 / 设施", font=font(18), fill="#7c694f")

    currency = open_rgba(find_art("货币栏.png")).resize((291, 54), Image.Resampling.NEAREST)
    canvas.paste(currency, (1135, 145), currency)
    draw.text((1330, 171), "12 480", font=font(21, True), fill="#674823", anchor="mm")

    lookup = guid_lookup()
    item_assets = [
        "item_shop_seed_sunflower.asset",
        "item_shop_food_blueberry.asset",
        "item_shop_egg_budgerigar.asset",
        "item_shop_egg_gouldianfinch.asset",
        "item_shop_bird_device_pool.asset",
        "item_shop_bird_device_tree_banksia.asset",
    ]
    items = [shop_item(name, lookup) for name in item_assets]
    card_bg = open_rgba(find_art("bg.png"))
    icon_bg = open_rgba(find_art("iconbg.png"))
    name_bg = open_rgba(find_art("namebg.png"))
    buy_bg = open_rgba(find_art("buybg.png"))
    note_icon = open_rgba(find_art("音符mini.png"))

    for index, (name, price, icon_path) in enumerate(items):
        col, row = index % 3, index // 3
        x = 205 + col * 410
        y = 270 + row * 205
        card = card_bg.resize((355, 175), Image.Resampling.NEAREST)
        canvas.paste(card, (x, y), card)
        icon_plate = icon_bg.resize((118, 118), Image.Resampling.NEAREST)
        canvas.paste(icon_plate, (x + 18, y + 30), icon_plate)
        icon = fit_nearest(open_rgba(icon_path), (88, 88))
        canvas.paste(icon, (x + 77 - icon.width // 2, y + 89 - icon.height // 2), icon)
        name_plate = name_bg.resize((190, 66), Image.Resampling.NEAREST)
        canvas.paste(name_plate, (x + 148, y + 18), name_plate)
        draw.text((x + 243, y + 51), name, font=font(17, True), fill="#5d4225", anchor="mm")
        buy_plate = buy_bg.resize((190, 63), Image.Resampling.NEAREST)
        canvas.paste(buy_plate, (x + 148, y + 94), buy_plate)
        note = fit_nearest(note_icon, (24, 24))
        canvas.paste(note, (x + 190, y + 113), note)
        draw.text((x + 250, y + 125), str(price), font=font(18, True), fill="#fff0bd", anchor="mm")

    draw.text((1450, 746), "依据实装商店卡片与商品配置还原", font=font(16), fill="#83856f", anchor="ra")
    canvas.save(OUTPUT_ROOT / "shop.png", optimize=True)


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    build_icon_matrix()
    build_bird_cards()
    build_bird_hud()
    build_shop()
    print("Generated:")
    for path in sorted(OUTPUT_ROOT.glob("*.png")):
        print(f"- {path.name}: {Image.open(path).size}")


if __name__ == "__main__":
    main()
