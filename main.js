const { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, globalShortcut, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const COLLAPSED_W = 250;
const COLLAPSED_H = 46;
const ANIM_MS = 200;
const ANIM_STEP_MS = 16;
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_TIMEOUT_MS = 3000;
const PANIC_ACCELERATOR = "Control+Alt+Shift+D";
const DEFAULT_APP_NAME = "Home Lab Launcher";

// Run a second (or third...) independent instance side by side via
// --profile=NAME — e.g. one for a home lab, one for general desktop
// shortcuts. Each profile gets its own config file and, since Electron's
// single-instance lock is itself scoped to the userData path, its own lock
// too — so profiles don't block each other, only a duplicate launch of the
// *same* profile does. Must happen before anything reads/writes userData or
// takes the single-instance lock.
const profileArg = process.argv.find((a) => a.startsWith("--profile="));
const profileName = profileArg ? profileArg.slice("--profile=".length).trim() : null;
const safeProfileName = profileName ? profileName.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40) : null;
if (safeProfileName) {
  app.setPath("userData", path.join(app.getPath("userData"), "profiles", safeProfileName));
}

const config = require("./config.js");
const { parseCaddyfile } = require("./caddyImport.js");

// Second launch of the *same profile* exits immediately instead of piling
// up extra always-on-top windows that would compound a future lockout.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win;
let settingsWin;
let tray;
let userConfig = config.load();
if (safeProfileName && !userConfig.name) {
  userConfig.name = safeProfileName;
}
let collapsed = false;
let animating = false;
let pinnedOnTop = true;
// True only while un-pinned by the emergency path (panicRelease), never by
// the user's own pin-toggle click — this is what the 'responsive' handler
// checks before auto-restoring, so a manual un-pin isn't silently reverted.
let autoUnpinned = false;
let watchdogTimer = null;

// Content-driven expanded height, measured from the actual rendered DOM
// (see measureExpandedHeight) so it stays correct as the user's config
// grows or shrinks instead of relying on hand-tuned pixel math.
let expandedWidth = null;
let expandedHeight = null;

function appName() {
  return (userConfig.name && userConfig.name.trim()) || DEFAULT_APP_NAME;
}

function getWorkArea() {
  return screen.getPrimaryDisplay().workArea;
}

function defaultLaunchBounds() {
  const wa = getWorkArea();
  const w = Math.round(wa.width / 2);
  const h = Math.round(wa.height / 2);
  expandedWidth = w;
  expandedHeight = h;
  return { x: wa.x + wa.width - w, y: wa.y, width: w, height: h };
}

function clampToWorkArea(b) {
  const wa = getWorkArea();
  const width = Math.min(b.width, wa.width);
  const height = Math.min(b.height, wa.height);
  const x = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - width);
  const y = Math.min(Math.max(b.y, wa.y), wa.y + wa.height - height);
  return { x, y, width, height };
}

// Both variants keep the panel's own top-right corner fixed as the anchor,
// since that's where the collapse control lives — so wherever the user has
// dragged it, collapsing/expanding grows or shrinks toward that same corner
// instead of snapping back to the screen edge.
function expandedBoundsFrom(anchor) {
  const width = expandedWidth || Math.round(getWorkArea().width / 2);
  const height = expandedHeight || Math.round(getWorkArea().height / 2);
  return clampToWorkArea({ x: anchor.x + anchor.width - width, y: anchor.y, width, height });
}

function collapsedBoundsFrom(anchor) {
  return clampToWorkArea({ x: anchor.x + anchor.width - COLLAPSED_W, y: anchor.y, width: COLLAPSED_W, height: COLLAPSED_H });
}

function animateTo(target) {
  if (!win || win.isDestroyed()) return;
  animating = true;
  const start = win.getBounds();
  const startTime = Date.now();

  function step() {
    if (!win || win.isDestroyed()) return;
    const t = Math.min(1, (Date.now() - startTime) / ANIM_MS);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const bounds = {
      x: Math.round(start.x + (target.x - start.x) * ease),
      y: Math.round(start.y + (target.y - start.y) * ease),
      width: Math.round(start.width + (target.width - start.width) * ease),
      height: Math.round(start.height + (target.height - start.height) * ease)
    };
    win.setBounds(bounds);
    if (t < 1) {
      setTimeout(step, ANIM_STEP_MS);
    } else {
      win.setBounds(target);
      animating = false;
    }
  }
  step();
}

