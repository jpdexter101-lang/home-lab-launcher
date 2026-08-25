// Scans one or more folders for installed games and turns them into draft
// tiles. Two strategies, picked automatically per folder:
//
// 1. Steam folders (detected via steamapps/libraryfolders.vdf or
//    appmanifest_*.acf files) get parsed properly — real names, and a
//    steam://rungameid/<appid> URI so Steam itself resolves the launch
//    (works regardless of how any individual game is laid out on disk).
// 2. Anything else (an Epic/GOG/Battle.net/Ubisoft install root, or just a
//    folder of game folders) gets a best-effort scan: each subfolder is
//    treated as one game, and the most game-like .exe inside it (skipping
//    obvious installers/redistributables, preferring a name close to the
//    folder's) becomes the launch target. Not perfect, but works across
//    launchers without needing per-launcher special-casing, and everything
//    goes through the same editable review list before anything is added.
const fs = require("fs");
const path = require("path");
const os = require("os");

function defaultSteamPaths() {
  if (process.platform === "win32") {
    return ["C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam"];
  }
  if (process.platform === "darwin") {
    return [path.join(os.homedir(), "Library", "Application Support", "Steam")];
  }
  return [path.join(os.homedir(), ".steam", "steam"), path.join(os.homedir(), ".local", "share", "Steam")];
}

function findDefaultSteamPath() {
  for (const p of defaultSteamPaths()) {
    if (fs.existsSync(path.join(p, "steamapps"))) return p;
  }
  return null;
}

function isSteamAppsDir(dir) {
  try {
    if (fs.existsSync(path.join(dir, "libraryfolders.vdf"))) return true;
    return fs.readdirSync(dir).some((f) => /^appmanifest_\d+\.acf$/i.test(f));
  } catch (e) {
    return false;
  }
}

// libraryfolders.vdf lists every library folder Steam is using (games can be
// spread across multiple drives) — pull out every "path" value.
function parseLibraryPaths(vdfText) {
  const paths = [];
  const re = /"path"\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(vdfText))) {
    paths.push(m[1].replace(/\\\\/g, "\\"));
  }
  return paths;
}

function parseAppManifest(text) {
  const appidMatch = text.match(/"appid"\s+"(\d+)"/i);
  const nameMatch = text.match(/"name"\s+"([^"]+)"/i);
  if (!appidMatch || !nameMatch) return null;
  return { appid: appidMatch[1], name: nameMatch[1] };
}

// `steamAppsDir` is a folder that directly contains appmanifest_*.acf files
// (i.e. a "steamapps" folder itself, from any library).
function scanOneSteamAppsDir(steamAppsDir, seen, out) {
  let files;
  try {
    files = fs.readdirSync(steamAppsDir);
  } catch (e) {
    return;
  }
  for (const file of files) {
    if (!/^appmanifest_\d+\.acf$/i.test(file)) continue;
    try {
      const text = fs.readFileSync(path.join(steamAppsDir, file), "utf8");
      const parsed = parseAppManifest(text);
      if (parsed && !seen.has(parsed.appid)) {
        seen.add(parsed.appid);
        out.push({
          label: parsed.name,
          url: "steam://rungameid/" + parsed.appid,
          icon: "gamepad",
          color: "#66c0f4",
          source: "Steam"
        });
      }
    } catch (e) {}
  }
}

function scanSteamFolder(folder, seen, out) {
  // `folder` could be the Steam root (contains steamapps/) or a steamapps
  // dir itself — handle both.
  const steamAppsDir = fs.existsSync(path.join(folder, "steamapps")) ? path.join(folder, "steamapps") : folder;
  scanOneSteamAppsDir(steamAppsDir, seen, out);
  // Follow other libraries listed in libraryfolders.vdf too.
  try {
    const text = fs.readFileSync(path.join(steamAppsDir, "libraryfolders.vdf"), "utf8");
    for (const libPath of parseLibraryPaths(text)) {
      const libAppsDir = path.join(libPath, "steamapps");
      if (libAppsDir !== steamAppsDir) scanOneSteamAppsDir(libAppsDir, seen, out);
    }
  } catch (e) {}
}

const SKIP_EXE_PATTERN = /^(unins|setup|redist|vcredist|vc_redist|dxsetup|directx|dotnet|crashreport|crashpad|ue4prereq|easyanticheat|battleye)/i;

function findLikelyExecutable(dir, folderName) {
  const candidates = [];
  function walk(d, depth) {
    if (depth > 2) return;
    let items;
    try {
      items = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const it of items) {
      const full = path.join(d, it.name);
      if (it.isDirectory()) {
        walk(full, depth + 1);
      } else if (it.isFile() && /\.exe$/i.test(it.name) && !SKIP_EXE_PATTERN.test(it.name)) {
        candidates.push(full);
      }
    }
  }
  walk(dir, 0);
  if (candidates.length === 0) return null;

  const normalizedFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, "");
  candidates.sort((a, b) => {
    const score = (p) => {
      const n = path.basename(p, ".exe").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (n === normalizedFolder) return 0;
      if (n.includes(normalizedFolder) || normalizedFolder.includes(n)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  return candidates[0];
}

function scanGenericFolder(folder, out) {
  let entries;
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subDir = path.join(folder, entry.name);
    const exe = findLikelyExecutable(subDir, entry.name);
    if (exe) {
      out.push({ label: entry.name, path: exe, icon: "gamepad", color: "#a970ff", source: "Folder scan" });
    }
  }
}

// Main entry: pass an array of folder paths (from a multi-select directory
// picker). Returns a flat, deduped-by-Steam-appid list of draft tiles.
function scanGameFolders(folders) {
  const out = [];
  const seenSteamIds = new Set();
  for (const folder of folders) {
    if (isSteamAppsDir(folder) || isSteamAppsDir(path.join(folder, "steamapps"))) {
      scanSteamFolder(folder, seenSteamIds, out);
    } else {
      scanGenericFolder(folder, out);
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = { findDefaultSteamPath, scanGameFolders };
