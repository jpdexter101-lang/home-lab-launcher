// Parses a Caddyfile into draft tiles: one per site-address hostname that
// has a reverse_proxy or redir directive. Brace-depth aware so directives
// nested inside sub-blocks (header_up, basic_auth, transport, ...) don't get
// mistaken for top-level site blocks.
//
// This is intentionally conservative: it never invents a URL it can't see in
// the file, and it only guesses an icon/color for a small set of well-known
// self-hosted apps by keyword — anything else gets a neutral default so nothing
// is silently mislabeled.

const KNOWN_APPS = [
  { keywords: ["plex"], icon: "play", color: "#e5a00d" },
  { keywords: ["jellyfin"], icon: "film", color: "#aa5cc3" },
  { keywords: ["jellyseerr"], icon: "search", color: "#8b5cf6" },
  { keywords: ["overseerr"], icon: "search", color: "#6366f1" },
  { keywords: ["sonarr"], icon: "tv", color: "#3b5aa2" },
  { keywords: ["radarr"], icon: "radar", color: "#ffc230" },
  { keywords: ["lidarr"], icon: "music", color: "#1db954" },
  { keywords: ["prowlarr"], icon: "compass", color: "#6d4aa0" },
  { keywords: ["bazarr"], icon: "captions", color: "#2fa5a0" },
  { keywords: ["sab", "nzb"], icon: "download", color: "#ffcc00" },
  { keywords: ["qbit", "torrent"], icon: "magnet", color: "#2f67ba" },
  { keywords: ["qui"], icon: "gauge", color: "#38bdf8" },
  { keywords: ["flaresolverr"], icon: "compass", color: "#6b7280" },
  { keywords: ["immich", "photo"], icon: "image", color: "#4250af" },
  { keywords: ["kavita"], icon: "book", color: "#6a5eea" },
  { keywords: ["audiobookshelf", "audiobook"], icon: "headphones", color: "#31a9a0" },
  { keywords: ["tautulli"], icon: "chart", color: "#daa520" },
  { keywords: ["ersatztv"], icon: "broadcast", color: "#2c9c8f" },
  { keywords: ["romm"], icon: "gamepad", color: "#e53e5c" },
  { keywords: ["wizarr"], icon: "wand", color: "#d946a0" },
  { keywords: ["homarr", "dashboard", "dashboard"], icon: "grid", color: "#64748b" },
  { keywords: ["home"], icon: "home", color: "#f97066" },
  { keywords: ["portainer"], icon: "box", color: "#13bef9" },
  { keywords: ["sunshine", "sun"], icon: "sun", color: "#22c55e" },
  { keywords: ["cloudflare"], icon: "sun", color: "#f6821f" },
  { keywords: ["discord"], icon: "chat", color: "#5865f2" },
  { keywords: ["github", "git"], icon: "code", color: "#24292e" },
  { keywords: ["router", "gateway"], icon: "router", color: "#0284c7" },
  { keywords: ["guide", "wiki", "docs"], icon: "book", color: "#1d4ed8" },
  { keywords: ["gluetun", "vpn"], icon: "router", color: "#64748b" }
];

const DEFAULT_ICON = "external";
const DEFAULT_COLOR = "#64748b";

function guessAppearance(hostnameLabel) {
  const lower = hostnameLabel.toLowerCase();
  for (const app of KNOWN_APPS) {
    if (app.keywords.some((kw) => lower.includes(kw))) {
      return { icon: app.icon, color: app.color };
    }
  }
  return { icon: DEFAULT_ICON, color: DEFAULT_COLOR };
}

function labelFromHostname(hostname) {
  const first = hostname.split(".")[0] || hostname;
  return first
    .split(/[-_]/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Splits the file into top-level { ... } blocks, tracking brace depth so
// nested blocks (reverse_proxy's own { header_up ... }, basic_auth, etc.)
// don't get treated as separate site blocks.
function splitTopLevelBlocks(text) {
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let headerStart = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) {
        blocks.push({ header: text.slice(headerStart, i), bodyStart: i + 1 });
        blockStart = i;
      }
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        blocks[blocks.length - 1].body = text.slice(blocks[blocks.length - 1].bodyStart, i);
        headerStart = i + 1;
        blockStart = -1;
      }
    }
  }
  return blocks.filter((b) => typeof b.body === "string");
}

function stripComments(text) {
  return text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("#");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

function extractHostnames(header) {
  return header
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.replace(/^https?:\/\//, "").split(/\s+/)[0])
    .filter((h) => /^[a-z0-9*][a-z0-9.\-]*$/i.test(h));
}

function findDirectiveTarget(body, directive) {
  const re = new RegExp("(^|\\n)\\s*" + directive + "\\s+(\\S+)");
  const match = body.match(re);
  return match ? match[2] : null;
}

// Returns { drafts, skippedBlocks } — drafts is an array of
// { label, url, icon, color, sourceHostname }, ready to hand to the
// settings UI for review before saving. skippedBlocks is a count of
// top-level blocks that had a hostname but no reverse_proxy/redir directive
// (e.g. pure basic_auth stanzas), so the UI can say "N blocks skipped."
function parseCaddyfile(rawText) {
  const text = stripComments(rawText);
  const blocks = splitTopLevelBlocks(text);
  const drafts = [];
  let skippedBlocks = 0;

  for (const block of blocks) {
    const hostnames = extractHostnames(block.header);
    if (hostnames.length === 0) continue; // global options block, no site address

    const hasReverseProxy = /(^|\n)\s*reverse_proxy\s+/.test(block.body);
    const redirTarget = findDirectiveTarget(block.body, "redir");

    if (!hasReverseProxy && !redirTarget) {
      skippedBlocks++;
      continue;
    }

    for (const hostname of hostnames) {
      const label = labelFromHostname(hostname);
      const appearance = guessAppearance(hostname);
      drafts.push({
        label,
        url: "https://" + hostname,
        icon: appearance.icon,
        color: appearance.color,
        sourceHostname: hostname
      });
    }
  }

  return { drafts, skippedBlocks };
}

module.exports = { parseCaddyfile };
