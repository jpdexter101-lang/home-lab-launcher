const panel = document.getElementById("panel");
const grid = document.getElementById("grid");
const header = document.getElementById("header");
const collapseBtn = document.getElementById("collapse-btn");
const pinBtn = document.getElementById("pin-btn");
const settingsBtn = document.getElementById("settings-btn");
const quitBtn = document.getElementById("quit-btn");
const brandGlyph = document.getElementById("brand-glyph");
const brandTitle = document.getElementById("brand-title");
const brandCount = document.getElementById("brand-count");
const onboarding = document.getElementById("onboarding");
const onboardingGlyph = document.getElementById("onboarding-glyph");
const onboardingName = document.getElementById("onboarding-name");
const onboardingIcons = document.getElementById("onboarding-icons");
const onboardingSubmit = document.getElementById("onboarding-submit");

let currentConfig = { name: "", icon: "flame", categories: [] };
let selectedOnboardingIcon = "flame";

function iconSvg(iconKey, filledOverride) {
  const markup = window.ICONS[iconKey] || window.ICONS.grid;
  const filled = typeof filledOverride === "boolean" ? filledOverride : window.FILLED_ICONS && window.FILLED_ICONS.has(iconKey);
  return filled
    ? '<svg viewBox="0 0 24 24" fill="currentColor">' + markup + "</svg>"
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + markup + "</svg>";
}

function buildTile(svc) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.setProperty("--accent", svc.color || "#3b82f6");
  tile.title = svc.url || svc.path || "";
  tile.tabIndex = 0;
  tile.setAttribute("role", "button");
  tile.setAttribute("aria-label", "Open " + svc.label);

  const iconWrap = document.createElement("div");
  iconWrap.className = "tile-icon";
  iconWrap.innerHTML = iconSvg(svc.icon);

  const label = document.createElement("div");
  label.className = "tile-label";
  label.textContent = svc.label;

  tile.appendChild(iconWrap);
  tile.appendChild(label);

  const open = () => {
    if (svc.path) {
      window.launcher.openPath(svc.path);
    } else if (svc.url) {
      window.launcher.openLink(svc.url);
    }
    window.launcher.toggleCollapse();
  };
  tile.addEventListener("click", open);
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  return tile;
}

function renderEmptyState() {
  grid.innerHTML = "";
  const empty = document.createElement("div");
  empty.id = "empty-state";
  empty.innerHTML =
    "<p>No apps added yet.</p>" +
    '<button id="empty-settings-btn">Open Settings</button>';
  grid.appendChild(empty);
  document.getElementById("empty-settings-btn").addEventListener("click", () => window.launcher.openSettings());
}

function renderTiles() {
  const categories = currentConfig.categories || [];
  const total = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  brandCount.textContent = total + (total === 1 ? " app" : " apps");

  if (total === 0) {
    renderEmptyState();
    return;
  }

  grid.innerHTML = "";
  for (const cat of categories) {
    if (!cat.items.length) continue;
    const row = document.createElement("div");
    row.className = "category-row";
    row.style.setProperty("--row-count", cat.items.length);

    const label = document.createElement("div");
    label.className = "category-label";
    label.textContent = cat.category;
    row.appendChild(label);

    const tiles = document.createElement("div");
    tiles.className = "category-tiles";
    for (const svc of cat.items) {
      tiles.appendChild(buildTile(svc));
    }
    row.appendChild(tiles);

    grid.appendChild(row);
  }
}

function renderBrand() {
  brandGlyph.innerHTML = iconSvg(currentConfig.icon || "flame");
  brandTitle.textContent = currentConfig.name || "Home Lab Launcher";
}

function renderOnboardingIcons() {
  onboardingIcons.innerHTML = "";
  for (const key of window.BRAND_ICONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "onboarding-icon-btn";
    btn.innerHTML = iconSvg(key);
    btn.classList.toggle("selected", key === selectedOnboardingIcon);
    btn.addEventListener("click", () => {
      selectedOnboardingIcon = key;
      onboardingGlyph.innerHTML = iconSvg(key);
      renderOnboardingIcons();
    });
    onboardingIcons.appendChild(btn);
  }
}

function applyConfig(cfg) {
  currentConfig = cfg;
  const needsOnboarding = !cfg.name || !cfg.name.trim();
  panel.classList.toggle("onboarding-active", needsOnboarding);
  if (needsOnboarding) {
    onboardingGlyph.innerHTML = iconSvg(selectedOnboardingIcon);
    renderOnboardingIcons();
    return;
  }
  renderBrand();
  renderTiles();
}

onboardingSubmit.addEventListener("click", async () => {
  const name = onboardingName.value.trim();
  if (!name) {
    onboardingName.focus();
    return;
  }
  const next = Object.assign({}, currentConfig, { name, icon: selectedOnboardingIcon, categories: currentConfig.categories || [] });
  await window.launcher.saveConfig(next);
});

onboardingName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onboardingSubmit.click();
});

header.addEventListener("click", (e) => {
  if (e.target.closest("#pin-btn") || e.target.closest("#settings-btn") || e.target.closest("#quit-btn")) return;
  window.launcher.toggleCollapse();
});

pinBtn.addEventListener("click", () => window.launcher.togglePin());
settingsBtn.addEventListener("click", () => window.launcher.openSettings());
quitBtn.addEventListener("click", () => window.launcher.quit());

window.launcher.onState((state) => {
  panel.classList.toggle("collapsed", !!state.collapsed);
});

window.launcher.onPinChanged((state) => {
  pinBtn.classList.toggle("unpinned", !state.pinned);
  pinBtn.title = state.pinned ? "Un-pin from always-on-top" : "Keep on top";
});

window.launcher.onConfigChanged((cfg) => applyConfig(cfg));

window.launcher.getConfig().then(applyConfig);
