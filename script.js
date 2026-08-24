let portfolioContent = window.PORTFOLIO_CONTENT;
try {
  const previewContent = sessionStorage.getItem("portfolio-preview-content");
  if (previewContent) portfolioContent = JSON.parse(previewContent);
} catch (error) {
  console.warn("无法读取编辑器预览内容，已显示上次保存的版本。", error);
}

window.PortfolioSimulator.prepare(portfolioContent);
window.PortfolioRenderer.render(portfolioContent);
window.PortfolioSimulator.install(portfolioContent);
document.body.classList.toggle("is-preview-mode", portfolioContent !== window.PORTFOLIO_CONTENT);

const appConfig = Object.fromEntries(
  Object.entries(portfolioContent.pages).map(([id, page]) => [
    id,
    {
      label: page.taskLabel || page.label,
      width: Number(page.window?.width) || 720,
      height: Number(page.window?.height) || 630,
    },
  ]),
);

const shortcuts = Array.from(document.querySelectorAll("[data-app]"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));
const desktopShell = document.querySelector(".desktop-shell");
const taskList = document.querySelector("[data-task-list]");
const startButton = document.querySelector("[data-start-button]");
const startMenu = document.querySelector("[data-start-menu]");
const startAppButtons = document.querySelectorAll("[data-start-app]");
const shutdownButton = document.querySelector("[data-start-action='shutdown']");
const shutdownScreen = document.querySelector("[data-shutdown-screen]");
const shutdownPrompt = document.querySelector("[data-shutdown-prompt]");
const shutdownComplete = document.querySelector("[data-shutdown-complete]");
const shutdownConfirm = document.querySelector("[data-shutdown-confirm]");
const shutdownCancel = document.querySelector("[data-shutdown-cancel]");
const restartButton = document.querySelector("[data-restart]");
const clock = document.querySelector("[data-clock]");
const filterButtons = document.querySelectorAll(".filter-button");
const workCards = document.querySelectorAll(".work-card");
const projectTabs = document.querySelectorAll("[data-project-tab]");
const projectPanels = document.querySelectorAll("[data-project-panel]");
const projectOpeners = document.querySelectorAll("[data-project-open]");
const workDetailBackButtons = document.querySelectorAll("[data-work-detail-back]");
const workStepButtons = document.querySelectorAll("[data-work-prev], [data-work-next]");
const compactQuery = window.matchMedia("(max-width: 900px)");

const windowStates = new Map(
  panels.map((panel) => [
    panel.dataset.panel,
    {
      open: false,
      minimized: false,
      maximized: false,
      z: 10,
      openedAt: 0,
    },
  ]),
);

let activeApp = null;
let currentProject = "index";
let currentWorkId = null;
let zCounter = 10;
let openedCounter = 0;
let dragState = null;
let resizeFrame = 0;
const projectSelections = new Map();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function getPanel(app) {
  return panels.find((panel) => panel.dataset.panel === app);
}

function isCompactMode() {
  return compactQuery.matches;
}

