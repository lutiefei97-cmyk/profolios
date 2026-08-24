(function () {
  "use strict";

  const PAGE_ORDER = ["home", "works", "resume", "contact"];
  const rosterImageCache = new Map();
  const activeRosterSprites = new Set();
  let rosterAnimationFrame = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeHref(value) {
    const href = String(value ?? "").trim();
    return /^(mailto:|tel:|https?:|#)/i.test(href) ? href : "";
  }

  function pageWindow(id, page, body, bodyClass = "win-body") {
    return `
      <article class="win98-window" data-panel="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title" tabindex="-1">
        <header class="win-titlebar" data-drag-handle>
          <span id="${escapeHtml(id)}-title">${escapeHtml(page.windowTitle || page.label)}</span>
          <div class="win-controls" role="group" aria-label="窗口控制">
            <button class="win-control win-minimize" type="button" data-window-action="minimize" aria-label="最小化"></button>
            <button class="win-control win-maximize" type="button" data-window-action="maximize" aria-label="最大化"></button>
            <button class="win-control win-close" type="button" data-window-action="close" aria-label="关闭"></button>
          </div>
        </header>
        <div class="${bodyClass}">${body}</div>
      </article>`;
  }

  function mediaStyle(media) {
    const settings = media?.settings || {};
    const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return [
      `--media-scale:${numeric(settings.scale, 1)}`,
      `--media-detail-scale:${numeric(settings.detailScale, settings.scale || 1)}`,
      `--media-x:${numeric(settings.x, 50)}%`,
      `--media-y:${numeric(settings.y, 50)}%`,
      `--card-media-height:${numeric(settings.cardHeight, 94)}px`,
      `--media-padding:${numeric(settings.padding, 8)}px`,
      `--media-bg:${escapeHtml(settings.background || "#111610")}`,
      `--media-fit:${["contain", "cover", "fill", "none", "scale-down"].includes(settings.fit) ? settings.fit : "contain"}`,
      `--roster-scale:${numeric(settings.spriteScale, 1.25)}`,
      `--roster-detail-scale:${numeric(settings.detailSpriteScale, settings.spriteScale || 1.25)}`,
      `--action-scale:${numeric(settings.actionScale, 1.2)}`,
      `--action-detail-scale:${numeric(settings.detailActionScale, settings.actionScale || 1.2)}`,
      `--collection-columns:${Math.max(1, Math.min(4, numeric(settings.columns, 4)))}`,
    ].join(";");
  }

  function mediaClass(media, detail = false) {
    const typeClass = {
      layers: "scene-preview",
      gallery: "habitat-board",
      proof: "system-proof",
      flow: "system-map",
      roster: "bird-roster-board",
      actionLibrary: "bird-action-board",
      paletteShowcase: "palette-showcase-board",
      uiPair: "ui-pair-board",
      artCollection: "art-collection-board",
      cardPair: "reward-card-board",
      redesignComparison: "redesign-comparison-board",
      habitatGrowth: "habitat-growth-board",
      video: "video-board",
    }[media?.type] || "";
    return [detail ? "work-detail-media" : "", typeClass, media?.settings?.pixelated ? "pixelated" : "smooth-media"]
      .filter(Boolean)
      .join(" ");
  }

  function rosterActionAttributes(action) {
    const palette = action?.palette || {};
    const randomRows = Array.isArray(palette.randomRows) ? palette.randomRows.join(",") : palette.randomRows;
    const fileVariants = Array.isArray(action?.fileVariants) ? action.fileVariants.join("|") : action?.fileVariants;
    return [
      `data-roster-sprite`,
      action?.src ? `data-src="${escapeHtml(action.src)}"` : "",
      action?.pattern ? `data-pattern="${escapeHtml(action.pattern)}"` : "",
      action?.fileSrc ? `data-file-src="${escapeHtml(action.fileSrc)}"` : "",
      fileVariants ? `data-file-variants="${escapeHtml(fileVariants)}"` : "",
      `data-frame-count="${Math.max(1, Number(action?.frameCount) || 1)}"`,
      `data-frame-size="${Math.max(1, Number(action?.frameSize) || 64)}"`,
      `data-frame-ms="${Math.max(60, Number(action?.frameMs) || 140)}"`,
      action?.frameDigits ? `data-frame-digits="${Number(action.frameDigits)}"` : "",
      palette.src ? `data-palette-src="${escapeHtml(palette.src)}"` : "",
      palette.cols ? `data-palette-cols="${Number(palette.cols)}"` : "",
      palette.rows ? `data-palette-rows="${Number(palette.rows)}"` : "",
      Number.isFinite(Number(palette.row)) ? `data-palette-row="${Number(palette.row)}"` : "",
      randomRows ? `data-palette-random-rows="${escapeHtml(randomRows)}"` : "",
      palette.paletteMs ? `data-palette-ms="${Number(palette.paletteMs)}"` : "",
      Number.isFinite(Number(action?.scale)) ? `data-display-scale="${Number(action.scale)}"` : "",
      action?.bounds ? `data-bound-x="${Number(action.bounds.x)}" data-bound-y="${Number(action.bounds.y)}" data-bound-width="${Number(action.bounds.width)}" data-bound-height="${Number(action.bounds.height)}"` : "",
    ].filter(Boolean).join(" ");
  }

  function renderRosterAction(action, role, actionLabel, speciesName) {
    return `<div class="bird-roster-action bird-roster-${role}">
      <div class="bird-roster-stage"><canvas ${rosterActionAttributes(action)} width="1" height="1" role="img" aria-label="${escapeHtml(`${speciesName}${role === "adult" ? "成鸟唱歌" : "雏鸟乞食"}动画`)}"></canvas></div>
    </div>`;
  }

  function renderRoster(media) {
    const entries = Array.isArray(media.entries) ? media.entries : [];
    const cover = media.preview?.src
      ? `<img class="bird-roster-cover" src="${escapeHtml(media.preview.src)}" alt="${escapeHtml(media.preview.alt || media.label || "角色设计总览")}" />`
      : "";
    return `${cover}<div class="bird-roster-content">
      <header class="bird-roster-heading"><strong>${escapeHtml(media.heading || "角色设计 · 12 个物种")}</strong></header>
      <div class="bird-roster-grid">${entries.map((entry) => `<section class="bird-roster-entry" data-roster-id="${escapeHtml(entry.id)}">
        <h4>${escapeHtml(entry.name)}<small>${escapeHtml(entry.spec || `${entry.adult?.frameSize || 64}px 动作画布`)}</small></h4>
        <div class="bird-roster-pair">${renderRosterAction(entry.adult, "adult", "唱歌", entry.name)}${renderRosterAction(entry.chick, "chick", "乞食", entry.name)}</div>
      </section>`).join("")}</div>
    </div>`;
  }

  function renderActionLibrary(media) {
    const actions = Array.isArray(media.actions) ? media.actions : [];
    const cover = media.preview?.src ? `<img class="bird-action-cover" src="${escapeHtml(media.preview.src)}" alt="${escapeHtml(media.preview.alt || media.heading || "玄凤动作库")}" />` : "";
    return `${cover}<div class="bird-action-content">
      <header><strong>${escapeHtml(media.heading || "玄凤鹦鹉动作设计")}</strong><span>${escapeHtml(media.caption || `${actions.length} 组循环动作`)}</span></header>
      <div class="bird-action-grid" style="--action-columns:${Math.max(2, Number(media.columns) || 4)}">${actions.map((action) => `<section class="bird-action-item">
        <div class="bird-action-stage"><canvas ${rosterActionAttributes(action)} width="1" height="1" role="img" aria-label="${escapeHtml(`${media.heading || "玄凤鹦鹉"}：${action.name}`)}"></canvas></div>
        <span>${escapeHtml(action.name)}</span>
      </section>`).join("")}</div>
    </div>`;
  }

  function renderPaletteShowcase(media) {
    const species = Array.isArray(media.species) ? media.species : [];
    const cover = `<div class="palette-showcase-cover">${species.map((item) => `<img src="${escapeHtml(item.matrix?.src)}" alt="" />`).join("")}</div>`;
    return `${cover}<div class="palette-showcase-content">
      <header><strong>${escapeHtml(media.heading || "三种鸟类 · 配色方案矩阵")}</strong><span>${escapeHtml(media.caption || "动作中随机切换代表配色")}</span></header>
      <div class="palette-species-grid">${species.map((item) => `<section class="palette-species-card">
        <h4>${escapeHtml(item.name)}</h4>
        <div class="palette-matrix-stage"><img src="${escapeHtml(item.matrix?.src)}" alt="${escapeHtml(item.matrix?.alt || `${item.name}配色方案矩阵`)}" /></div>
        <div class="palette-motion-stage"><canvas ${rosterActionAttributes(item.action)} width="1" height="1" role="img" aria-label="${escapeHtml(`${item.name}随机换色动作动画`)}"></canvas></div>
      </section>`).join("")}</div>
    </div>`;
  }

  function renderCaptionedAssets(media) {
    return (media.assets || []).map((asset) => `<div class="media-asset-card">
      <div class="media-asset-stage"><img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" /></div>
      ${asset.caption ? `<span>${escapeHtml(asset.caption)}</span>` : ""}
    </div>`).join("");
  }

  function renderRedesignComparison(media) {
    const assets = Array.isArray(media.assets) ? media.assets : [];
    const pairs = [];
    for (let index = 0; index < assets.length; index += 2) pairs.push(assets.slice(index, index + 2));
    const cover = media.preview?.src
      ? `<img class="redesign-comparison-cover" src="${escapeHtml(media.preview.src)}" alt="${escapeHtml(media.preview.alt || "角色设计改进总览")}" />`
      : "";
    return `${cover}<div class="redesign-comparison-content">${pairs.map((pair) => `<section class="redesign-species">
      <h4>${escapeHtml(pair[0]?.species || "角色设计")}</h4>
      <div class="redesign-pair">${pair.map((asset) => `<div class="redesign-version">
        <span>${escapeHtml(asset.version || "")}</span>
        <div class="redesign-image-stage"><img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt || `${asset.species || "角色"}${asset.version || ""}`)}" /></div>
      </div>`).join("")}</div>
    </section>`).join("")}</div>`;
  }

  function renderHabitatGrowth(media) {
    const assets = Array.isArray(media.assets) ? media.assets : [];
    const splitAt = Math.max(1, Math.min(assets.length, Number(media.sequenceStart) || assets.length));
    const facilities = assets.slice(0, splitAt);
    const sequence = assets.slice(splitAt);
    return `<div class="habitat-assets">${facilities.map((asset) => `<div class="habitat-asset"><img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" />${asset.caption ? `<span>${escapeHtml(asset.caption)}</span>` : ""}</div>`).join("")}</div>
      ${sequence.length ? `<section class="kauri-growth"><header><strong>${escapeHtml(media.sequenceTitle || "贝壳杉生长序列")}</strong><span>${escapeHtml(media.sequenceCaption || "幼苗 → 幼树 → 成树")}</span></header><div>${sequence.map((asset, index) => `<figure><img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" style="--asset-scale:${Number(asset.scale) || 1}" /><figcaption>${escapeHtml(asset.caption || `阶段 ${index + 1}`)}</figcaption></figure>`).join("")}</div></section>` : ""}`;
  }

  function renderMedia(media, detail = false) {
    const item = media || { type: "image", assets: [] };
    const assets = Array.isArray(item.assets) ? item.assets : [];
    let inner = "";

    if (item.type === "roster") {
      inner = renderRoster(item);
    } else if (item.type === "actionLibrary") {
      inner = renderActionLibrary(item);
    } else if (item.type === "paletteShowcase") {
      inner = renderPaletteShowcase(item);
    } else if (["uiPair", "artCollection", "cardPair"].includes(item.type)) {
      inner = renderCaptionedAssets(item);
    } else if (item.type === "redesignComparison") {
      inner = renderRedesignComparison(item);
    } else if (item.type === "habitatGrowth") {
      inner = renderHabitatGrowth(item);
    } else if (item.type === "video") {
      inner = assets.map((asset) => `<video preload="metadata" playsinline aria-hidden="true" aria-label="${escapeHtml(asset.alt || "作品演示视频")}"${asset.poster ? ` poster="${escapeHtml(asset.poster)}"` : ""}>
        <source src="${escapeHtml(asset.src)}" type="${escapeHtml(asset.mimeType || "video/mp4")}" />
        您的浏览器不支持 HTML5 视频。
      </video>`).join("");
    } else if (item.type === "proof") {
      inner = `${assets.map((asset) => `<img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" />`).join("")}
        <ul>${(item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`;
    } else if (item.type === "flow") {
      inner = (item.steps || []).map((step, index, steps) =>
        `<div>${escapeHtml(step)}</div>${index < steps.length - 1 ? "<span aria-hidden=\"true\">→</span>" : ""}`
      ).join("");
    } else {
      inner = assets.map((asset) => `<img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.alt)}" />`).join("");
    }

    return `<figure class="${mediaClass(item, detail)}" style="${mediaStyle(item)}"${item.label ? ` aria-label="${escapeHtml(item.label)}"` : ""}>${inner}</figure>`;
  }

  function renderWorkThumbnail(media) {
    const item = media || { type: "image", assets: [] };
    const preview = item.preview?.src;
    const firstAsset = Array.isArray(item.assets) ? item.assets[0] : null;
    const poster = firstAsset?.poster;

    if (preview || poster) {
      const source = preview || poster;
      const alt = item.preview?.alt || firstAsset?.alt || item.label || "作品缩略图";
      return `<figure class="${mediaClass(item)} work-card-thumbnail" style="${mediaStyle(item)}"><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" /></figure>`;
    }

    return renderMedia(item);
  }

  function loadRosterImage(src) {
    if (!rosterImageCache.has(src)) {
      rosterImageCache.set(src, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load roster asset: ${src}`));
        image.src = src;
      }));
    }
    return rosterImageCache.get(src);
  }

  function recolorRosterFrame(frame, paletteImage, palette) {
    const context = frame.getContext("2d", { willReadFrequently: true });
    const source = context.getImageData(0, 0, frame.width, frame.height);
    const paletteCanvas = document.createElement("canvas");
    paletteCanvas.width = paletteImage.naturalWidth;
    paletteCanvas.height = paletteImage.naturalHeight;
    const paletteContext = paletteCanvas.getContext("2d", { willReadFrequently: true });
    paletteContext.drawImage(paletteImage, 0, 0);
    const palettePixels = paletteContext.getImageData(0, 0, paletteCanvas.width, paletteCanvas.height).data;
    const cols = Math.min(palette.cols, paletteCanvas.width);
    const row = Math.max(0, Math.min(palette.rows - 1, palette.row));
    const paletteY = Math.max(0, paletteCanvas.height - 1 - row);

    for (let offset = 0; offset < source.data.length; offset += 4) {
      if (!source.data[offset + 3]) continue;
      const index = Math.max(0, Math.min(cols - 1, Math.round((source.data[offset] / 255) * (cols - 1))));
      const paletteOffset = ((paletteY * paletteCanvas.width) + index) * 4;
      source.data[offset] = palettePixels[paletteOffset];
      source.data[offset + 1] = palettePixels[paletteOffset + 1];
      source.data[offset + 2] = palettePixels[paletteOffset + 2];
      source.data[offset + 3] = Math.round((source.data[offset + 3] * palettePixels[paletteOffset + 3]) / 255);
    }
    context.putImageData(source, 0, 0);
  }

  function rosterFrameBounds(frames) {
    let left = frames[0].width;
    let top = frames[0].height;
    let right = 0;
    let bottom = 0;
    frames.forEach((frame) => {
      const pixels = frame.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, frame.width, frame.height).data;
      for (let y = 0; y < frame.height; y += 1) {
        for (let x = 0; x < frame.width; x += 1) {
          if (pixels[((y * frame.width) + x) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
    });
    return right > left && bottom > top
      ? { x: left, y: top, width: right - left, height: bottom - top }
      : { x: 0, y: 0, width: frames[0].width, height: frames[0].height };
  }

  async function prepareRosterSprite(canvas) {
    if (canvas.dataset.rosterReady) return;
    canvas.dataset.rosterReady = "loading";
    const count = Math.max(1, Number(canvas.dataset.frameCount) || 1);
    const size = Math.max(1, Number(canvas.dataset.frameSize) || 64);
    const digits = Math.max(1, Number(canvas.dataset.frameDigits) || 1);
    const fileVariants = String(canvas.dataset.fileVariants || "").split("|").filter(Boolean);
    const useFileVariants = window.location.protocol === "file:" && fileVariants.length > 0;
    const useFileFallback = window.location.protocol === "file:" && Boolean(canvas.dataset.fileSrc) && !useFileVariants;
    const usesSequence = Boolean(canvas.dataset.pattern) && !useFileFallback && !useFileVariants;
    const sources = useFileVariants
      ? fileVariants
      : usesSequence
      ? Array.from({ length: count }, (_, index) => canvas.dataset.pattern.replace("{frame}", String(index + 1).padStart(digits, "0")))
      : [useFileFallback ? canvas.dataset.fileSrc : canvas.dataset.src];
    const sourceImages = await Promise.all(sources.map(loadRosterImage));
    const palette = canvas.dataset.paletteSrc && !useFileFallback && !useFileVariants ? {
      image: await loadRosterImage(canvas.dataset.paletteSrc),
      cols: Math.max(1, Number(canvas.dataset.paletteCols) || 1),
      rows: Math.max(1, Number(canvas.dataset.paletteRows) || 1),
      row: Math.max(0, Number(canvas.dataset.paletteRow) || 0),
    } : null;
    const randomRows = String(canvas.dataset.paletteRandomRows || "").split(",").map(Number).filter(Number.isFinite);
    const createFrames = (sourceSetIndex = 0, paletteRow = palette?.row) => Array.from({ length: count }, (_, index) => {
      const frame = document.createElement("canvas");
      frame.width = size;
      frame.height = size;
      const context = frame.getContext("2d", { willReadFrequently: true });
      context.imageSmoothingEnabled = false;
      const source = usesSequence ? sourceImages[index] : sourceImages[sourceSetIndex];
      const sourceX = usesSequence ? 0 : index * size;
      const sourceWidth = Math.max(1, Math.min(size, source.naturalWidth - sourceX));
      const sourceHeight = Math.max(1, Math.min(size, source.naturalHeight));
      context.drawImage(source, sourceX, 0, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      if (palette) recolorRosterFrame(frame, palette.image, { ...palette, row: paletteRow });
      return frame;
    });
    const frameSets = useFileVariants
      ? sourceImages.map((_, index) => createFrames(index))
      : palette && randomRows.length
        ? randomRows.map((row) => createFrames(0, row))
        : [createFrames()];
    const frames = frameSets[0];
    const configuredBounds = ["boundX", "boundY", "boundWidth", "boundHeight"].every((key) => Number.isFinite(Number(canvas.dataset[key])))
      ? { x: Number(canvas.dataset.boundX), y: Number(canvas.dataset.boundY), width: Number(canvas.dataset.boundWidth), height: Number(canvas.dataset.boundHeight) }
      : null;
    const bounds = configuredBounds || rosterFrameBounds(frames);
    const actionMedia = canvas.closest(".bird-action-board, .palette-showcase-board");
    const scaleProperty = actionMedia ? "--action-scale" : "--roster-scale";
    const requestedScale = Math.max(.5, Number(canvas.dataset.displayScale) || Number.parseFloat(getComputedStyle(canvas).getPropertyValue(scaleProperty)) || 1.25);
    const stage = canvas.closest(".bird-roster-stage, .bird-action-stage, .palette-motion-stage");
    const availableWidth = Math.max(1, stage?.clientWidth || bounds.width * requestedScale);
    const availableHeight = Math.max(1, stage?.clientHeight || bounds.height * requestedScale);
    const scale = Math.min(requestedScale, availableWidth / bounds.width, availableHeight / bounds.height);
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    canvas.style.width = `${Math.round(bounds.width * scale)}px`;
    canvas.style.height = `${Math.round(bounds.height * scale)}px`;
    canvas.dataset.rosterReady = "ready";
    const state = {
      canvas,
      frames,
      frameSets,
      bounds,
      frameMs: Math.max(60, Number(canvas.dataset.frameMs) || 140),
      paletteMs: Math.max(0, Number(canvas.dataset.paletteMs) || 0),
      paletteIndex: 0,
      lastPaletteChange: 0,
      lastFrame: -1,
    };
    activeRosterSprites.add(state);
    drawRosterFrame(state, 0);
    startRosterAnimation();
  }

  function drawRosterFrame(state, index) {
    const context = state.canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, state.canvas.width, state.canvas.height);
    context.drawImage(state.frames[index], state.bounds.x, state.bounds.y, state.bounds.width, state.bounds.height, 0, 0, state.bounds.width, state.bounds.height);
    state.lastFrame = index;
  }

  function startRosterAnimation() {
    if (rosterAnimationFrame) return;
    const tick = (time) => {
      activeRosterSprites.forEach((state) => {
        if (!state.canvas.isConnected) {
          activeRosterSprites.delete(state);
          return;
        }
        if (state.paletteMs && state.frameSets.length > 1 && time - state.lastPaletteChange >= state.paletteMs) {
          let next = Math.floor(Math.random() * state.frameSets.length);
          if (next === state.paletteIndex) next = (next + 1) % state.frameSets.length;
          state.paletteIndex = next;
          state.frames = state.frameSets[next];
          state.lastPaletteChange = time;
          state.lastFrame = -1;
        }
        const index = Math.floor(time / state.frameMs) % state.frames.length;
        if (index !== state.lastFrame) drawRosterFrame(state, index);
      });
      rosterAnimationFrame = activeRosterSprites.size ? requestAnimationFrame(tick) : 0;
    };
    rosterAnimationFrame = requestAnimationFrame(tick);
  }

  function activateMedia(root = document) {
    root.querySelectorAll?.("canvas[data-roster-sprite]").forEach((canvas) => {
      prepareRosterSprite(canvas).catch(() => {
        canvas.dataset.rosterReady = "failed";
        canvas.closest(".bird-roster-stage, .bird-action-stage, .palette-motion-stage")?.classList.add("is-unavailable");
      });
    });
  }

  function renderHome(page) {
    const avatars = page.avatars || [];
    return pageWindow("home", page, `
      <section class="profile-card">
        <div class="profile-avatar${avatars.length === 1 ? " profile-avatar-single" : ""}" aria-hidden="true">${avatars.map((src) => `<img src="${escapeHtml(src)}" alt="" />`).join("")}</div>
        <div><p class="label">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.name)}</h1><p class="summary">${escapeHtml(page.summary)}</p></div>
      </section>
      <section class="home-spec"><h2>${escapeHtml(page.directionTitle)}</h2><ul>${(page.directions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      <div class="home-status">${(page.statuses || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      <footer class="window-footer"><strong>${escapeHtml(page.footer?.title)}</strong><a href="mailto:${escapeHtml(page.footer?.email)}">${escapeHtml(page.footer?.email)}</a><span>${escapeHtml(page.footer?.wechat)}</span></footer>
    `);
  }

  function renderProjectCard(project, index) {
    const facts = (project.facts || []).map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("");
    return `<a class="project-card project-card-link" href="#works/${escapeHtml(project.id)}" data-project-open="${escapeHtml(project.id)}">
      <figure class="project-card-preview"><img src="${escapeHtml(project.cover?.src)}" alt="${escapeHtml(project.cover?.alt)}" /></figure>
      <div><span>${escapeHtml(project.badge)}</span><h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.summary)}</p><strong class="project-enter">${escapeHtml(index.enterLabel)}</strong></div>
      <dl>${facts}</dl>
    </a>`;
  }

  function renderWorkCard(item) {
    const width = ["standard", "wide", "full"].includes(item.width) ? item.width : "standard";
    const special = ["proof", "flow"].includes(item.media?.type) ? " proof-card" : "";
    return `<article class="work-card ${width}${special}" style="${mediaStyle(item.media)}" data-work-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.category)}">
      ${renderWorkThumbnail(item.media)}
      <div><span>${escapeHtml(item.kicker)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>
      <template data-work-detail-template>${renderMedia(item.media)}</template>
    </article>`;
  }

  function renderProjectPanel(project) {
    return `<section class="works-project-panel works-project-detail" id="project-${escapeHtml(project.id)}" role="tabpanel" data-project-panel="${escapeHtml(project.id)}" hidden>
      <div class="window-heading"><div><p class="label">${escapeHtml(project.detailEyebrow)}</p><h2>${escapeHtml(project.detailTitle)}</h2></div><span class="file-count">${(project.items || []).length} 项</span></div>
      <section class="work-detail" aria-live="polite" aria-label="当前选中的作品详情">
        <header class="work-detail-nav">
          <button class="work-detail-back" type="button" data-work-detail-back>← 返回作品列表</button>
          <div class="work-detail-pager" aria-label="作品翻页">
            <button type="button" data-work-prev aria-label="上一项作品">‹</button>
            <span data-work-position>1 / ${(project.items || []).length}</span>
            <button type="button" data-work-next aria-label="下一项作品">›</button>
          </div>
        </header>
        <figure class="work-detail-media pixelated" data-work-detail-media></figure>
        <div class="work-detail-copy"><span class="work-detail-kicker" data-work-detail-kicker>项目总览</span><h3 data-work-detail-title>${escapeHtml(project.title)}</h3><p data-work-detail-text>${escapeHtml(project.summary)}</p></div>
      </section>
      <div class="filters" aria-label="作品筛选">${(project.categories || []).map((category, index) => `<button class="filter-button${index === 0 ? " active" : ""}" type="button" data-filter="${escapeHtml(category.id)}" aria-pressed="${index === 0}">${escapeHtml(category.label)}</button>`).join("")}</div>
      <div class="work-browser-controls">
        <button class="work-rail-arrow" type="button" data-work-prev aria-label="上一项作品">‹</button>
        <div class="work-grid" role="listbox" aria-label="项目作品">${(project.items || []).map(renderWorkCard).join("")}</div>
        <button class="work-rail-arrow" type="button" data-work-next aria-label="下一项作品">›</button>
      </div>
    </section>`;
  }

  function renderWorks(page) {
    const projects = page.projects || [];
    const tabs = `<button class="project-tab active" type="button" role="tab" data-project-tab="index" aria-controls="project-index" aria-selected="true">${escapeHtml(page.index?.tabLabel)}</button>` +
      projects.map((project) => `<button class="project-tab" type="button" role="tab" data-project-tab="${escapeHtml(project.id)}" aria-controls="project-${escapeHtml(project.id)}" aria-selected="false">${escapeHtml(project.tabLabel)}</button>`).join("");
    const indexPanel = `<section class="works-project-panel works-project-index" id="project-index" role="tabpanel" data-project-panel="index">
      <div class="window-heading"><div><p class="label">${escapeHtml(page.index?.eyebrow)}</p><h2>${escapeHtml(page.index?.title)}</h2><p>${escapeHtml(page.index?.description)}</p></div><span class="project-count">${projects.length} project${projects.length === 1 ? "" : "s"}</span></div>
      <div class="project-list">${projects.map((project) => renderProjectCard(project, page.index || {})).join("")}</div>
    </section>`;
    return pageWindow("works", page, `<nav class="works-project-tabs" role="tablist" aria-label="作品项目">${tabs}</nav>${indexPanel}${projects.map(renderProjectPanel).join("")}`, "works-browser");
  }

  function renderResumeSection(section) {
    let content = `<p>${escapeHtml(section.body)}</p>`;
    if (section.type === "list") content = `<ul>${(section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    if (section.type === "timeline") content = `<ol>${(section.items || []).map((item) => `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span></li>`).join("")}</ol>`;
    return `<section class="resume-section" data-resume-section="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${content}</section>`;
  }

  function renderResume(page) {
    return pageWindow("resume", page, `<header class="resume-header"><p class="label">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1></header><div class="resume-grid">${(page.sections || []).map(renderResumeSection).join("")}</div>`);
  }

  function renderContact(page) {
    const channels = (page.channels || []).map((channel) => {
      const content = `<strong>${escapeHtml(channel.label)}</strong><br />${escapeHtml(channel.value)}`;
      const href = safeHref(channel.href);
      return href ? `<a href="${escapeHtml(href)}">${content}</a>` : `<div>${content}</div>`;
    }).join("");
    return pageWindow("contact", page, `<section class="contact-panel"><div><p class="label">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p></div><div class="contact-list">${channels}</div></section>`);
  }

  function renderStartMenu(content) {
    const pages = content.pages || {};
    return `<aside class="start-menu" data-start-menu hidden aria-label="开始菜单">
      <div class="start-menu-brand">${escapeHtml(content.site?.brand)}</div>
      <div class="start-menu-items">${PAGE_ORDER.filter((id) => pages[id]).map((id) => {
        const page = pages[id];
        return `<button type="button" data-start-app="${id}"><img src="${escapeHtml(page.icon)}" alt="" /><span><strong>${escapeHtml(page.label)}</strong><small>${escapeHtml(page.startDescription)}</small></span></button>`;
      }).join("")}<hr /><button type="button" data-start-action="shutdown"><span class="shutdown-icon">⏻</span><span><strong>关闭系统</strong><small>结束本次浏览</small></span></button></div>
    </aside>`;
  }

  function applyTheme(content) {
    const theme = content.site?.theme || {};
    const root = document.documentElement;
    const vars = {
      "--portfolio-desktop": theme.desktop,
      "--portfolio-titlebar": theme.titlebar,
      "--portfolio-window-face": theme.windowFace,
      "--portfolio-paper": theme.paper,
      "--portfolio-accent": theme.accent,
      "--portfolio-media-bg": theme.mediaBackground,
      "--portfolio-font-scale": Number(theme.fontScale) || 1,
    };
    Object.entries(vars).forEach(([name, value]) => value !== undefined && root.style.setProperty(name, value));
  }

  function render(content) {
    if (!content?.site || !content?.pages) throw new Error("Portfolio content is incomplete.");
    const root = document.querySelector("[data-portfolio-root]");
    if (!root) throw new Error("Portfolio root was not found.");
    document.title = content.site.title || "Portfolio";
    document.querySelector('meta[name="description"]')?.setAttribute("content", content.site.description || "");
    root.setAttribute("aria-label", content.site.desktopLabel || "作品集");
    applyTheme(content);

    const pages = content.pages;
    root.innerHTML = `
      <div class="desktop-bg" aria-hidden="true">${(content.site.background || []).map((layer) => `<img class="${escapeHtml(layer.className)}" src="${escapeHtml(layer.src)}" alt="" />`).join("")}</div>
      <nav class="desktop-icons" aria-label="桌面快捷方式">${PAGE_ORDER.filter((id) => pages[id]).map((id) => `<button class="desktop-icon" type="button" data-app="${id}" aria-pressed="false"><span class="icon-frame"><img src="${escapeHtml(pages[id].icon)}" alt="" /></span><span>${escapeHtml(pages[id].label)}</span></button>`).join("")}</nav>
      <section class="window-area" aria-live="polite">${renderHome(pages.home)}${renderWorks(pages.works)}${renderResume(pages.resume)}${renderContact(pages.contact)}</section>
      <div class="bird-strip" aria-hidden="true">${(content.site.decorations || []).map((bird) => `<img${bird.wide ? ' class="bird-strip-wide"' : ""} src="${escapeHtml(bird.src)}" alt="${escapeHtml(bird.alt)}" />`).join("")}</div>
      ${renderStartMenu(content)}
      <div class="shutdown-overlay" data-shutdown-screen hidden><section class="shutdown-dialog" data-shutdown-prompt><h2>关闭系统</h2><p>确定要结束本次作品集浏览吗？</p><div><button type="button" data-shutdown-confirm>确定</button><button type="button" data-shutdown-cancel>取消</button></div></section><section class="shutdown-complete" data-shutdown-complete hidden><p>现在可以安全地关闭这个窗口。</p><button type="button" data-restart>重新启动</button></section></div>
      <footer class="taskbar"><button class="start-button" type="button" data-start-button aria-expanded="false"><span class="start-logo">▦</span>${escapeHtml(content.site.startLabel || "开始")}</button><div class="task-list" data-task-list></div><time class="task-clock" data-clock></time></footer>`;
    window.__PORTFOLIO_CONTENT__ = content;
  }

  window.PortfolioRenderer = { render, renderMedia, activateMedia, escapeHtml };
})();
