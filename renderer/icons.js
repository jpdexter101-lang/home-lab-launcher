// Minimal hand-drawn glyph set (24x24). No external deps/CDN, no emoji glyphs.
// Values are inner-SVG markup strings rendered with currentColor stroke,
// except entries in FILLED_ICONS which render as solid currentColor fill.

window.FILLED_ICONS = new Set(["flame"]);

// A curated subset offered as brand-glyph choices during onboarding/settings
// (the full ICONS set below is available for individual app tiles too).
window.BRAND_ICONS = ["flame", "home", "box", "router", "grid", "sun", "gauge", "code"];

window.ICONS = {
  play: '<polygon points="6,4 20,12 6,20"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/>',
  search: '<circle cx="10" cy="10" r="7"/><line x1="21" y1="21" x2="15.5" y2="15.5"/>',
  tv: '<rect x="3" y="7" width="18" height="13" rx="2"/><line x1="8" y1="3" x2="3" y2="7"/><line x1="16" y1="3" x2="21" y2="7"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><line x1="12" y1="12" x2="19" y2="6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="15,8 13,13 8,16 11,11"/>',
  captions: '<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="10" x2="10" y2="10"/><line x1="6" y1="14" x2="14" y2="14"/><line x1="14" y1="10" x2="18" y2="10"/>',
  download: '<line x1="12" y1="3" x2="12" y2="15"/><polyline points="7,10 12,15 17,10"/><line x1="4" y1="21" x2="20" y2="21"/>',
  magnet: '<path d="M7 3v8a5 5 0 0 0 10 0V3"/><line x1="4" y1="3" x2="10" y2="3"/><line x1="14" y1="3" x2="20" y2="3"/>',
  gauge: '<path d="M4 15a8 8 0 0 1 16 0"/><line x1="12" y1="15" x2="16" y2="10"/><circle cx="12" cy="15" r="1.4"/>',
  external: '<path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  book: '<path d="M4 19.5V6.5A2.5 2.5 0 0 1 6.5 4H20v15H6.5A2.5 2.5 0 0 0 4 21.5"/>',
  headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
  chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="8" width="3" height="12"/><rect x="16" y="4" width="3" height="16"/>',
  broadcast: '<circle cx="12" cy="18" r="1.4"/><path d="M8.5 15a5.2 5.2 0 0 1 7 0"/><path d="M5 11.5a10 10 0 0 1 14 0"/>',
  gamepad: '<rect x="2" y="8" width="20" height="10" rx="5"/><line x1="7" y1="11" x2="7" y2="15"/><line x1="5" y1="13" x2="9" y2="13"/><circle cx="16" cy="12" r="1"/><circle cx="18.5" cy="15" r="1"/>',
  wand: '<line x1="4" y1="20" x2="14" y2="10"/><line x1="17" y1="3" x2="17" y2="7"/><line x1="15" y1="5" x2="19" y2="5"/><line x1="20" y1="8" x2="20" y2="10.5"/><line x1="18.75" y1="9.25" x2="21.25" y2="9.25"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.6" y1="4.6" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6.7" y2="17.3"/><line x1="17.3" y1="6.7" x2="19.4" y2="4.6"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><line x1="12" y1="11" x2="12" y2="21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h12V10"/><rect x="10" y="14" width="4" height="6"/>',
  sort: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="9" y2="18"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21,3 21,9 15,9"/>',
  file: '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
  router: '<rect x="3" y="13" width="18" height="7" rx="1.5"/><line x1="7" y1="13" x2="7" y2="8.5"/><line x1="17" y1="13" x2="17" y2="8.5"/><circle cx="7" cy="7" r="1.2"/><circle cx="17" cy="7" r="1.2"/><circle cx="8" cy="16.5" r="0.9"/><circle cx="11.5" cy="16.5" r="0.9"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  code: '<polyline points="8,6 3,12 8,18"/><polyline points="16,6 21,12 16,18"/>'
};