function positionWindow(app, force = false) {
  const panel = getPanel(app);
  const config = appConfig[app];
  if (!panel || !config) return;

  if (isCompactMode()) {
    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("width");
    panel.style.removeProperty("height");
    delete panel.dataset.positioned;
    return;
  }

  const availableHeight = window.innerHeight - 34;
  const horizontalMargin = app === "works" ? 64 : 160;
  const width = Math.min(config.width, Math.max(320, window.innerWidth - horizontalMargin));
  const height = Math.min(config.height, Math.max(240, availableHeight - (app === "works" ? 48 : 72)));

  if (!force && panel.dataset.positioned === "true") {
    const currentLeft = Number.parseFloat(panel.style.left) || 0;
    const currentTop = Number.parseFloat(panel.style.top) || 0;
    panel.style.left = `${clamp(currentLeft, 0, window.innerWidth - width)}px`;
    panel.style.top = `${clamp(currentTop, 0, availableHeight - 30)}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    return;
  }

  const offset = { home: 0, works: 0, resume: 22, contact: -18 }[app] || 0;
  const left = Math.round((window.innerWidth - width) / 2 + offset);
  const top = app === "works"
    ? 24
    : Math.max(28, Math.round((availableHeight - height) / 2));

  panel.style.left = `${clamp(left, 0, window.innerWidth - width)}px`;
  panel.style.top = `${clamp(top, 0, availableHeight - 30)}px`;
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
  panel.dataset.positioned = "true";
}

function layoutWindows(force = false) {
  Object.keys(appConfig).forEach((app) => positionWindow(app, force));
}

function applyWindowState() {
  panels.forEach((panel) => {
    const app = panel.dataset.panel;
    const state = windowStates.get(app);
    const visible = state.open && !state.minimized;
    panel.classList.remove("active");
    panel.classList.toggle("is-open", state.open);
    panel.classList.toggle("is-minimized", state.minimized);
    panel.classList.toggle("is-maximized", state.maximized);
    panel.classList.toggle("is-active", visible && (activeApp === app || app === "simulator"));
    panel.setAttribute("aria-hidden", String(!visible));
    panel.style.zIndex = String(state.z);

    const maximizeButton = panel.querySelector("[data-window-action='maximize']");
    if (maximizeButton) {
      maximizeButton.disabled = isCompactMode();
      maximizeButton.setAttribute(
        "aria-label",
        isCompactMode() ? "移动端窗口已最大化" : state.maximized ? "还原" : "最大化",
      );
      maximizeButton.classList.toggle("is-restore", state.maximized);
    }
  });

}

function renderTaskbar() {
  if (!taskList) return;
  const openApps = Array.from(windowStates.entries())
    .filter(([, state]) => state.open)
    .sort(([, a], [, b]) => a.openedAt - b.openedAt);

  const buttons = openApps.map(([app, state]) => {
    const button = document.createElement("button");
    const isSimulator = app === "simulator";
    const isActive = isSimulator ? !state.minimized : activeApp === app && !state.minimized;
    button.type = "button";
    button.className = "task-button";
    button.dataset.taskApp = app;
    button.textContent = appConfig[app].label;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.addEventListener("click", () => {
      if ((isSimulator && !state.minimized) || (!isSimulator && activeApp === app && !state.minimized)) {
        minimizeWindow(app);
      } else {
        restoreWindow(app);
      }
    });
    return button;
  });

  taskList.replaceChildren(...buttons);
}

function selectShortcut(app) {
  const nextSelectedApp = appConfig[app] ? app : null;
  shortcuts.forEach((button) => {
    const selected = button.dataset.app === nextSelectedApp;
    button.classList.remove("active");
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function syncRoute(historyMode = "replace") {
  const route = activeApp
    ? activeApp === "works" && currentProject !== "index"
      ? currentWorkId
        ? `#works/${currentProject}/${currentWorkId}`
        : `#works/${currentProject}`
      : `#${activeApp}`
    : "#desktop";

  if (location.hash !== route) {
    history[historyMode === "push" ? "pushState" : "replaceState"](null, "", route);
  }
}

function getTopVisibleApp(excludeApp = null) {
  return Array.from(windowStates.entries())
    .filter(([app, state]) => app !== "simulator" && app !== excludeApp && state.open && !state.minimized)
    .sort(([, a], [, b]) => b.z - a.z)[0]?.[0] || null;
}

function focusWindow(app, updateRoute = true, historyMode = "replace") {
  const state = windowStates.get(app);
  if (!state?.open || state.minimized) return;

  if (app === "simulator") {
    applyWindowState();
    renderTaskbar();
    return;
  }

  activeApp = app;
  state.z = ++zCounter;
  applyWindowState();
  renderTaskbar();
  if (updateRoute) syncRoute(historyMode);
}

function openWindow(app, options = {}) {
  const state = windowStates.get(app);
  if (!state) return;

  if (app === "simulator") {
    if (!state.open) {
      state.open = true;
      state.openedAt = ++openedCounter;
    }
    state.minimized = false;
    applyWindowState();
    renderTaskbar();
    selectShortcut(app);
    closeStartMenu();
    return;
  }

  if (app === "works") {
    const requestedWorkId = Object.prototype.hasOwnProperty.call(options, "workId")
      ? options.workId
      : currentWorkId;
    showProject(options.project || currentProject, {
      updateRoute: false,
      workId: requestedWorkId || null,
      openDetail: Boolean(requestedWorkId),
    });
  }

  if (!state.open) {
    state.open = true;
    state.openedAt = ++openedCounter;
    positionWindow(app);
  }

  state.minimized = false;
  focusWindow(app, options.updateRoute !== false, options.historyMode || "replace");
  selectShortcut(app);
  closeStartMenu();
}

function minimizeWindow(app) {
  const state = windowStates.get(app);
  if (!state?.open) return;
  state.minimized = true;

  if (activeApp === app) {
    activeApp = getTopVisibleApp(app);
    if (activeApp) windowStates.get(activeApp).z = ++zCounter;
  }

  applyWindowState();
  renderTaskbar();
  syncRoute();
}

function restoreWindow(app) {
  const state = windowStates.get(app);
  if (!state?.open) {
    openWindow(app);
    return;
  }
  state.minimized = false;
  focusWindow(app);
  selectShortcut(app);
}

function toggleMaximize(app) {
  const state = windowStates.get(app);
  if (!state?.open || isCompactMode()) return;
  state.maximized = !state.maximized;
  focusWindow(app);
}

function closeWindow(app) {
  const state = windowStates.get(app);
  if (!state?.open) return;
  state.open = false;
  state.minimized = false;
  state.maximized = false;

  if (activeApp === app) {
    activeApp = getTopVisibleApp(app);
    if (activeApp) windowStates.get(activeApp).z = ++zCounter;
  }

  applyWindowState();
  renderTaskbar();
  syncRoute();
}

function getVisibleWorkCards(projectPanel) {
  return Array.from(projectPanel?.querySelectorAll(".work-card") || [])
    .filter((card) => !card.classList.contains("hidden"));
}

function updateWorkNavigation(projectPanel) {
  if (!projectPanel) return;
  const visibleCards = getVisibleWorkCards(projectPanel);
  const selectedId = projectSelections.get(projectPanel.dataset.projectPanel);
  const selectedIndex = visibleCards.findIndex((card) => card.dataset.workId === selectedId);
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const position = projectPanel.querySelector("[data-work-position]");
  if (position) position.textContent = visibleCards.length ? `${safeIndex + 1} / ${visibleCards.length}` : "0 / 0";

  projectPanel.querySelectorAll("[data-work-prev]").forEach((button) => {
    button.disabled = visibleCards.length < 2 || safeIndex <= 0;
  });
  projectPanel.querySelectorAll("[data-work-next]").forEach((button) => {
    button.disabled = visibleCards.length < 2 || safeIndex >= visibleCards.length - 1;
  });
}

function showProject(project, options = {}) {
  const {
    updateRoute = true,
    historyMode = "replace",
    workId = null,
    openDetail = Boolean(workId),
  } = options;
  const hasProject = Array.from(projectPanels).some((panel) => panel.dataset.projectPanel === project);
  currentProject = hasProject ? project : "index";
  currentWorkId = null;

  projectTabs.forEach((button) => {
    const isActive = button.dataset.projectTab === currentProject;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  projectPanels.forEach((panel) => {
    panel.hidden = panel.dataset.projectPanel !== currentProject;
    if (panel.dataset.projectPanel !== currentProject) panel.classList.remove("is-detail-open");
  });

  const activeProjectPanel = Array.from(projectPanels)
    .find((panel) => panel.dataset.projectPanel === currentProject);
  if (activeProjectPanel && currentProject !== "index") {
    const requestedCard = workId
      ? activeProjectPanel.querySelector(`.work-card[data-work-id="${CSS.escape(workId)}"]`)
      : null;
    const rememberedId = projectSelections.get(currentProject);
    const rememberedCard = rememberedId
      ? activeProjectPanel.querySelector(`.work-card[data-work-id="${CSS.escape(rememberedId)}"]`)
      : null;
    const selectedCard = requestedCard || rememberedCard || activeProjectPanel.querySelector(".work-card");
    if (selectedCard) {
      selectWorkCard(selectedCard, { updateRoute: false, openDetail: openDetail && Boolean(requestedCard) });
      currentWorkId = requestedCard?.dataset.workId || null;
    }
    activeProjectPanel.classList.toggle("is-detail-open", openDetail && Boolean(requestedCard));
    updateWorkNavigation(activeProjectPanel);
  }

  if (updateRoute && activeApp === "works") syncRoute(historyMode);
}

function selectWorkCard(card, options = {}) {
  const {
    updateRoute = true,
    historyMode = "push",
    openDetail = isCompactMode(),
    focusDetail = openDetail && isCompactMode(),
    scrollCard = !isCompactMode(),
  } = options;
  if (!card || card.classList.contains("hidden")) return;

  const projectPanel = card.closest("[data-project-panel]");
  const projectCards = projectPanel?.querySelectorAll(".work-card") || workCards;
  const detailMedia = projectPanel?.querySelector("[data-work-detail-media]");
  const detailKicker = projectPanel?.querySelector("[data-work-detail-kicker]");
  const detailTitle = projectPanel?.querySelector("[data-work-detail-title]");
  const detailText = projectPanel?.querySelector("[data-work-detail-text]");

  projectCards.forEach((item) => {
    const isActive = item === card;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });

  const projectId = projectPanel?.dataset.projectPanel;
  if (projectId) projectSelections.set(projectId, card.dataset.workId);

  const sourceFigure = card.querySelector("template[data-work-detail-template]")?.content.querySelector("figure")
    || card.querySelector("figure");
  const sourceKicker = card.querySelector(":scope > div span");
  const sourceTitle = card.querySelector("h3");
  const sourceText = card.querySelector("p");

  if (detailMedia && sourceFigure) {
    detailMedia.querySelectorAll("video").forEach((video) => video.pause());
    detailMedia.className = `work-detail-media ${sourceFigure.className || ""}`.trim();
    detailMedia.innerHTML = sourceFigure.innerHTML;
    detailMedia.style.cssText = sourceFigure.style.cssText;
    const detailScale = sourceFigure.style.getPropertyValue("--media-detail-scale");
    if (detailScale) detailMedia.style.setProperty("--media-scale", detailScale);
    const rosterDetailScale = sourceFigure.style.getPropertyValue("--roster-detail-scale");
    if (rosterDetailScale) detailMedia.style.setProperty("--roster-scale", rosterDetailScale);
    const actionDetailScale = sourceFigure.style.getPropertyValue("--action-detail-scale");
    if (actionDetailScale) detailMedia.style.setProperty("--action-scale", actionDetailScale);
    detailMedia.querySelectorAll("video").forEach((video) => {
      video.controls = true;
      video.removeAttribute("aria-hidden");
    });
    window.PortfolioRenderer.activateMedia(detailMedia);
  }

  if (detailKicker && sourceKicker) detailKicker.textContent = sourceKicker.textContent;
  if (detailTitle && sourceTitle) detailTitle.textContent = sourceTitle.textContent;
  if (detailText && sourceText) detailText.textContent = sourceText.textContent;

  if (openDetail && projectPanel) {
    const worksBrowser = projectPanel.closest(".works-browser");
    if (!projectPanel.classList.contains("is-detail-open") && worksBrowser) {
      projectPanel.dataset.galleryScrollTop = String(worksBrowser.scrollTop);
    }
    projectPanel.classList.add("is-detail-open");
    if (worksBrowser && isCompactMode()) worksBrowser.scrollTop = 0;
  }

  if (projectId === currentProject && updateRoute && activeApp === "works") {
    currentWorkId = card.dataset.workId;
    syncRoute(historyMode);
  }

  updateWorkNavigation(projectPanel);
  if (scrollCard) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  if (focusDetail && detailTitle) {
    detailTitle.tabIndex = -1;
    window.requestAnimationFrame(() => detailTitle.focus({ preventScroll: true }));
  }
}

function closeWorkDetail(projectPanel, historyMode = "replace") {
  if (!projectPanel) return;
  projectPanel.classList.remove("is-detail-open");
  currentWorkId = null;
  if (activeApp === "works") syncRoute(historyMode);

  const worksBrowser = projectPanel.closest(".works-browser");
  const savedScrollTop = Number(projectPanel.dataset.galleryScrollTop) || 0;
  window.requestAnimationFrame(() => {
    if (worksBrowser) worksBrowser.scrollTop = savedScrollTop;
    const selectedId = projectSelections.get(projectPanel.dataset.projectPanel);
    projectPanel.querySelector(`.work-card[data-work-id="${CSS.escape(selectedId || "")}"]`)?.focus({ preventScroll: true });
  });
}

function stepWork(projectPanel, direction) {
  const visibleCards = getVisibleWorkCards(projectPanel);
  if (!visibleCards.length) return;
  const selectedId = projectSelections.get(projectPanel.dataset.projectPanel);
  const currentIndex = Math.max(0, visibleCards.findIndex((card) => card.dataset.workId === selectedId));
  const nextIndex = clamp(currentIndex + direction, 0, visibleCards.length - 1);
  if (nextIndex === currentIndex) return;
  selectWorkCard(visibleCards[nextIndex], {
    historyMode: "replace",
    openDetail: projectPanel.classList.contains("is-detail-open") || isCompactMode(),
    focusDetail: false,
  });
}

function updateVisibleWorkCount(projectPanel) {
  const fileCount = projectPanel?.querySelector(".file-count");
  const projectCards = projectPanel?.querySelectorAll(".work-card") || [];
  if (!fileCount) return;
  const visibleCount = Array.from(projectCards).filter((card) => !card.classList.contains("hidden")).length;
  fileCount.textContent = `${visibleCount} 项`;
}

function setStartMenu(open) {
  if (!startMenu || !startButton) return;
  startMenu.hidden = !open;
  startButton.setAttribute("aria-expanded", String(open));
  if (open) startMenu.querySelector("button")?.focus();
}

function closeStartMenu() {
  setStartMenu(false);
}

function openShutdownDialog() {
  if (!shutdownScreen) return;
  closeStartMenu();
  desktopShell?.classList.remove("is-shut-down");
  shutdownPrompt.hidden = false;
  shutdownComplete.hidden = true;
  shutdownScreen.hidden = false;
  shutdownCancel?.focus();
}

function closeShutdownDialog() {
  if (!shutdownScreen || desktopShell?.classList.contains("is-shut-down")) return;
  shutdownScreen.hidden = true;
  startButton?.focus();
}

function completeShutdown() {
  desktopShell?.classList.add("is-shut-down");
  shutdownPrompt.hidden = true;
  shutdownComplete.hidden = false;
  restartButton?.focus();
}

function updateClock() {
  if (!clock) return;
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  clock.dateTime = now.toISOString();
  clock.title = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "short" }).format(now);
}

function beginDrag(event, panel) {
  const app = panel.dataset.panel;
  const state = windowStates.get(app);
  if (event.button !== 0 || isCompactMode() || state?.maximized || event.target.closest(".win-controls")) return;

  focusWindow(app);
  const rect = panel.getBoundingClientRect();
  dragState = {
    panel,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  document.body.classList.add("is-dragging");
  event.preventDefault();
}

function moveDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { panel, startX, startY, left, top } = dragState;
  const nextLeft = left + event.clientX - startX;
  const nextTop = top + event.clientY - startY;
  const maxLeft = window.innerWidth - panel.offsetWidth;
  const maxTop = window.innerHeight - 34 - 30;
  panel.style.left = `${clamp(nextLeft, 0, maxLeft)}px`;
  panel.style.top = `${clamp(nextTop, 0, maxTop)}px`;
  panel.dataset.positioned = "true";
}

function endDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState = null;
  document.body.classList.remove("is-dragging");
}

