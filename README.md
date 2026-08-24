# 卢华｜像素美术作品集

这是一个 Win98 桌面形式的静态作品集。正式网站仍可直接双击 `index.html` 浏览；内容维护则通过可视化编辑器完成，不需要编辑 HTML、CSS 或 JavaScript。

## 最常用的三个入口

- 浏览网站：双击 `index.html`。
- 修改网站：双击 `start-editor.cmd`，浏览器会自动打开内容编辑器。
- 更新线上网站：保存修改并关闭编辑器后，双击 `publish-update.cmd`，确认变更并输入 `Y`。

编辑器可以调整全局颜色和字号、四个页面的文字与窗口大小、项目与作品分区、作品顺序、素材文件、卡片和大图中的素材大小与位置。保存时会先在 `content/backups/` 自动备份旧内容。

详细使用方法见 [EDITOR_GUIDE.md](./EDITOR_GUIDE.md)。

## 线上发布

网站由 GitHub Pages 托管。每次向 `main` 分支推送修改后，`.github/workflows/pages.yml` 会自动整理公开文件并发布。编辑器、保存服务、内容备份和本地说明文件不会进入公开网站。

正常情况下使用 `publish-update.cmd` 即可完成检查、提交和推送。推送完成后，GitHub Pages 通常需要几分钟更新；如果脚本提示 Git 登录失败，先在当前电脑完成 GitHub 登录，再重新运行脚本。

## 内容结构

- 主页：个人定位、工作方向、状态和合作信息。
- 作品：先按项目进入，再浏览项目内的分类、作品卡片和大图详情。
- 简历：可添加、删除、排序段落、列表和时间线分区。
- 联系：合作说明与邮箱、微信、平台等联系方式。

## 文件结构

- `content/site-content.js`：整站唯一的已发布内容来源，可视化编辑器会维护它。
- `renderer.js`：把内容配置渲染成四个页面。
- `script.js`：桌面窗口、任务栏、项目切换和作品筛选交互。
- `styles.css` / `theme.css`：视觉样式；日常内容调整不需要打开。
- `editor/`：可视化内容编辑器。
- `tools/editor_server.py`：仅绑定本机的保存和素材上传服务。
- `tools/publish_update.ps1`：检查、提交并推送本地修改，由 `publish-update.cmd` 调用。
- `assets/uploads/`：通过编辑器上传的新素材。

## 安全说明

编辑器只监听 `127.0.0.1`，不会把保存接口开放给局域网或互联网。网站不使用数据库或账号；公开部署只包含页面运行所需的静态文件，`editor/`、`tools/` 和 `content/backups/` 不会发布。
