const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcher", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("save-config", cfg),
  onConfigChanged: (cb) => ipcRenderer.on("config-changed", (_evt, cfg) => cb(cfg)),
  toggleCollapse: () => ipcRenderer.send("toggle-collapse"),
  openLink: (url) => ipcRenderer.send("open-link", url),
  openPath: (path) => ipcRenderer.send("open-path", path),
  togglePin: () => ipcRenderer.send("toggle-pin"),
  quit: () => ipcRenderer.send("quit-app"),
  openSettings: () => ipcRenderer.send("open-settings"),
  onState: (cb) => ipcRenderer.on("state-changed", (_evt, state) => cb(state)),
  onPinChanged: (cb) => ipcRenderer.on("pin-changed", (_evt, state) => cb(state))
});