function showRouteFromHash() {
  const [rawApp = "home", project = "index", workId = null] = location.hash.replace("#", "").split("/");
  const app = rawApp === "projects" ? "works" : rawApp;
  if (appConfig[app]) {
    openWindow(app, { project: project || "index", workId, updateRoute: false });
  } else if (!location.hash || location.hash === "#desktop") {
    if (!location.hash) openWindow("home", { updateRoute: false });
    else {
      applyWindowState();
      renderTaskbar();
    }
  } else {
    openWindow("home", { updateRoute: false });
  }
}

shortcuts.forEach((button) => {
  const app = button.dataset.app;
  button.addEventListener("click", () => {
    openWindow(app, { historyMode: "push" });
  });
  button.addEventListener("dblclick", () => openWindow(app));
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openWindow(app);
    } else if (event.key === " ") {
      event.preventDefault();
      selectShortcut(app);
    }
  });
});

panels.forEach((panel) => {
  const app = panel.dataset.panel;
  panel.addEventListener("pointerdown", () => focusWindow(app));

  const titlebar = panel.querySelector("[data-drag-handle]");
  titlebar?.addEventListener("pointerdown", (event) => beginDrag(event, panel));
  titlebar?.addEventListener("dblclick", (event) => {
    if (!event.target.closest(".win-controls")) toggleMaximize(app);
  });

  panel.querySelectorAll("[data-window-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.windowAction;
      if (action === "minimize") minimizeWindow(app);
      if (action === "maximize") toggleMaximize(app);
      if (action === "close") closeWindow(app);
    });
  });
});

startButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setStartMenu(startMenu?.hidden ?? true);
});

startAppButtons.forEach((button) => {
  button.addEventListener("click", () => openWindow(button.dataset.startApp, { historyMode: "push" }));
});

shutdownButton?.addEventListener("click", openShutdownDialog);
shutdownCancel?.addEventListener("click", closeShutdownDialog);
shutdownConfirm?.addEventListener("click", completeShutdown);
restartButton?.addEventListener("click", () => location.reload());

projectTabs.forEach((button) => {
  button.addEventListener("click", () => showProject(button.dataset.projectTab, { historyMode: "push" }));
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs = Array.from(projectTabs);
    const nextIndex = (tabs.indexOf(button) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    showProject(tabs[nextIndex].dataset.projectTab, { historyMode: "push" });
  });
});

projectOpeners.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showProject(link.dataset.projectOpen, { historyMode: "push" });
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    const projectPanel = button.closest("[data-project-panel]");
    const localFilters = projectPanel?.querySelectorAll(".filter-button") || [];
    const localCards = projectPanel?.querySelectorAll(".work-card") || [];
    localFilters.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    localCards.forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("hidden", !shouldShow);
    });

    updateVisibleWorkCount(projectPanel);
    const selectedId = projectSelections.get(projectPanel?.dataset.projectPanel);
    const selectedCard = Array.from(localCards).find((card) => card.dataset.workId === selectedId);
    const fallbackCard = Array.from(localCards).find((card) => !card.classList.contains("hidden"));
    if (selectedCard && !selectedCard.classList.contains("hidden")) {
      updateWorkNavigation(projectPanel);
    } else if (fallbackCard) {
      selectWorkCard(fallbackCard, {
        updateRoute: Boolean(currentWorkId),
        historyMode: "replace",
        openDetail: projectPanel?.classList.contains("is-detail-open"),
        focusDetail: false,
      });
    }
    projectPanel?.querySelector(".work-grid")?.scrollTo({ left: 0, behavior: "smooth" });
  });
});

