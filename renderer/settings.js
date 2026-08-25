let draftConfig = { name: "", icon: "flame", categories: [] };
let pendingImportDrafts = [];

const nameInput = document.getElementById("name-input");
const brandIconPicker = document.getElementById("brand-icon-picker");
const autostartCheckbox = document.getElementById("autostart-checkbox");
const importBtn = document.getElementById("import-btn");
const steamAutodetectBtn = document.getElementById("steam-autodetect-btn");
const gameFoldersBtn = document.getElementById("game-folders-btn");
const importReview = document.getElementById("import-review");
const importList = document.getElementById("import-list");
const importTargetCategory = document.getElementById("import-target-category");
const importAddBtn = document.getElementById("import-add-btn");
const importCancelBtn = document.getElementById("import-cancel-btn");
const importStatus = document.getElementById("import-status");
const categoriesList = document.getElementById("categories-list");
const newCategoryInput = document.getElementById("new-category-input");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoryDatalist = document.getElementById("category-datalist");
const itemFormTemplate = document.getElementById("item-form-template");
const profilePresets = document.getElementById("profile-presets");
const profileNameInput = document.getElementById("profile-name-input");
const createProfileBtn = document.getElementById("create-profile-btn");
const profileStatus = document.getElementById("profile-status");

function iconSvg(iconKey) {
  const markup = window.ICONS[iconKey] || window.ICONS.grid;
  const filled = window.FILLED_ICONS && window.FILLED_ICONS.has(iconKey);
  return filled
    ? '<svg viewBox="0 0 24 24" fill="currentColor">' + markup + "</svg>"
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + markup + "</svg>";
}

async function persist() {
  await window.settingsAPI.saveConfig(draftConfig);
}

function buildIconPicker(container, keys, selectedKey, onSelect) {
  container.innerHTML = "";
  for (const key of keys) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.innerHTML = iconSvg(key);
    btn.classList.toggle("selected", key === selectedKey);
    btn.title = key;
    btn.addEventListener("click", () => onSelect(key));
    container.appendChild(btn);
  }
}

function renderIdentity() {
  nameInput.value = draftConfig.name || "";
  buildIconPicker(brandIconPicker, window.BRAND_ICONS, draftConfig.icon || "flame", (key) => {
    draftConfig.icon = key;
    renderIdentity();
    persist();
  });
}

nameInput.addEventListener("change", () => {
  draftConfig.name = nameInput.value.trim();
  persist();
});

async function renderAutostart() {
  autostartCheckbox.checked = await window.settingsAPI.getAutostart();
}

autostartCheckbox.addEventListener("change", async () => {
  await window.settingsAPI.setAutostart(autostartCheckbox.checked);
});

function updateCategoryDatalist() {
  categoryDatalist.innerHTML = "";
  for (const cat of draftConfig.categories) {
    const opt = document.createElement("option");
    opt.value = cat.category;
    categoryDatalist.appendChild(opt);
  }
}

function findCategory(name) {
  return draftConfig.categories.find((c) => c.category.toLowerCase() === name.toLowerCase());
}

// --- Item add/edit form ---