// Measures the real content height (header + all category rows) from the
// live DOM and resizes the window to match exactly, so the grid never needs
// to scroll and never leaves dead space. Re-runs whenever the config changes.
async function measureExpandedHeight() {
  if (!win || win.isDestroyed()) return;
  try {
    const height = await win.webContents.executeJavaScript(
      "document.getElementById('header').offsetHeight + document.getElementById('grid').scrollHeight",
      true
    );
    if (typeof height === "number" && height > 0) {
      const wa = getWorkArea();
      expandedHeight = Math.min(Math.round(height), wa.height);
      if (!collapsed) {
        const current = win.getBounds();
        win.setBounds(clampToWorkArea({ x: current.x, y: current.y, width: current.width, height: expandedHeight }));
      }
    }
  } catch (e) {}
}

// Drops the window out of always-on-top / hides it. These are native-window
// calls owned by the main process, so they still work even when the renderer's
// own message pump (GPU/compositor/JS) is wedged — that's what makes this a
// real escape hatch rather than another thing that can hang.
function panicRelease(reason) {
  if (!win || win.isDestroyed()) return;
  pinnedOnTop = false;
  autoUnpinned = true;
  try {
    win.setAlwaysOnTop(false);
  } catch (e) {}
  try {
    win.hide();
  } catch (e) {}
  console.error(`[launcher] panic release triggered (${reason}) — window un-pinned and hidden`);
  try {
    win.webContents.send("pin-changed", { pinned: false });
  } catch (e) {}
  updateTrayMenu();
}

function restorePin() {
  if (!win || win.isDestroyed()) return;
  pinnedOnTop = true;
  autoUnpinned = false;
  win.showInactive();
  win.setAlwaysOnTop(true, "floating");
  try {
    win.webContents.send("pin-changed", { pinned: true });
  } catch (e) {}
  updateTrayMenu();
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    let answered = false;
    const timeout = setTimeout(() => {
      if (!answered) panicRelease("watchdog: renderer did not respond to ping");
    }, WATCHDOG_TIMEOUT_MS);

    win.webContents
      .executeJavaScript("true", true)
      .then(() => {
        answered = true;
        clearTimeout(timeout);
      })
      .catch(() => {
        answered = true;
        clearTimeout(timeout);
      });
  }, WATCHDOG_INTERVAL_MS);
}

function createWindow() {
  const bounds = defaultLaunchBounds();
  win = new BrowserWindow({
    ...bounds,
    title: appName(),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("state-changed", { collapsed });
    win.webContents.send("pin-changed", { pinned: pinnedOnTop });
    win.webContents.send("config-changed", userConfig);
    measureExpandedHeight();
  });

  // Chromium's own hang detector — fires when the renderer stops acking
  // input/paint messages. This is the primary escape hatch.
  win.webContents.on("unresponsive", () => panicRelease("webContents unresponsive"));
  win.webContents.on("responsive", () => {
    if (autoUnpinned) restorePin();
  });
  win.webContents.on("render-process-gone", (_evt, details) => {
    console.error("[launcher] renderer process gone:", details.reason);
    panicRelease("render-process-gone: " + details.reason);
  });

  startWatchdog();
}

function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 760,
    height: 720,
    title: appName() + " — Settings",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "renderer", "settings-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}

function broadcastConfig() {
  if (win && !win.isDestroyed()) win.webContents.send("config-changed", userConfig);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("config-changed", userConfig);
  updateTrayMenu();
  if (tray) tray.setToolTip(appName());
  if (win && !win.isDestroyed()) win.setTitle(appName());
}

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: appName(), enabled: false },
    { type: "separator" },
    { label: "Settings...", click: () => createSettingsWindow() },
    {
      label: pinnedOnTop ? "Un-pin (drop always-on-top)" : "Re-pin on top",
      click: () => (pinnedOnTop ? panicRelease("manual: tray un-pin") : restorePin())
    },
    {
      label: win && win.isVisible() ? "Hide" : "Show",
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) {
          win.hide();
        } else {
          win.showInactive();
          if (pinnedOnTop) win.setAlwaysOnTop(true, "floating");
        }
        updateTrayMenu();
      }
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, "renderer", "assets", "tray.png");
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip(appName());
  tray.on("click", () => {
    if (!win || win.isDestroyed()) return;
    win.isVisible() ? win.hide() : win.showInactive();
    updateTrayMenu();
  });
  updateTrayMenu();
}