workCards.forEach((card) => {
  card.tabIndex = -1;
  card.setAttribute("role", "option");
  card.setAttribute("aria-selected", "false");
  card.addEventListener("click", () => {
    card.focus({ preventScroll: true });
    selectWorkCard(card);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectWorkCard(card);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      stepWork(card.closest("[data-project-panel]"), direction);
    }
  });
});

workDetailBackButtons.forEach((button) => {
  button.addEventListener("click", () => closeWorkDetail(button.closest("[data-project-panel]")));
});

workStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stepWork(button.closest("[data-project-panel]"), button.hasAttribute("data-work-prev") ? -1 : 1);
  });
});

document.addEventListener("pointermove", moveDrag);
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".start-menu, .start-button")) closeStartMenu();
  if (!event.target.closest(".desktop-icon, .win98-window, .taskbar, .start-menu")) selectShortcut(null);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (shutdownScreen && !shutdownScreen.hidden) closeShutdownDialog();
  else closeStartMenu();
});

window.addEventListener("hashchange", showRouteFromHash);
window.addEventListener("popstate", showRouteFromHash);
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    layoutWindows(true);
    applyWindowState();
    const activeProjectPanel = Array.from(projectPanels)
      .find((panel) => panel.dataset.projectPanel === currentProject);
    if (activeProjectPanel) activeProjectPanel.classList.toggle("is-detail-open", isCompactMode() && Boolean(currentWorkId));
  });
});

projectPanels.forEach((panel) => {
  if (panel.dataset.projectPanel === "index") return;
  updateVisibleWorkCount(panel);
  selectWorkCard(panel.querySelector(".work-card"), {
    updateRoute: false,
    openDetail: false,
    focusDetail: false,
    scrollCard: false,
  });
});
updateClock();
window.setInterval(updateClock, 30_000);
layoutWindows(true);
showRouteFromHash();