function openItemForm(container, existingItem, onSave) {
  const frag = itemFormTemplate.content.cloneNode(true);
  const form = frag.querySelector(".item-form");
  const labelInput = form.querySelector(".f-label");
  const valueInput = form.querySelector(".f-value");
  const valueLabel = form.querySelector(".f-value-label");
  const browseBtn = form.querySelector(".f-browse");
  const colorInput = form.querySelector(".f-color");
  const iconPickerEl = form.querySelector(".f-icon-picker");
  const typeRadios = form.querySelectorAll('input[name="f-type"]');
  const saveBtn = form.querySelector(".f-save");
  const cancelBtn = form.querySelector(".f-cancel");

  let selectedIcon = (existingItem && existingItem.icon) || "external";
  const isPath = !!(existingItem && existingItem.path);

  labelInput.value = (existingItem && existingItem.label) || "";
  valueInput.value = (existingItem && (existingItem.url || existingItem.path)) || "";
  colorInput.value = (existingItem && existingItem.color) || "#3b82f6";
  for (const r of typeRadios) r.checked = r.value === (isPath ? "path" : "url");

  function updateValueMode() {
    const type = form.querySelector('input[name="f-type"]:checked').value;
    valueLabel.textContent = type === "path" ? "File path" : "URL";
    valueInput.placeholder = type === "path" ? "C:\\path\\to\\shortcut.lnk" : "https://example.com";
    browseBtn.style.display = type === "path" ? "" : "none";
  }
  for (const r of typeRadios) r.addEventListener("change", updateValueMode);
  updateValueMode();

  browseBtn.addEventListener("click", async () => {
    const picked = await window.settingsAPI.browseFile();
    if (picked) valueInput.value = picked;
  });

  function refreshIconPicker() {
    buildIconPicker(iconPickerEl, Object.keys(window.ICONS), selectedIcon, (key) => {
      selectedIcon = key;
      refreshIconPicker();
    });
  }
  refreshIconPicker();

  cancelBtn.addEventListener("click", () => form.remove());

  saveBtn.addEventListener("click", () => {
    const label = labelInput.value.trim();
    const value = valueInput.value.trim();
    if (!label || !value) return;
    const type = form.querySelector('input[name="f-type"]:checked').value;
    const result = { label, icon: selectedIcon, color: colorInput.value };
    if (type === "path") {
      result.path = value;
    } else {
      result.url = value;
    }
    onSave(result);
    form.remove();
  });

  container.appendChild(form);
  labelInput.focus();
}

// --- Categories rendering ---

function renderCategories() {
  categoriesList.innerHTML = "";
  updateCategoryDatalist();

  draftConfig.categories.forEach((cat, catIndex) => {
    const catEl = document.createElement("div");
    catEl.className = "category-block";

    const catHeader = document.createElement("div");
    catHeader.className = "category-block-header";

    const catNameInput = document.createElement("input");
    catNameInput.type = "text";
    catNameInput.className = "category-name-input";
    catNameInput.value = cat.category;
    catNameInput.maxLength = 40;
    catNameInput.addEventListener("change", () => {
      cat.category = catNameInput.value.trim() || cat.category;
      persist();
      renderCategories();
    });

    const upBtn = iconButton("up", "Move category up", () => {
      if (catIndex === 0) return;
      const [c] = draftConfig.categories.splice(catIndex, 1);
      draftConfig.categories.splice(catIndex - 1, 0, c);
      persist();
      renderCategories();
    });
    const downBtn = iconButton("down", "Move category down", () => {
      if (catIndex === draftConfig.categories.length - 1) return;
      const [c] = draftConfig.categories.splice(catIndex, 1);
      draftConfig.categories.splice(catIndex + 1, 0, c);
      persist();
      renderCategories();
    });
    const delBtn = iconButton("delete", "Delete category", () => {
      if (!confirm('Delete category "' + cat.category + '" and all its apps?')) return;
      draftConfig.categories.splice(catIndex, 1);
      persist();
      renderCategories();
    });

    catHeader.appendChild(catNameInput);
    catHeader.appendChild(upBtn);
    catHeader.appendChild(downBtn);
    catHeader.appendChild(delBtn);
    catEl.appendChild(catHeader);

    const itemsList = document.createElement("div");
    itemsList.className = "items-list";

    cat.items.forEach((item, itemIndex) => {
      const row = document.createElement("div");
      row.className = "item-row";

      const iconEl = document.createElement("div");
      iconEl.className = "item-icon";
      iconEl.style.setProperty("--accent", item.color || "#3b82f6");
      iconEl.innerHTML = iconSvg(item.icon);

      const meta = document.createElement("div");
      meta.className = "item-meta";
      const nameEl = document.createElement("div");
      nameEl.className = "item-name";
      nameEl.textContent = item.label;
      const targetEl = document.createElement("div");
      targetEl.className = "item-target";
      targetEl.textContent = item.url || item.path || "";
      meta.appendChild(nameEl);
      meta.appendChild(targetEl);

      const editBtn = iconButton("edit", "Edit", () => {
        row.style.display = "none";
        openItemForm(itemsList, item, (updated) => {
          cat.items[itemIndex] = updated;
          persist();
          renderCategories();
        });
      });
      const itemUpBtn = iconButton("up", "Move up", () => {
        if (itemIndex === 0) return;
        const [it] = cat.items.splice(itemIndex, 1);
        cat.items.splice(itemIndex - 1, 0, it);
        persist();
        renderCategories();
      });
      const itemDownBtn = iconButton("down", "Move down", () => {
        if (itemIndex === cat.items.length - 1) return;
        const [it] = cat.items.splice(itemIndex, 1);
        cat.items.splice(itemIndex + 1, 0, it);
        persist();
        renderCategories();
      });
      const itemDelBtn = iconButton("delete", "Delete", () => {
        if (!confirm('Remove "' + item.label + '"?')) return;
        cat.items.splice(itemIndex, 1);
        persist();
        renderCategories();
      });

      row.appendChild(iconEl);
      row.appendChild(meta);
      row.appendChild(editBtn);
      row.appendChild(itemUpBtn);
      row.appendChild(itemDownBtn);
      row.appendChild(itemDelBtn);
      itemsList.appendChild(row);
    });

    const addItemBtn = document.createElement("button");
    addItemBtn.className = "s-btn s-btn-secondary add-app-btn";
    addItemBtn.textContent = "+ Add App";
    addItemBtn.addEventListener("click", () => {
      openItemForm(itemsList, null, (created) => {
        cat.items.push(created);
        persist();
        renderCategories();
      });
    });

    catEl.appendChild(itemsList);
    catEl.appendChild(addItemBtn);
    categoriesList.appendChild(catEl);
  });
}

