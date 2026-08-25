// Persistent user config, stored outside the app bundle so it survives
// updates/reinstalls. Replaces the old hardcoded services.js.
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

const DEFAULT_CONFIG = {
  name: "",
  icon: "flame",
  categories: []
};

function load() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Object.assign({}, DEFAULT_CONFIG, parsed);
  } catch (e) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function save(config) {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
}

function exists() {
  return fs.existsSync(configPath());
}

module.exports = { load, save, exists, configPath, DEFAULT_CONFIG };
