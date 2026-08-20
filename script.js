const appNames = {
  home: "个人简介",
  works: "作品",
  resume: "简历",
  contact: "联系",
};

const shortcuts = document.querySelectorAll("[data-app]");
const panels = document.querySelectorAll("[data-panel]");
const desktopShell = document.querySelector(".desktop-shell");
const taskButton = document.querySelector("[data-task-button]");
const filterButtons = document.querySelectorAll(".filter-button");
const workCards = document.querySelectorAll(".work-card");
const fileCount = document.querySelector(".file-count");
const detailMedia = document.querySelector("[data-work-detail-media]");
const detailKicker = document.querySelector("[data-work-detail-kicker]");
const detailTitle = document.querySelector("[data-work-detail-title]");
const detailText = document.querySelector("[data-work-detail-text]");
const projectTabs = document.querySelectorAll("[data-project-tab]");
const projectPanels = document.querySelectorAll("[data-project-panel]");
const projectOpeners = document.querySelectorAll("[data-project-open]");
let currentProject = "index";

function showProject(project, updateHash = true) {
  const hasProject = Array.from(projectPanels).some((panel) => panel.dataset.projectPanel === project);
  currentProject = hasProject ? project : "index";

  projectTabs.forEach((button) => {
    const isActive = button.dataset.projectTab === currentProject;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  projectPanels.forEach((panel) => {
    panel.hidden = panel.dataset.projectPanel !== currentProject;
  });

  if (updateHash && desktopShell?.dataset.currentApp === "works") {
    const route = currentProject === "index" ? "#works" : `#works/${currentProject}`;
    history.replaceState(null, "", route);
  }
}

function showApp(app, project = "index") {
  const requestedApp = app === "projects" ? "works" : app;
  const nextApp = appNames[requestedApp] ? requestedApp : "home";

  if (nextApp === "works") {
    showProject(project, false);
  }

  if (desktopShell) {
    desktopShell.dataset.currentApp = nextApp;
  }

  shortcuts.forEach((button) => {
    const isActive = button.dataset.app === nextApp;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === nextApp);
  });

  if (taskButton) {
    taskButton.textContent = appNames[nextApp];
  }

  const route = nextApp === "works" && currentProject !== "index"
    ? `#works/${currentProject}`
    : `#${nextApp}`;
  history.replaceState(null, "", route);
}

function selectWorkCard(card) {
  if (!card || card.classList.contains("hidden")) return;

  workCards.forEach((item) => {
    const isActive = item === card;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });

  const sourceFigure = card.querySelector("figure");
  const sourceKicker = card.querySelector(":scope > div span");
  const sourceTitle = card.querySelector("h3");
  const sourceText = card.querySelector("p");

  if (detailMedia && sourceFigure) {
    detailMedia.className = `work-detail-media ${sourceFigure.className || ""}`.trim();
    detailMedia.innerHTML = sourceFigure.innerHTML;
  }

  if (detailKicker && sourceKicker) detailKicker.textContent = sourceKicker.textContent;
  if (detailTitle && sourceTitle) detailTitle.textContent = sourceTitle.textContent;
  if (detailText && sourceText) detailText.textContent = sourceText.textContent;
}

function updateVisibleWorkCount() {
  if (!fileCount) return;

  const visibleCount = Array.from(workCards).filter((card) => !card.classList.contains("hidden")).length;
  fileCount.textContent = `${visibleCount} items`;
}

shortcuts.forEach((button) => {
  button.addEventListener("click", () => showApp(button.dataset.app));
});

if (taskButton) {
  taskButton.addEventListener("click", () => {
    const active = document.querySelector(".desktop-icon.active");
    showApp(active?.dataset.app || "home", currentProject);
  });
}

projectTabs.forEach((button) => {
  button.addEventListener("click", () => showProject(button.dataset.projectTab));
});

projectOpeners.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showProject(link.dataset.projectOpen);
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    workCards.forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("hidden", !shouldShow);
    });

    updateVisibleWorkCount();
    selectWorkCard(Array.from(workCards).find((card) => !card.classList.contains("hidden")));
  });
});

workCards.forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");

  card.addEventListener("click", () => selectWorkCard(card));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectWorkCard(card);
    }
  });
});

updateVisibleWorkCount();
selectWorkCard(workCards[0]);

function showRouteFromHash() {
  const [app = "home", project = "index"] = location.hash.replace("#", "").split("/");
  showApp(app || "home", project || "index");
}

window.addEventListener("hashchange", showRouteFromHash);
showRouteFromHash();
