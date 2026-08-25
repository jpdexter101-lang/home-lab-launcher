const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("save-config", cfg),
  importCaddyfile: () => ipcRenderer.invoke("import-caddyfile"),
  browseFile: () => ipcRenderer.invoke("browse-file"),
  getAutostart: () => ipcRenderer.invoke("get-autostart"),
  setAutostart: (enable) => ipcRenderer.invoke("set-autostart", enable),
  createProfile: (name) => ipcRenderer.invoke("create-profile", name),
  onConfigChanged: (cb) => ipcRenderer.on("config-changed", (_evt, cfg) => cb(cfg))
});