// --- Cross-platform "launch at login" ---
// Electron's app.setLoginItemSettings only works on Windows/macOS; Linux
// needs a manual .desktop file in ~/.config/autostart.
function linuxAutostartPath() {
  return path.join(os.homedir(), ".config", "autostart", "home-lab-launcher.desktop");
}

function linuxDesktopFileContents() {
  return [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${appName()}`,
    `Exec=${process.execPath}`,
    "X-GNOME-Autostart-enabled=true",
    ""
  ].join("\n");
}

function getAutostart() {
  if (process.platform === "linux") {
    return fs.existsSync(linuxAutostartPath());
  }
  return app.getLoginItemSettings().openAtLogin;
}

function setAutostart(enable) {
  if (process.platform === "linux") {
    const p = linuxAutostartPath();
    if (enable) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, linuxDesktopFileContents(), "utf8");
    } else {
      try {
        fs.unlinkSync(p);
      } catch (e) {}
    }
  } else {
    app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath });
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Panic hotkey: works even if the renderer is fully wedged, since
  // globalShortcut callbacks run in the main process.
  globalShortcut.register(PANIC_ACCELERATOR, () => panicRelease("panic hotkey"));
});

app.on("second-instance", () => {
  if (!win || win.isDestroyed()) return;
  win.showInactive();
  if (pinnedOnTop) win.setAlwaysOnTop(true, "floating");
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (watchdogTimer) clearInterval(watchdogTimer);
});

ipcMain.on("toggle-collapse", () => {
  if (animating) return;
  const current = win.getBounds();
  collapsed = !collapsed;
  animateTo(collapsed ? collapsedBoundsFrom(current) : expandedBoundsFrom(current));
  win.webContents.send("state-changed", { collapsed });
});

ipcMain.on("open-link", (_evt, url) => {
  shell.openExternal(url);
});

// For local shortcuts/scripts (.lnk, .bat, .sh, .desktop, ...) — launches it
// the same way double-clicking it in a file manager would, instead of trying
// to navigate a browser to it.
ipcMain.on("open-path", (_evt, targetPath) => {
  shell.openPath(targetPath).then((err) => {
    if (err) console.error("[launcher] failed to open path:", targetPath, err);
  });
});

// User-initiated pin toggle from the header button. Unlike panicRelease,
// this never hides the window — the whole point is it stays visible on the
// desktop, just no longer floating above everything else.
ipcMain.on("toggle-pin", () => {
  if (!win || win.isDestroyed()) return;
  pinnedOnTop = !pinnedOnTop;
  // Only pass a level when enabling — setAlwaysOnTop(false, 'floating') has
  // been unreliable at actually clearing topmost on Windows in practice.
  if (pinnedOnTop) {
    win.setAlwaysOnTop(true, "floating");
  } else {
    win.setAlwaysOnTop(false);
  }
  win.webContents.send("pin-changed", { pinned: pinnedOnTop });
  updateTrayMenu();
});

ipcMain.on("open-settings", () => createSettingsWindow());

ipcMain.on("quit-app", () => app.quit());

ipcMain.handle("get-config", () => userConfig);

ipcMain.handle("save-config", (_evt, newConfig) => {
  userConfig = newConfig;
  config.save(userConfig);
  broadcastConfig();
  measureExpandedHeight();
  return { ok: true };
});

ipcMain.handle("import-caddyfile", async () => {
  const win2 = settingsWin || win;
  const result = await dialog.showOpenDialog(win2, {
    title: "Select Caddyfile",
    properties: ["openFile"],
    filters: [
      { name: "Caddyfile", extensions: ["*"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const text = fs.readFileSync(result.filePaths[0], "utf8");
    return parseCaddyfile(text);
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.handle("browse-file", async () => {
  const win2 = settingsWin || win;
  const result = await dialog.showOpenDialog(win2, { title: "Select File", properties: ["openFile"] });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("get-autostart", () => getAutostart());

ipcMain.handle("set-autostart", (_evt, enable) => {
  setAutostart(!!enable);
  return getAutostart();
});

app.on("window-all-closed", () => {
  app.quit();
});