function iconButton(kind, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row-icon-btn row-icon-" + kind;
  btn.title = title;
  const glyphs = {
    up: '<polyline points="18,15 12,9 6,15"/>',
    down: '<polyline points="6,9 12,15 18,9"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    delete: '<polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'
  };
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + glyphs[kind] + "</svg>";
  btn.addEventListener("click", onClick);
  return btn;
}

addCategoryBtn.addEventListener("click", () => {
  const name = newCategoryInput.value.trim();
  if (!name) return;
  if (findCategory(name)) {
    newCategoryInput.value = "";
    return;
  }
  draftConfig.categories.push({ category: name, items: [] });
  newCategoryInput.value = "";
  persist();
  renderCategories();
});

newCategoryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCategoryBtn.click();
});

// --- Shared review-list plumbing (Caddyfile import + game import both use this) ---

function openImportReview(drafts, defaultCategoryName) {
  pendingImportDrafts = drafts;
  importTargetCategory.value = defaultCategoryName;
  renderImportList();
  importReview.style.display = "";
}

// --- Caddyfile import ---

importBtn.addEventListener("click", async () => {
  importStatus.textContent = "";
  const result = await window.settingsAPI.importCaddyfile();
  if (!result) return;
  if (result.error) {
    importStatus.textContent = "Couldn't read that file: " + result.error;
    return;
  }
  if (!result.drafts.length) {
    importStatus.textContent = result.skippedBlocks
      ? "No reverse-proxied sites found (" + result.skippedBlocks + " block(s) skipped — no reverse_proxy/redir inside)."
      : "No site blocks found in that file.";
    return;
  }
  openImportReview(result.drafts, "Imported");
  importStatus.textContent = result.skippedBlocks
    ? "Found " + result.drafts.length + " hostname(s), skipped " + result.skippedBlocks + " block(s) with no reverse_proxy/redir."
    : "Found " + result.drafts.length + " hostname(s).";
});

// --- Game import (Steam auto-detect, or any folder(s)) ---

