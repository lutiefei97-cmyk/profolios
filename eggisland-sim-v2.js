(function () {
  "use strict";

  const APP_ID = "simulator";
  const MAX_FOOD = 18;
  const SENSE_RADIUS = 430;
  const IMAGE_LOAD_TIMEOUT_MS = 12_000;
  const BUNDLE_LOAD_TIMEOUT_MS = 8_000;
  let bundlePromise = null;
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function loadAssetBundle(version) {
    if (window.EGGISLAND_SIM_ASSETS) return Promise.resolve(true);
    if (bundlePromise) return bundlePromise;
    bundlePromise = new Promise((resolve) => {
      const script = document.createElement("script");
      let settled = false;
      const finish = (available) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(available);
      };
      const timeoutId = window.setTimeout(() => finish(false), BUNDLE_LOAD_TIMEOUT_MS);
      script.async = true;
      script.src = `./assets/simulator/bundle.js?v=${encodeURIComponent(version || "current")}`;
      script.onload = () => finish(Boolean(window.EGGISLAND_SIM_ASSETS));
      script.onerror = () => finish(false);
      document.head.append(script);
    });
    return bundlePromise;
  }

  function prepare(content) {
    if (!content?.site || !content?.pages) return;
    content.site.background = [];
    content.site.decorations = [];
    content.pages[APP_ID] = {
      label: "蛋岛模拟器",
      taskLabel: "蛋岛模拟器",
      icon: "./assets/ui/icon-bird.png",
      startDescription: "在桌面底部唤醒蛋岛鸟群",
      window: { width: 1280, height: 576 },
    };
  }

  function simulatorPanel() {
    return `
      <article class="win98-window simulator-window" data-panel="${APP_ID}" tabindex="-1"
        aria-label="蛋岛鸟群模拟场景。点击空白处可撒下粟。">
        <canvas width="1280" height="576" data-simulator-canvas></canvas>
        <div class="simulator-input" role="button" tabindex="0" data-simulator-input
          aria-label="点击场景空白处撒下粟"></div>
        <div class="simulator-loading" data-simulator-loading>正在载入游戏原始素材…</div>
        <p class="simulator-hint" data-simulator-hint>点击场景空白处撒下粟 · 桌面快捷方式仍可使用</p>
        <span class="simulator-live" data-simulator-live aria-live="polite"></span>
      </article>`;
  }

  function install(content) {
    const root = document.querySelector("[data-portfolio-root]");
    const windowArea = root?.querySelector(".window-area");
    const iconNav = root?.querySelector(".desktop-icons");
    const startItems = root?.querySelector(".start-menu-items");
    if (!root || !windowArea || !iconNav || !startItems || root.dataset.simulatorInstalled === "true") return;

    root.dataset.simulatorInstalled = "true";
    root.querySelector(".desktop-bg")?.remove();
    root.querySelector(".bird-strip")?.remove();
    const page = content.pages[APP_ID];
    const icon = document.createElement("button");
    icon.className = "desktop-icon";
    icon.type = "button";
    icon.dataset.app = APP_ID;
    icon.setAttribute("aria-pressed", "false");
    icon.innerHTML = `<span class="icon-frame"><img src="${page.icon}" alt="" /></span><span>${page.label}</span>`;
    iconNav.append(icon);

    windowArea.insertAdjacentHTML("beforebegin", simulatorPanel());

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.dataset.startApp = APP_ID;
    startButton.innerHTML = `<img src="${page.icon}" alt="" /><span><strong>${page.label}</strong><small>${page.startDescription}</small></span>`;
    startItems.querySelector("hr")?.before(startButton);

    const panel = root.querySelector(`[data-panel="${APP_ID}"]`);
    if (panel) new EggIslandSimulation(panel);
  }

  class EggIslandSimulation {
    constructor(panel) {
      this.panel = panel;
      panel.__eggislandSimulation = this;
      this.root = panel.closest("[data-portfolio-root]");
      this.canvas = panel.querySelector("[data-simulator-canvas]");
      this.input = panel.querySelector("[data-simulator-input]");
      this.context = this.canvas.getContext("2d", { alpha: true });
      this.loading = panel.querySelector("[data-simulator-loading]");
      this.hint = panel.querySelector("[data-simulator-hint]");
      this.live = panel.querySelector("[data-simulator-live]");
      this.manifest = window.EGGISLAND_SIM_MANIFEST;
      this.images = new Map();
      this.birds = [];
      this.food = [];
      this.selectedBird = null;
      this.loaded = false;
      this.loadingStarted = false;
      this.running = false;
      this.frameRequest = 0;
      this.lastTime = 0;
      this.context.imageSmoothingEnabled = false;

      this.input.addEventListener("pointerdown", (event) => this.dropFood(event));
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.dropFoodAt(this.canvas.width / 2, this.canvas.height * 0.45);
        }
      });
      this.panel.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        document.querySelector(`[data-task-app="${APP_ID}"]`)?.click();
      });

      this.visibilityObserver = new MutationObserver(() => this.syncVisibility());
      this.visibilityObserver.observe(panel, { attributes: true, attributeFilter: ["class"] });
      document.addEventListener("visibilitychange", () => this.syncVisibility());
      this.syncVisibility();
    }

    async load() {
      if (this.loaded || this.loadingStarted) return;
      this.loadingStarted = true;
      if (!this.manifest) {
        this.fail("缺少游戏素材清单");
        return;
      }

      const sources = new Set([
        ...Object.values(this.manifest.scene).filter((value) => typeof value === "string"),
        this.manifest.food,
        this.manifest.hud.base,
      ]);
      for (const crop of this.manifest.scene.crops) sources.add(crop.src);
      for (const species of this.manifest.species) {
        Object.values(species.actions).forEach((action) => sources.add(action.src));
      }

      try {
        await loadAssetBundle(this.manifest.version);
        let completed = 0;
        const total = sources.size;
        await Promise.all([...sources].map(async (source) => {
          this.images.set(source, await this.loadImage(source));
          completed += 1;
          this.loading.textContent = `正在载入游戏原始素材… ${completed}/${total}`;
        }));
        this.createBirds();
        this.loaded = true;
        this.loading.hidden = true;
        window.setTimeout(() => this.hint.classList.add("is-dismissed"), 4500);
        this.draw();
        this.syncVisibility();
      } catch (error) {
        console.error("蛋岛模拟器素材载入失败", error);
        this.fail(`游戏素材载入失败：${error.message}`);
      }
    }

    loadImage(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          image.onload = null;
          image.onerror = null;
          callback(value);
        };
        const timeoutId = window.setTimeout(
          () => finish(reject, new Error(`载入超时：${source}`)),
          IMAGE_LOAD_TIMEOUT_MS,
        );
        image.decoding = "async";
        image.onload = () => finish(resolve, image);
        image.onerror = () => finish(reject, new Error(`无法载入：${source}`));
        const bundledSource = window.EGGISLAND_SIM_ASSETS?.[source];
        if (bundledSource) {
          image.src = bundledSource;
          return;
        }
        const separator = source.includes("?") ? "&" : "?";
        image.src = `${source}${separator}v=${this.manifest.version}`;
      });
    }

    fail(message) {
      this.loading.textContent = message;
      this.loading.classList.add("is-error");
    }

    createBirds() {
      const margin = 42;
      const usableWidth = this.canvas.width - margin * 2;
      this.birds = this.manifest.species.map((species, index) => ({
        species,
        x: margin + usableWidth * (index / (this.manifest.species.length - 1)) + randomBetween(-14, 14),
        y: this.manifest.groundY - (index % 3) * 3,
        facingRight: index % 2 === 0,
        action: "idle",
        actionTime: randomBetween(0, 1),
        state: "idle",
        stateTime: randomBetween(0.5, 3.2),
        targetX: null,
        targetFood: null,
        flight: null,
        fullness: 0.72 + (index % 3) * 0.08,
        mood: 0.68 + (index % 4) * 0.06,
        growth: 1,
        sex: index % 2 === 0 ? "male" : "female",
      }));
    }

    setAction(bird, action) {
      if (bird.action === action) return;
      bird.action = action;
      bird.actionTime = 0;
    }

    update(delta) {
      for (const item of this.food) {
        if (!item.landed) {
          item.velocity += 720 * delta;
          item.y += item.velocity * delta;
          item.rotation += item.spin * delta;
          if (item.y >= item.groundY) {
            item.y = item.groundY;
            item.landed = true;
          }
        }
      }

      for (const bird of this.birds) {
        bird.actionTime += delta;
        this.updateBird(bird, delta);
      }
    }

    updateBird(bird, delta) {
      if (bird.state === "eat") {
        bird.stateTime -= delta;
        if (bird.stateTime <= 0) this.enterIdle(bird, randomBetween(0.8, 2.2));
        return;
      }

      if (bird.state === "fly") {
        const flight = bird.flight;
        flight.elapsed += delta;
        const progress = clamp(flight.elapsed / flight.duration, 0, 1);
        bird.x = flight.startX + (flight.endX - flight.startX) * progress;
        bird.y = this.manifest.groundY - Math.sin(Math.PI * progress) * flight.height;
        if (progress >= 1) {
          bird.y = this.manifest.groundY;
          bird.flight = null;
          this.enterIdle(bird, randomBetween(1, 3));
        }
        return;
      }

      const nearbyFood = this.findFoodFor(bird);
      if (nearbyFood && bird.targetFood !== nearbyFood) this.reserveFood(bird, nearbyFood);

      if (bird.targetFood) {
        const item = bird.targetFood;
        if (!this.food.includes(item)) {
          bird.targetFood = null;
          this.enterIdle(bird, 0.2);
          return;
        }
        if (!item.landed) {
          this.enterIdle(bird, 0.15, true);
          return;
        }
        this.walkToward(bird, item.x, delta);
        if (Math.abs(item.x - bird.x) <= 14) this.beginEating(bird, item);
        return;
      }

      if (bird.state === "walk") {
        this.walkToward(bird, bird.targetX, delta);
        if (Math.abs(bird.targetX - bird.x) <= 2) this.enterIdle(bird, randomBetween(0.8, 3.2));
        return;
      }

      bird.stateTime -= delta;
      if (bird.stateTime > 0) return;
      if (Math.random() < 0.12) {
        this.beginFlight(bird);
      } else {
        bird.state = "walk";
        bird.targetX = clamp(bird.x + randomBetween(-220, 220), 28, this.canvas.width - 28);
        this.setAction(bird, "walk");
      }
    }

    findFoodFor(bird) {
      let best = null;
      let distance = Infinity;
      for (const item of this.food) {
        if (!item.landed || (item.reservedBy && item.reservedBy !== bird)) continue;
        if (!item.reservedBy) {
          const nearestBird = this.birds
            .filter((candidate) => candidate.state !== "eat" && candidate.state !== "fly" && !candidate.targetFood)
            .sort((a, b) => Math.abs(item.x - a.x) - Math.abs(item.x - b.x))[0];
          if (nearestBird !== bird) continue;
        }
        const candidateDistance = Math.abs(item.x - bird.x);
        if (candidateDistance <= SENSE_RADIUS && candidateDistance < distance) {
          best = item;
          distance = candidateDistance;
        }
      }
      return best;
    }

    reserveFood(bird, item) {
      if (bird.targetFood?.reservedBy === bird) bird.targetFood.reservedBy = null;
      bird.targetFood = item;
      item.reservedBy = bird;
      bird.state = "seek";
      this.setAction(bird, "walk");
    }

    walkToward(bird, x, delta) {
      const distance = x - bird.x;
      bird.facingRight = distance > 0;
      bird.x += Math.sign(distance) * Math.min(Math.abs(distance), bird.species.walkSpeed * delta);
      bird.y = this.manifest.groundY;
      this.setAction(bird, "walk");
    }

    beginEating(bird, item) {
      this.food = this.food.filter((candidate) => candidate !== item);
      bird.targetFood = null;
      bird.state = "eat";
      const eat = bird.species.actions.eat;
      bird.stateTime = Math.max(0.9, (eat.frames / eat.fps) * 1.8);
      this.setAction(bird, "eat");
      this.live.textContent = `${bird.species.label}吃掉了一穗粟`;
    }

    beginFlight(bird) {
      const endX = clamp(bird.x + randomBetween(-340, 340), 35, this.canvas.width - 35);
      bird.facingRight = endX > bird.x;
      bird.state = "fly";
      bird.flight = {
        startX: bird.x,
        endX,
        elapsed: 0,
        duration: randomBetween(2.2, 3.3),
        height: randomBetween(90, 170),
      };
      this.setAction(bird, "fly");
    }

    enterIdle(bird, duration, keepFood = false) {
      bird.state = "idle";
      bird.stateTime = duration;
      bird.targetX = null;
      if (!keepFood && bird.targetFood?.reservedBy === bird) bird.targetFood.reservedBy = null;
      if (!keepFood) bird.targetFood = null;
      this.setAction(bird, "idle");
    }

    dropFood(event) {
      if (!this.loaded || event.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
      const selected = [...this.birds].reverse().find((bird) => this.isBirdHit(bird, x, y));
      if (selected) {
        this.selectedBird = selected;
        this.hint.classList.add("is-dismissed");
        this.live.textContent = `已选中${selected.species.label}`;
        return;
      }
      this.selectedBird = null;
      if (this.isOccupied(x, y)) return;
      this.dropFoodAt(x, y);
    }

    isBirdHit(bird, x, y) {
      const half = bird.species.frameSize * 0.36;
      return Math.abs(x - bird.x) < half && y > bird.y - bird.species.frameSize && y < bird.y + 6;
    }

    isOccupied(x, y) {
      const tree = this.manifest.scene.treeRect;
      if (x >= tree[0] && x <= tree[0] + tree[2] && y >= tree[1] && y <= tree[1] + tree[3]) return true;
      return false;
    }

    dropFoodAt(x, y) {
      if (!this.loaded) return;
      if (this.food.length >= MAX_FOOD) this.food.shift();
      this.food.push({
        x: clamp(x, 16, this.canvas.width - 16),
        y: Math.min(y, this.manifest.groundY - 70),
        groundY: this.manifest.groundY + randomBetween(-2, 3),
        velocity: randomBetween(40, 90),
        spin: randomBetween(-7, 7),
        rotation: randomBetween(-1, 1),
        landed: false,
        reservedBy: null,
      });
      this.hint.classList.add("is-dismissed");
      this.live.textContent = `撒下粟，地面共有 ${this.food.length} 穗`;
    }

    draw() {
      const context = this.context;
      const scene = this.manifest.scene;
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      context.drawImage(this.images.get(scene.world), 0, 0);
      context.drawImage(this.images.get(scene.farmland), 0, 0);
      context.drawImage(this.images.get(scene.facilitiesUnder), 0, 0);
      this.drawFood(context);
      const renderables = [];
      for (const crop of scene.crops) {
        for (const [x, y] of crop.positions) renderables.push({ type: "crop", crop, x, y });
      }
      for (const bird of this.birds) renderables.push({ type: "bird", bird, y: bird.y });
      renderables.sort((a, b) => a.y - b.y);
      for (const item of renderables) {
        if (item.type === "crop") this.drawCrop(context, item);
        else this.drawBird(context, item.bird);
      }
      context.drawImage(this.images.get(scene.facilitiesOver), 0, 0);
      if (this.selectedBird) this.drawBirdHud(context, this.selectedBird);
    }

    drawCrop(context, item) {
      const image = this.images.get(item.crop.src);
      context.drawImage(image, Math.round(item.x - image.naturalWidth / 2), Math.round(item.y - image.naturalHeight));
    }

    drawFood(context) {
      const image = this.images.get(this.manifest.food);
      for (const item of this.food) {
        context.save();
        context.translate(Math.round(item.x), Math.round(item.y));
        context.rotate(item.rotation);
        context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        context.restore();
      }
    }

    drawBird(context, bird) {
      const action = bird.species.actions[bird.action];
      const image = this.images.get(action.src);
      const frameSize = bird.species.frameSize;
      const frame = Math.floor(bird.actionTime * action.fps) % action.frames;
      context.save();
      context.translate(Math.round(bird.x), Math.round(bird.y));
      const needsFlip = bird.facingRight !== bird.species.spriteFacesRight;
      context.scale(needsFlip ? -1 : 1, 1);
      context.drawImage(image, frame * frameSize, 0, frameSize, frameSize, -frameSize / 2, -frameSize, frameSize, frameSize);
      context.restore();
    }

    drawBirdHud(context, bird) {
      const hud = this.manifest.hud;
      const image = this.images.get(hud.base);
      const left = Math.round(clamp(bird.x - hud.width / 2, 2, this.canvas.width - hud.width - 2));
      const top = Math.round(clamp(
        bird.y - bird.species.frameSize - hud.height - 6,
        2,
        this.canvas.height - hud.height - 2,
      ));
      context.drawImage(image, left, top, hud.width, hud.height);

      context.save();
      context.font = "12px 'Unifont Pixel Black', SimSun, '宋体', 'Microsoft YaHei', sans-serif";
      context.textAlign = "left";
      context.textBaseline = "top";
      context.lineJoin = "round";
      context.strokeStyle = "rgb(80, 24, 7)";
      context.lineWidth = 3;
      context.strokeText(bird.species.label, left + 1, top, 136);
      context.fillStyle = "#ffffff";
      context.fillText(bird.species.label, left + 1, top, 136);
      context.restore();
    }

    tick(time) {
      if (!this.running) return;
      const delta = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
      this.lastTime = time;
      this.update(delta);
      this.draw();
      this.frameRequest = requestAnimationFrame((nextTime) => this.tick(nextTime));
    }

    syncVisibility() {
      const visible = this.panel.classList.contains("is-open") &&
        !this.panel.classList.contains("is-minimized") &&
        !document.hidden;
      this.root?.classList.toggle("has-live-simulator", visible && this.loaded);
      if (visible && !this.loadingStarted) this.load();
      if (visible && this.loaded && !this.running) {
        this.running = true;
        this.lastTime = performance.now();
        this.frameRequest = requestAnimationFrame((time) => this.tick(time));
      } else if (!visible && this.running) {
        this.running = false;
        cancelAnimationFrame(this.frameRequest);
      }
    }
  }

  window.PortfolioSimulator = { prepare, install };
})();
