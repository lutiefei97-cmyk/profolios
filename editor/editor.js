(function () {
  "use strict";

  const pageLabels = { global: "全局", home: "主页", works: "作品", resume: "简历", contact: "联系" };
  const state = { page: "global", project: 0, item: 0, resumeSection: 0 };
  const dom = {
    pageNav: document.querySelector("[data-page-nav]"),
    tree: document.querySelector("[data-content-tree]"),
    inspector: document.querySelector("[data-inspector]"),
    preview: document.querySelector("[data-preview]"),
    previewWrap: document.querySelector("[data-preview-wrap]"),
    previewStage: document.querySelector("[data-preview-stage]"),
    saveState: document.querySelector("[data-save-state]"),
    toast: document.querySelector("[data-toast]"),
  };

  let draft = null;
  let savedSnapshot = "";
  let history = [];
  let historyIndex = -1;
  let previewTimer = 0;
  let toastTimer = 0;
  let previewMode = "desktop";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const snapshot = () => JSON.stringify(draft);
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const pathAttr = (path) => escapeHtml(JSON.stringify(path));

  function valueAt(path) {
    return path.reduce((value, key) => value?.[key], draft);
  }

  function setAt(path, value) {
    const key = path[path.length - 1];
    const parent = path.slice(0, -1).reduce((object, part) => object[part], draft);
    parent[key] = value;
  }

  function showToast(message, error = false) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.style.background = error ? "#8f3030" : "#263238";
    dom.toast.hidden = false;
    toastTimer = window.setTimeout(() => { dom.toast.hidden = true; }, 3200);
  }

  function setSaveState(message) {
    const dirty = draft && snapshot() !== savedSnapshot;
    dom.saveState.textContent = message || (dirty ? "有未保存的修改" : "已保存");
    dom.saveState.classList.toggle("dirty", dirty);
    document.querySelector("[data-action='save']").disabled = !dirty;
  }

  function checkpoint() {
    const next = snapshot();
    if (history[historyIndex] === next) return;
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
    setSaveState();
  }

  function updateHistoryButtons() {
    document.querySelector("[data-action='undo']").disabled = historyIndex <= 0;
    document.querySelector("[data-action='redo']").disabled = historyIndex >= history.length - 1;
  }

  function restoreHistory(index) {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    draft = JSON.parse(history[index]);
    normalizeSelection();
    renderAll();
    updatePreview();
  }

  function updatePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      try {
        dom.preview.contentWindow.sessionStorage.setItem("portfolio-preview-content", snapshot());
        const hash = state.page === "works" ? `#works/${currentProject()?.id || "index"}` : state.page === "global" ? "#home" : `#${state.page}`;
        const previewUrl = new URL("../index.html", window.location.href);
        previewUrl.searchParams.set("editor-preview", String(Date.now()));
        previewUrl.hash = hash;
        dom.preview.src = previewUrl.href;
      } catch (error) {
        console.warn("预览刷新失败", error);
      }
      setSaveState();
    }, 180);
  }

  function applyPreviewViewport(mode = previewMode) {
    previewMode = mode;
    const sizes = { desktop: [1440, 900], tablet: [820, 900], mobile: [390, 844] };
    const [width, height] = sizes[mode] || sizes.desktop;
    const availableWidth = Math.max(280, dom.previewStage.clientWidth - 36);
    const scale = Math.min(1, availableWidth / width);
    dom.preview.style.width = `${width}px`;
    dom.preview.style.height = `${height}px`;
    dom.preview.style.transform = `scale(${scale})`;
    dom.previewWrap.style.width = `${Math.round(width * scale)}px`;
    dom.previewWrap.style.height = `${Math.round(height * scale)}px`;
  }

  function currentProject() {
    return draft?.pages?.works?.projects?.[state.project];
  }

  function currentItem() {
    return currentProject()?.items?.[state.item];
  }

  function normalizeSelection() {
    const projects = draft.pages.works.projects;
    state.project = Math.max(0, Math.min(state.project, projects.length - 1));
    const items = currentProject()?.items || [];
    state.item = Math.max(0, Math.min(state.item, Math.max(0, items.length - 1)));
    state.resumeSection = Math.max(0, Math.min(state.resumeSection, Math.max(0, draft.pages.resume.sections.length - 1)));
  }

  function field(label, path, options = {}) {
    const value = valueAt(path);
    const type = options.type || "text";
    const classes = `field${options.full ? " span-2" : ""}`;
    const help = options.help ? `<small>${escapeHtml(options.help)}</small>` : "";
    if (type === "textarea") {
      return `<label class="${classes}"><span>${escapeHtml(label)}</span><textarea data-path="${pathAttr(path)}" rows="${options.rows || 4}">${escapeHtml(value)}</textarea>${help}</label>`;
    }
    if (type === "select") {
      return `<label class="${classes}"><span>${escapeHtml(label)}</span><select data-path="${pathAttr(path)}">${options.options.map(([key, text]) => `<option value="${escapeHtml(key)}"${String(value) === String(key) ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select>${help}</label>`;
    }
    if (type === "checkbox") {
      return `<label class="field checkbox-field${options.full ? " span-2" : ""}"><input type="checkbox" data-path="${pathAttr(path)}"${value ? " checked" : ""} /><span>${escapeHtml(label)}</span></label>`;
    }
    if (type === "range") {
      return `<label class="${classes}"><span>${escapeHtml(label)}</span><div class="range-row"><input type="range" min="${options.min}" max="${options.max}" step="${options.step || 1}" value="${escapeHtml(value)}" data-path="${pathAttr(path)}" data-number /><input type="number" min="${options.min}" max="${options.max}" step="${options.step || 1}" value="${escapeHtml(value)}" data-path="${pathAttr(path)}" data-number /></div>${help}</label>`;
    }
    return `<label class="${classes}"><span>${escapeHtml(label)}</span><input type="${escapeHtml(type)}" value="${escapeHtml(value)}" data-path="${pathAttr(path)}"${options.number ? " data-number" : ""}${options.min !== undefined ? ` min="${options.min}"` : ""}${options.max !== undefined ? ` max="${options.max}"` : ""} />${help}</label>`;
  }

  function assetField(label, path, full = true) {
    return `<label class="field${full ? " span-2" : ""}"><span>${escapeHtml(label)}</span><div class="upload-row"><input type="text" value="${escapeHtml(valueAt(path))}" data-path="${pathAttr(path)}" /><label class="upload-label">上传替换<input type="file" accept="image/*,video/mp4" data-upload-path="${pathAttr(path)}" hidden /></label></div><small>可直接填写 assets 下的相对路径，也可以选择文件上传。</small></label>`;
  }

  function section(title, content, note = "") {
    return `<section class="form-section"><h2>${escapeHtml(title)}</h2>${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}${content}</section>`;
  }

  function listSection(title, path, fields, template, note = "") {
    const list = valueAt(path) || [];
    const rows = list.map((item, index) => {
      const inputs = fields.map((definition) => definition.asset
        ? assetField(definition.label, definition.key === null ? [...path, index] : [...path, index, definition.key], false)
        : field(definition.label, definition.key === null ? [...path, index] : [...path, index, definition.key], { type: definition.type, full: true, help: definition.help })
      ).join("");
      return `<div class="repeat-row"><div class="repeat-row-fields">${inputs}</div><div class="repeat-row-tools">
        <button type="button" data-action="list-move" data-list-path="${pathAttr(path)}" data-index="${index}" data-direction="-1" title="上移">↑</button>
        <button type="button" data-action="list-move" data-list-path="${pathAttr(path)}" data-index="${index}" data-direction="1" title="下移">↓</button>
        <button class="danger" type="button" data-action="list-delete" data-list-path="${pathAttr(path)}" data-index="${index}" title="删除">×</button>
      </div></div>`;
    }).join("");
    return section(title, `${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}<div class="repeat-list">${rows || "<p>目前没有内容。</p>"}</div><div class="inline-actions"><button type="button" data-action="list-add" data-list-path="${pathAttr(path)}" data-template="${escapeHtml(template)}">＋ 添加一项</button></div>`);
  }

  function renderPageNav() {
    dom.pageNav.innerHTML = Object.entries(pageLabels).map(([id, label]) => `<button type="button" data-select-page="${id}" class="${state.page === id ? "active" : ""}">${label}</button>`).join("");
  }

  function renderTree() {
    if (state.page === "works") {
      const projects = draft.pages.works.projects;
      const projectButtons = projects.map((project, index) => `<button type="button" class="tree-button${state.project === index ? " active" : ""}" data-select-project="${index}">${escapeHtml(project.title || `项目 ${index + 1}`)}</button>`).join("");
      const items = currentProject()?.items || [];
      const itemButtons = items.map((item, index) => `<button type="button" class="tree-button${state.item === index ? " active" : ""}" data-select-item="${index}">${index + 1}. ${escapeHtml(item.title || "未命名作品")}</button>`).join("");
      dom.tree.innerHTML = `<div class="tree-heading"><h2>项目</h2><button type="button" data-action="project-add">＋ 新项目</button></div><div class="tree-list">${projectButtons}</div>
        <div class="tree-actions"><button type="button" data-action="project-move" data-direction="-1">项目上移</button><button type="button" data-action="project-move" data-direction="1">项目下移</button><button class="danger" type="button" data-action="project-delete">删除项目</button></div>
        <div class="tree-heading"><h2>项目内作品</h2><button type="button" data-action="item-add">＋ 新作品</button></div><div class="tree-list">${itemButtons || "<p>还没有作品。</p>"}</div>
        <div class="tree-actions"><button type="button" data-action="item-move" data-direction="-1">上移</button><button type="button" data-action="item-move" data-direction="1">下移</button><button type="button" data-action="item-duplicate">复制</button><button class="danger" type="button" data-action="item-delete">删除</button></div>`;
      return;
    }
    if (state.page === "resume") {
      dom.tree.innerHTML = `<div class="tree-heading"><h2>简历分区</h2><button type="button" data-action="resume-add">＋ 新分区</button></div><div class="tree-list">${draft.pages.resume.sections.map((item, index) => `<button type="button" class="tree-button${state.resumeSection === index ? " active" : ""}" data-select-resume="${index}">${escapeHtml(item.title)}</button>`).join("")}</div><div class="tree-actions"><button type="button" data-action="resume-move" data-direction="-1">上移</button><button type="button" data-action="resume-move" data-direction="1">下移</button><button class="danger" type="button" data-action="resume-delete">删除</button></div>`;
      return;
    }
    dom.tree.innerHTML = `<p class="note">这里会显示当前页面的可排序内容。右侧可以直接修改文字、图片和显示参数。</p>`;
  }

  function basePageFields(pageId) {
    const base = ["pages", pageId];
    return section("页面与窗口", `<div class="form-grid">${field("桌面名称", [...base, "label"])}${field("任务栏名称", [...base, "taskLabel"])}${field("窗口标题", [...base, "windowTitle"], { full: true })}${field("开始菜单说明", [...base, "startDescription"], { full: true })}${assetField("桌面图标", [...base, "icon"])}${field("窗口宽度", [...base, "window", "width"], { type: "number", number: true, min: 360 })}${field("窗口高度", [...base, "window", "height"], { type: "number", number: true, min: 240 })}</div>`, "窗口宽高只影响电脑端；手机端会自动适配屏幕。");
  }

  function renderGlobal() {
    const base = ["site"];
    return `<h1>全局设置</h1><p class="lead">修改网站名称、桌面外观和装饰素材。颜色使用取色器即可，不需要写 CSS。</p>
      ${section("网站信息", `<div class="form-grid">${field("浏览器标题", [...base, "title"], { full: true })}${field("搜索摘要", [...base, "description"], { type: "textarea", full: true })}${field("桌面说明", [...base, "desktopLabel"], { full: true })}${field("开始菜单品牌", [...base, "brand"])}${field("开始按钮文字", [...base, "startLabel"])}</div>`)}
      ${section("颜色与字号", `<div class="form-grid">${field("桌面底色", [...base, "theme", "desktop"], { type: "color" })}${field("窗口标题栏", [...base, "theme", "titlebar"], { type: "color" })}${field("窗口外框", [...base, "theme", "windowFace"], { type: "color" })}${field("内容纸张", [...base, "theme", "paper"], { type: "color" })}${field("强调色", [...base, "theme", "accent"], { type: "color" })}${field("素材底色", [...base, "theme", "mediaBackground"], { type: "color" })}${field("整站字号比例", [...base, "theme", "fontScale"], { type: "range", min: .85, max: 1.25, step: .05, full: true })}</div>`)}
      ${listSection("桌面背景图层", [...base, "background"], [{ label: "样式名称（一般不用改）", key: "className" }, { label: "图片", key: "src", asset: true }], "background", "从上到下是背景图层；可替换素材，也可调整顺序。")}
      ${listSection("桌面鸟类装饰", [...base, "decorations"], [{ label: "图片", key: "src", asset: true }, { label: "图片说明", key: "alt" }, { label: "按横向长图显示", key: "wide", type: "checkbox" }], "decoration")}`;
  }

  function renderHome() {
    const base = ["pages", "home"];
    return `<h1>主页</h1><p class="lead">编辑个人介绍、工作方向、当前状态与合作联系方式。</p>${basePageFields("home")}
      ${section("个人介绍", `<div class="form-grid">${field("英文定位", [...base, "eyebrow"], { full: true })}${field("姓名", [...base, "name"])}${field("介绍文字", [...base, "summary"], { type: "textarea", full: true })}${field("工作方向标题", [...base, "directionTitle"], { full: true })}</div>`)}
      ${listSection("个人头像", [...base, "avatars"], [{ label: "图片", key: null, asset: true }], "string", "保留一张图片时会自动铺满主页头像格；添加多张时恢复小图矩阵。")}
      ${listSection("工作方向", [...base, "directions"], [{ label: "一条方向", key: null, type: "textarea" }], "string")}
      ${listSection("当前状态", [...base, "statuses"], [{ label: "一条状态", key: null }], "string")}
      ${section("合作信息", `<div class="form-grid">${field("标题", [...base, "footer", "title"], { full: true })}${field("邮箱", [...base, "footer", "email"], { full: true })}${field("微信", [...base, "footer", "wechat"], { full: true })}</div>`)}`;
  }

  function renderRosterEntries(path) {
    const entries = valueAt([...path, "entries"]) || [];
    const rows = entries.map((entry, index) => {
      const entryPath = [...path, "entries", index];
      const actionFields = (role, title) => {
        const action = entry?.[role] || {};
        const actionPath = [...entryPath, role];
        const sourceField = action.pattern
          ? field(`${title}序列路径`, [...actionPath, "pattern"], { full: true, help: "用 {frame} 代表帧编号，例如 bird-{frame}.png。" })
          : assetField(`${title}动作表`, [...actionPath, "src"]);
        const fileFallback = action.fileSrc ? assetField(`${title}本地兼容动作表`, [...actionPath, "fileSrc"]) : "";
        const paletteFields = action.palette ? `${assetField(`${title} LUT`, [...actionPath, "palette", "src"])}${field(`${title} LUT 行`, [...actionPath, "palette", "row"], { type: "number", number: true, min: 0 })}` : "";
        const boundsFields = action.bounds ? `${field(`${title}裁切 X`, [...actionPath, "bounds", "x"], { type: "number", number: true, min: 0 })}${field(`${title}裁切 Y`, [...actionPath, "bounds", "y"], { type: "number", number: true, min: 0 })}${field(`${title}裁切宽`, [...actionPath, "bounds", "width"], { type: "number", number: true, min: 1 })}${field(`${title}裁切高`, [...actionPath, "bounds", "height"], { type: "number", number: true, min: 1 })}` : "";
        return `<div class="form-grid">${sourceField}${fileFallback}${field(`${title}帧数`, [...actionPath, "frameCount"], { type: "number", number: true, min: 1 })}${field(`${title}画布尺寸`, [...actionPath, "frameSize"], { type: "number", number: true, min: 1 })}${field(`${title}单帧毫秒`, [...actionPath, "frameMs"], { type: "number", number: true, min: 60 })}${field(`${title}独立比例`, [...actionPath, "scale"], { type: "number", number: true, min: .5, max: 4, help: "留空时使用矩阵上方的统一角色比例。" })}${paletteFields}${boundsFields}</div>`;
      };
      return `<div class="repeat-row"><div class="repeat-row-fields"><h3>${index + 1}. ${escapeHtml(entry.name)}</h3><div class="form-grid">${field("物种名称", [...entryPath, "name"], { full: true })}${field("规格说明", [...entryPath, "spec"], { full: true })}</div>${actionFields("adult", "成鸟动作")}${actionFields("chick", "雏鸟动作")}</div></div>`;
    }).join("");
    return section("角色设计矩阵", `<div class="repeat-list">${rows}</div>`, "每个物种可以独立替换成鸟与雏鸟动作表、帧数、裁切边界与播放速度；带 LUT 的物种还可切换配色行。若填写了本地兼容动作表，请在改配色后同步替换，保证直接双击 index.html 时也能正常显示。");
  }

  function spriteFields(path, labels = {}) {
    return `<div class="form-grid">
      ${assetField(labels.source || "动作序列帧表", [...path, "src"])}
      ${field(labels.variants || "本地随机配色动作表", [...path, "fileVariants"], { full: true, help: "多个路径用 | 分隔；直接双击网站时会从这些已换色动作表中随机切换。" })}
      ${field("帧数", [...path, "frameCount"], { type: "number", number: true, min: 1 })}
      ${field("单帧画布尺寸", [...path, "frameSize"], { type: "number", number: true, min: 1 })}
      ${field("单帧毫秒", [...path, "frameMs"], { type: "number", number: true, min: 60 })}
      ${field("动作独立比例", [...path, "scale"], { type: "number", number: true, min: .5, max: 4, help: "留空时使用上方统一动作比例。" })}
      ${field("裁切 X", [...path, "bounds", "x"], { type: "number", number: true, min: 0 })}
      ${field("裁切 Y", [...path, "bounds", "y"], { type: "number", number: true, min: 0 })}
      ${field("裁切宽", [...path, "bounds", "width"], { type: "number", number: true, min: 1 })}
      ${field("裁切高", [...path, "bounds", "height"], { type: "number", number: true, min: 1 })}
    </div>`;
  }

  function renderActionLibraryEditor(path) {
    const actions = valueAt([...path, "actions"]) || [];
    const rows = actions.map((action, index) => {
      const actionPath = [...path, "actions", index];
      return `<div class="repeat-row"><div class="repeat-row-fields"><h3>${index + 1}. ${escapeHtml(action.name || "未命名动作")}</h3>${field("动作名称", [...actionPath, "name"], { full: true })}${spriteFields(actionPath)}</div><div class="repeat-row-tools">
        <button type="button" data-action="list-move" data-list-path="${pathAttr([...path, "actions"])}" data-index="${index}" data-direction="-1" title="上移">↑</button>
        <button type="button" data-action="list-move" data-list-path="${pathAttr([...path, "actions"])}" data-index="${index}" data-direction="1" title="下移">↓</button>
        <button class="danger" type="button" data-action="list-delete" data-list-path="${pathAttr([...path, "actions"])}" data-index="${index}" title="删除">×</button>
      </div></div>`;
    }).join("");
    return section("动作库内容", `<div class="form-grid">${field("动作库标题", [...path, "heading"], { full: true })}${field("规格说明", [...path, "caption"], { full: true })}${field("每行动作数", [...path, "columns"], { type: "number", number: true, min: 2, max: 6 })}${assetField("作品卡片封面", [...path, "preview", "src"])}${field("封面图片说明", [...path, "preview", "alt"], { type: "textarea", full: true })}</div><div class="repeat-list">${rows || "<p>目前没有动作。</p>"}</div><div class="inline-actions"><button type="button" data-action="list-add" data-list-path="${pathAttr([...path, "actions"])}" data-template="action">＋ 添加动作</button></div>`, "动作会使用统一画布与裁切边界显示；拖动动作比例即可整体放大或缩小。");
  }

  function renderPaletteShowcaseEditor(path) {
    const species = valueAt([...path, "species"]) || [];
    const rows = species.map((item, index) => {
      const speciesPath = [...path, "species", index];
      const actionPath = [...speciesPath, "action"];
      return `<div class="repeat-row"><div class="repeat-row-fields"><h3>${index + 1}. ${escapeHtml(item.name || "未命名物种")}</h3><div class="form-grid">
        ${field("物种名称", [...speciesPath, "name"], { full: true })}
        ${assetField("配色矩阵图片", [...speciesPath, "matrix", "src"])}
        ${field("配色矩阵图片说明", [...speciesPath, "matrix", "alt"], { type: "textarea", full: true })}
      </div>${spriteFields(actionPath, { source: "动作索引帧表", variants: "本地随机配色动作表" })}<div class="form-grid">
        ${assetField("LUT 配色表", [...actionPath, "palette", "src"])}
        ${field("LUT 列数", [...actionPath, "palette", "cols"], { type: "number", number: true, min: 1 })}
        ${field("LUT 行数", [...actionPath, "palette", "rows"], { type: "number", number: true, min: 1 })}
        ${field("默认配色行", [...actionPath, "palette", "row"], { type: "number", number: true, min: 0 })}
        ${field("随机配色行", [...actionPath, "palette", "randomRows"], { full: true, help: "用英文逗号分隔，例如 0,12,36,60。" })}
        ${field("换色间隔（毫秒）", [...actionPath, "palette", "paletteMs"], { type: "number", number: true, min: 100 })}
      </div></div><div class="repeat-row-tools">
        <button type="button" data-action="list-move" data-list-path="${pathAttr([...path, "species"])}" data-index="${index}" data-direction="-1" title="上移">↑</button>
        <button type="button" data-action="list-move" data-list-path="${pathAttr([...path, "species"])}" data-index="${index}" data-direction="1" title="下移">↓</button>
        <button class="danger" type="button" data-action="list-delete" data-list-path="${pathAttr([...path, "species"])}" data-index="${index}" title="删除">×</button>
      </div></div>`;
    }).join("");
    return section("配色物种矩阵", `<div class="form-grid">${field("矩阵总标题", [...path, "heading"], { full: true })}${field("换色说明", [...path, "caption"], { full: true })}</div><div class="repeat-list">${rows || "<p>目前没有物种。</p>"}</div><div class="inline-actions"><button type="button" data-action="list-add" data-list-path="${pathAttr([...path, "species"])}" data-template="paletteSpecies">＋ 添加物种</button></div>`, "每个物种都可以独立替换配色矩阵、动作表、LUT、换色频率与裁切范围。");
  }

  function renderMediaSettings(path) {
    const mediaType = valueAt([...path, "type"]);
    const isRoster = mediaType === "roster";
    const isActionMedia = mediaType === "actionLibrary" || mediaType === "paletteShowcase";
    const rosterScaleFields = isRoster ? `${field("卡片角色比例", [...path, "settings", "spriteScale"], { type: "range", min: .5, max: 2, step: .05, full: true })}${field("大图角色比例", [...path, "settings", "detailSpriteScale"], { type: "range", min: .5, max: 2, step: .05, full: true })}` : "";
    const actionScaleFields = isActionMedia ? `${field("卡片动作比例", [...path, "settings", "actionScale"], { type: "range", min: .5, max: 3, step: .05, full: true })}${field("大图动作比例", [...path, "settings", "detailActionScale"], { type: "range", min: .5, max: 4, step: .05, full: true })}` : "";
    const assetsEditor = isRoster
      ? section("矩阵封面", `<div class="form-grid">${field("矩阵标题", [...path, "heading"], { full: true })}${assetField("作品卡片封面", [...path, "preview", "src"])}${field("封面图片说明", [...path, "preview", "alt"], { type: "textarea", full: true })}</div>`) + renderRosterEntries(path)
      : mediaType === "actionLibrary" ? renderActionLibraryEditor(path)
      : mediaType === "paletteShowcase" ? renderPaletteShowcaseEditor(path)
      : mediaType === "redesignComparison" ? listSection("旧版与现版素材", [...path, "assets"], [{ label: "物种", key: "species" }, { label: "版本", key: "version" }, { label: "图片", key: "src", asset: true }, { label: "无障碍图片说明", key: "alt", type: "textarea" }], "asset")
      : mediaType === "video" ? listSection("视频文件", [...path, "assets"], [{ label: "MP4 视频", key: "src", asset: true }, { label: "封面图片（建议填写）", key: "poster", asset: true }, { label: "视频说明", key: "alt", type: "textarea" }], "asset")
      : ["uiPair", "artCollection", "cardPair"].includes(mediaType) ? listSection("带说明素材", [...path, "assets"], [{ label: "图片/动图", key: "src", asset: true }, { label: "图片说明", key: "caption" }, { label: "无障碍图片说明", key: "alt", type: "textarea" }], "asset")
      : listSection("素材文件", [...path, "assets"], [{ label: "图片/动图", key: "src", asset: true }, { label: "无障碍图片说明", key: "alt", type: "textarea" }], "asset");
    const collectionEditor = mediaType === "artCollection"
      ? section("素材矩阵布局", `<div class="form-grid">${field("大图列数", [...path, "settings", "columns"], { type: "range", min: 1, max: 4, step: 1, full: true })}</div>`)
      : "";
    return section("素材显示", `<div class="form-grid">${field("显示方式", [...path, "type"], { type: "select", options: [["image", "单张/动图"], ["video", "演示视频"], ["layers", "场景叠层"], ["gallery", "多图矩阵"], ["uiPair", "主界面＋局部界面"], ["artCollection", "插画收藏矩阵"], ["cardPair", "卡片正反面"], ["redesignComparison", "角色改版对照"], ["habitatGrowth", "设施＋成长序列"], ["proof", "图片＋说明"], ["flow", "流程图"], ["roster", "角色设计矩阵"], ["paletteShowcase", "物种配色矩阵"], ["actionLibrary", "动作库"]], full: true })}${field("卡片宽度", path.slice(0, -1).concat("width"), { type: "select", options: [["standard", "标准"], ["wide", "较宽"], ["full", "整行"]], full: true })}${field("卡片内素材大小", [...path, "settings", "scale"], { type: "range", min: .25, max: 3, step: .05, full: true })}${field("大图内素材大小", [...path, "settings", "detailScale"], { type: "range", min: .25, max: 4, step: .05, full: true })}${rosterScaleFields}${actionScaleFields}${field("水平位置", [...path, "settings", "x"], { type: "range", min: 0, max: 100, full: true })}${field("垂直位置", [...path, "settings", "y"], { type: "range", min: 0, max: 100, full: true })}${field("卡片图片区高度", [...path, "settings", "cardHeight"], { type: "range", min: 70, max: 260, full: true })}${field("图片四周留白", [...path, "settings", "padding"], { type: "range", min: 0, max: 40, full: true })}${field("素材背景色", [...path, "settings", "background"], { type: "color" })}${field("图片裁切方式", [...path, "settings", "fit"], { type: "select", options: [["contain", "完整显示"], ["cover", "铺满裁切"], ["fill", "拉伸铺满"], ["scale-down", "不放大"]] })}${field("像素图清晰放大", [...path, "settings", "pixelated"], { type: "checkbox", full: true })}</div>`, "角色设计矩阵与动作库优先调整各自的角色/动作比例；通用图片使用素材大小。") +
      assetsEditor +
      collectionEditor +
      (valueAt([...path, "type"]) === "proof" ? listSection("配图说明要点", [...path, "bullets"], [{ label: "一条说明", key: null, type: "textarea" }], "string") : "") +
      (valueAt([...path, "type"]) === "flow" ? listSection("流程步骤", [...path, "steps"], [{ label: "步骤名称", key: null }], "string") : "");
  }

  function renderWorks() {
    const page = ["pages", "works"];
    const project = currentProject();
    if (!project) return `<h1>作品</h1><p class="lead">还没有项目。请从左侧添加一个项目。</p>${basePageFields("works")}`;
    const projectPath = [...page, "projects", state.project];
    const item = currentItem();
    const categories = project.categories || [];
    return `<h1>作品与项目</h1><p class="lead">左侧先选项目和作品；右侧调整内容。预览会自动打开当前项目。</p>${basePageFields("works")}
      ${section("作品入口页", `<div class="form-grid">${field("入口页英文标题", [...page, "index", "eyebrow"], { full: true })}${field("入口页标题", [...page, "index", "title"], { full: true })}${field("入口页说明", [...page, "index", "description"], { type: "textarea", full: true })}${field("进入按钮文字", [...page, "index", "enterLabel"], { full: true })}</div>`)}
      ${section("当前项目", `<div class="form-grid">${field("项目识别名", [...projectPath, "id"], { help: "只用英文小写、数字和短横线，例如 eggisland。" })}${field("分页名称", [...projectPath, "tabLabel"])}${field("项目标签", [...projectPath, "badge"])}${field("项目标题", [...projectPath, "title"], { full: true })}${field("项目简介", [...projectPath, "summary"], { type: "textarea", full: true })}${assetField("项目封面", [...projectPath, "cover", "src"])}${field("封面图片说明", [...projectPath, "cover", "alt"], { type: "textarea", full: true })}${field("详情英文标题", [...projectPath, "detailEyebrow"])}${field("详情标题", [...projectPath, "detailTitle"], { full: true })}</div>`)}
      ${listSection("项目信息", [...projectPath, "facts"], [{ label: "标签", key: "label" }, { label: "内容", key: "value", type: "textarea" }], "fact")}
      ${listSection("作品分类", [...projectPath, "categories"], [{ label: "分类识别名", key: "id", help: "英文小写，例如 animation" }, { label: "显示名称", key: "label" }], "category", "第一项建议保留 all / 全部。分类识别名与作品所属分类一致。")}
      ${item ? `${section("当前作品文字", `<div class="form-grid">${field("作品识别名", [...projectPath, "items", state.item, "id"], { help: "用英文小写、数字和短横线。" })}${field("所属分类", [...projectPath, "items", state.item, "category"], { type: "select", options: categories.filter((entry) => entry.id !== "all").map((entry) => [entry.id, entry.label]) })}${field("小标题", [...projectPath, "items", state.item, "kicker"])}${field("作品标题", [...projectPath, "items", state.item, "title"], { full: true })}${field("作品说明", [...projectPath, "items", state.item, "description"], { type: "textarea", full: true })}</div>`)}${renderMediaSettings([...projectPath, "items", state.item, "media"])}` : section("当前作品", "<p>项目内还没有作品，请从左侧添加。</p>")}`;
  }

  function renderResume() {
    const base = ["pages", "resume"];
    const sectionItem = draft.pages.resume.sections[state.resumeSection];
    const path = [...base, "sections", state.resumeSection];
    let itemEditor = "";
    if (sectionItem?.type === "list") itemEditor = listSection("列表内容", [...path, "items"], [{ label: "一条内容", key: null, type: "textarea" }], "string");
    if (sectionItem?.type === "timeline") itemEditor = listSection("时间线内容", [...path, "items"], [{ label: "时间/标签", key: "label" }, { label: "经历说明", key: "value", type: "textarea" }], "timeline");
    return `<h1>简历</h1><p class="lead">左侧可添加、排序简历分区，每个分区可以选择段落、列表或时间线。</p>${basePageFields("resume")}${section("页面标题", `<div class="form-grid">${field("英文标题", [...base, "eyebrow"])}${field("主标题", [...base, "title"], { full: true })}</div>`)}${sectionItem ? section("当前分区", `<div class="form-grid">${field("分区标题", [...path, "title"], { full: true })}${field("内容形式", [...path, "type"], { type: "select", options: [["paragraph", "一段文字"], ["list", "项目列表"], ["timeline", "时间线"]], full: true })}${sectionItem.type === "paragraph" ? field("段落内容", [...path, "body"], { type: "textarea", full: true }) : ""}</div>`) + itemEditor : ""}`;
  }

  function renderContact() {
    const base = ["pages", "contact"];
    return `<h1>联系</h1><p class="lead">编辑合作说明和联系方式。链接留空时会显示为普通信息卡片。</p>${basePageFields("contact")}${section("联系说明", `<div class="form-grid">${field("英文标题", [...base, "eyebrow"])}${field("主标题", [...base, "title"], { full: true })}${field("说明文字", [...base, "description"], { type: "textarea", full: true })}</div>`)}${listSection("联系方式", [...base, "channels"], [{ label: "名称", key: "label" }, { label: "显示内容", key: "value" }, { label: "链接（可留空）", key: "href", help: "可填 mailto:邮箱 或 https://网址" }], "channel")}`;
  }

  function renderInspector() {
    dom.inspector.innerHTML = ({ global: renderGlobal, home: renderHome, works: renderWorks, resume: renderResume, contact: renderContact }[state.page])();
  }

  function renderAll() {
    renderPageNav();
    renderTree();
    renderInspector();
    updateHistoryButtons();
    setSaveState();
  }

  const templates = {
    string: () => "新内容",
    asset: () => ({ src: "", alt: "请描述图片内容" }),
    background: () => ({ className: "bg-sky", src: "" }),
    decoration: () => ({ src: "", alt: "装饰图片", wide: false }),
    fact: () => ({ label: "标签", value: "内容" }),
    category: () => ({ id: `category-${Date.now()}`, label: "新分类" }),
    timeline: () => ({ label: "时间", value: "经历说明" }),
    channel: () => ({ label: "联系方式", value: "内容", href: "" }),
    action: () => ({ name: "新动作", src: "", fileVariants: "", frameCount: 4, frameSize: 64, frameMs: 140, scale: 1.5, bounds: { x: 0, y: 0, width: 64, height: 64 } }),
    paletteSpecies: () => ({ name: "新物种", matrix: { src: "", alt: "配色方案矩阵" }, action: { src: "", fileVariants: "", frameCount: 4, frameSize: 64, frameMs: 140, scale: 2, bounds: { x: 0, y: 0, width: 64, height: 64 }, palette: { src: "", cols: 1, rows: 1, row: 0, randomRows: "0", paletteMs: 650 } } }),
  };

  function defaultMedia() {
    return { type: "image", assets: [{ src: "", alt: "请描述图片内容" }], settings: { fit: "contain", scale: 1, detailScale: 1, x: 50, y: 50, cardHeight: 94, padding: 8, background: "#111610", pixelated: true } };
  }

  function defaultProject() {
    const id = `project-${Date.now()}`;
    return { id, tabLabel: "新项目", badge: "项目", title: "新项目标题", summary: "在这里填写项目简介。", cover: { src: "", alt: "项目封面" }, facts: [{ label: "职责", value: "填写职责" }], detailEyebrow: "Selected Works", detailTitle: "项目作品", categories: [{ id: "all", label: "全部" }, { id: "art", label: "美术" }], items: [] };
  }

  function defaultItem() {
    return { id: `work-${Date.now()}`, category: currentProject()?.categories?.find((item) => item.id !== "all")?.id || "art", width: "standard", kicker: "作品类型", title: "新作品", description: "在这里说明作品内容、你的职责和解决的问题。", media: defaultMedia() };
  }

  function moveInList(list, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return index;
    [list[index], list[target]] = [list[target], list[index]];
    return target;
  }

  async function uploadFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    input.disabled = true;
    setSaveState("正在上传素材…");
    try {
      const project = currentProject()?.id || "site";
      const response = await fetch(`/api/upload?project=${encodeURIComponent(project)}&filename=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "上传失败");
      setAt(JSON.parse(input.dataset.uploadPath), result.path);
      checkpoint();
      renderInspector();
      updatePreview();
      showToast("素材已上传并替换");
    } catch (error) {
      showToast(error.message, true);
      setSaveState("上传失败，请确认编辑器服务器仍在运行");
    } finally {
      input.disabled = false;
    }
  }

  async function saveContent() {
    setSaveState("正在保存…");
    try {
      const response = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      savedSnapshot = snapshot();
      setSaveState("已保存并发布");
      showToast(`保存成功；已自动备份 ${result.backup || "旧版本"}`);
    } catch (error) {
      showToast(error.message, true);
      setSaveState("保存失败，请不要关闭页面");
    }
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `portfolio-content-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importBackup(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const next = JSON.parse(await file.text());
      if (!next.site || !next.pages?.home || !next.pages?.works || !next.pages?.resume || !next.pages?.contact) throw new Error("这不是完整的作品集备份文件");
      draft = next;
      normalizeSelection();
      checkpoint();
      renderAll();
      updatePreview();
      showToast("备份已导入；确认预览后请点击“保存并发布”");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      input.value = "";
    }
  }

  function handleAction(button) {
    const action = button.dataset.action;
    if (action === "undo") return restoreHistory(historyIndex - 1);
    if (action === "redo") return restoreHistory(historyIndex + 1);
    if (action === "save") return saveContent();
    if (action === "export") return downloadBackup();

    if (action?.startsWith("list-")) {
      const list = valueAt(JSON.parse(button.dataset.listPath));
      const index = Number(button.dataset.index);
      if (action === "list-add") list.push(templates[button.dataset.template]());
      if (action === "list-delete" && window.confirm("确定删除这一项吗？")) list.splice(index, 1);
      if (action === "list-move") moveInList(list, index, Number(button.dataset.direction));
    }
    if (action === "project-add") { draft.pages.works.projects.push(defaultProject()); state.project = draft.pages.works.projects.length - 1; state.item = 0; }
    if (action === "project-delete" && draft.pages.works.projects.length && window.confirm("确定删除整个项目及其所有作品吗？")) { draft.pages.works.projects.splice(state.project, 1); state.project = Math.max(0, state.project - 1); state.item = 0; }
    if (action === "project-move") state.project = moveInList(draft.pages.works.projects, state.project, Number(button.dataset.direction));
    if (action === "item-add") { currentProject().items.push(defaultItem()); state.item = currentProject().items.length - 1; }
    if (action === "item-delete" && currentItem() && window.confirm("确定删除当前作品吗？")) { currentProject().items.splice(state.item, 1); state.item = Math.max(0, state.item - 1); }
    if (action === "item-move" && currentItem()) state.item = moveInList(currentProject().items, state.item, Number(button.dataset.direction));
    if (action === "item-duplicate" && currentItem()) { const copy = clone(currentItem()); copy.id = `${copy.id}-copy`; copy.title += "（副本）"; currentProject().items.splice(state.item + 1, 0, copy); state.item += 1; }
    if (action === "resume-add") { draft.pages.resume.sections.push({ id: `section-${Date.now()}`, title: "新分区", type: "paragraph", body: "填写内容。", items: [] }); state.resumeSection = draft.pages.resume.sections.length - 1; }
    if (action === "resume-delete" && draft.pages.resume.sections.length && window.confirm("确定删除当前简历分区吗？")) { draft.pages.resume.sections.splice(state.resumeSection, 1); state.resumeSection = Math.max(0, state.resumeSection - 1); }
    if (action === "resume-move") state.resumeSection = moveInList(draft.pages.resume.sections, state.resumeSection, Number(button.dataset.direction));
    normalizeSelection();
    checkpoint();
    renderAll();
    updatePreview();
  }

  document.addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-select-page]");
    if (pageButton) { state.page = pageButton.dataset.selectPage; renderAll(); updatePreview(); return; }
    const projectButton = event.target.closest("[data-select-project]");
    if (projectButton) { state.project = Number(projectButton.dataset.selectProject); state.item = 0; renderAll(); updatePreview(); return; }
    const itemButton = event.target.closest("[data-select-item]");
    if (itemButton) { state.item = Number(itemButton.dataset.selectItem); renderAll(); updatePreview(); return; }
    const resumeButton = event.target.closest("[data-select-resume]");
    if (resumeButton) { state.resumeSection = Number(resumeButton.dataset.selectResume); renderAll(); return; }
    const viewport = event.target.closest("[data-viewport]");
    if (viewport) {
      document.querySelectorAll("[data-viewport]").forEach((button) => button.classList.toggle("active", button === viewport));
      applyPreviewViewport(viewport.dataset.viewport);
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) handleAction(action);
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-path]");
    if (!input) return;
    const path = JSON.parse(input.dataset.path);
    const value = input.type === "checkbox" ? input.checked : input.dataset.number !== undefined ? Number(input.value) : input.value;
    setAt(path, value);
    if (input.type === "range") {
      input.parentElement.querySelectorAll("[data-path]").forEach((peer) => { if (peer !== input) peer.value = input.value; });
    }
    updatePreview();
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-path]")) {
      checkpoint();
      if (event.target.tagName === "SELECT") renderInspector();
    }
    if (event.target.matches("[data-upload-path]")) uploadFile(event.target);
    if (event.target.matches("[data-import]")) importBackup(event.target);
  });

  window.addEventListener("beforeunload", (event) => {
    if (draft && snapshot() !== savedSnapshot) { event.preventDefault(); event.returnValue = ""; }
  });

  async function init() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取网站内容");
      draft = await response.json();
      savedSnapshot = snapshot();
      history = [savedSnapshot];
      historyIndex = 0;
      renderAll();
      applyPreviewViewport();
      updatePreview();
    } catch (error) {
      dom.inspector.innerHTML = `<h1>编辑器未连接</h1><p class="lead">请关闭这个页面，然后双击 website 文件夹里的 start-editor.cmd。编辑器需要本地服务来安全保存文件和上传素材。</p><p class="note">${escapeHtml(error.message)}</p>`;
      dom.saveState.textContent = "未连接";
    }
  }

  window.addEventListener("resize", () => applyPreviewViewport());
  if (window.ResizeObserver) new ResizeObserver(() => applyPreviewViewport()).observe(dom.previewStage);
  init();
})();