function handleGameScanResult(result) {
  if (!result) return;
  if (result.error) {
    importStatus.textContent = result.error;
    return;
  }
  if (!result.drafts.length) {
    importStatus.textContent = "No games found in " + (result.folders || []).join(", ") + ".";
    return;
  }
  openImportReview(result.drafts, "Games");
  importStatus.textContent = "Found " + result.drafts.length + " game" + (result.drafts.length === 1 ? "" : "s") + ".";
}

steamAutodetectBtn.addEventListener("click", async () => {
  importStatus.textContent = "Looking for Steam...";
  handleGameScanResult(await window.settingsAPI.scanDefaultSteam());
});

gameFoldersBtn.addEventListener("click", async () => {
  importStatus.textContent = "";
  handleGameScanResult(await window.settingsAPI.pickGameFolders());
});

function renderImportList() {
  importList.innerHTML = "";
  pendingImportDrafts.forEach((draft, i) => {
    const row = document.createElement("div");
    row.className = "import-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(i);

    const iconEl = document.createElement("div");
    iconEl.className = "item-icon";
    iconEl.style.setProperty("--accent", draft.color);
    iconEl.innerHTML = iconSvg(draft.icon);

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "import-label-input";
    labelInput.value = draft.label;
    labelInput.addEventListener("change", () => (draft.label = labelInput.value.trim() || draft.label));

    const urlEl = document.createElement("div");
    urlEl.className = "item-target";
    urlEl.textContent = draft.url || draft.path || "";

    row.appendChild(checkbox);
    row.appendChild(iconEl);
    row.appendChild(labelInput);
    row.appendChild(urlEl);
    importList.appendChild(row);
  });
}

importAddBtn.addEventListener("click", () => {
  const targetName = importTargetCategory.value.trim() || "Imported";
  let target = findCategory(targetName);
  if (!target) {
    target = { category: targetName, items: [] };
    draftConfig.categories.push(target);
  }
  const checkboxes = importList.querySelectorAll('input[type="checkbox"]');
  let added = 0;
  checkboxes.forEach((cb) => {
    if (!cb.checked) return;
    const draft = pendingImportDrafts[Number(cb.dataset.index)];
    const item = { label: draft.label, icon: draft.icon, color: draft.color };
    if (draft.path) item.path = draft.path;
    else item.url = draft.url;
    target.items.push(item);
    added++;
  });
  persist();
  renderCategories();
  importReview.style.display = "none";
  importStatus.textContent = "Added " + added + " app(s) to \u201c" + targetName + "\u201d.";
  pendingImportDrafts = [];
});

importCancelBtn.addEventListener("click", () => {
  importReview.style.display = "none";
  pendingImportDrafts = [];
  importStatus.textContent = "";
});

// --- Run Another One (profiles) ---

const PROFILE_PRESETS = ["Games", "Editor", "Creative", "Work"];

for (const preset of PROFILE_PRESETS) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "preset-chip";
  chip.textContent = preset;
  chip.addEventListener("click", () => {
    profileNameInput.value = preset;
    profileNameInput.focus();
  });
  profilePresets.appendChild(chip);
}

createProfileBtn.addEventListener("click", async () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    profileStatus.textContent = "Enter a name first.";
    profileNameInput.focus();
    return;
  }
  createProfileBtn.disabled = true;
  createProfileBtn.textContent = "Creating...";
  const result = await window.settingsAPI.createProfile(name);
  createProfileBtn.disabled = false;
  createProfileBtn.textContent = "Create & Launch";
  if (!result.ok) {
    profileStatus.textContent = result.error;
    return;
  }
  profileStatus.textContent = result.shortcutCreated
    ? `Launched "${name}" — desktop shortcut created too.`
    : "Launched, but " + (result.error || "couldn't create a shortcut for it.");
  profileNameInput.value = "";
});

profileNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createProfileBtn.click();
});

// --- Init ---

window.settingsAPI.onConfigChanged((cfg) => {
  draftConfig = cfg;
  renderIdentity();
  renderCategories();
});

(async function init() {
  draftConfig = await window.settingsAPI.getConfig();
  if (!draftConfig.categories) draftConfig.categories = [];
  renderIdentity();
  renderCategories();
  renderAutostart();
})();
