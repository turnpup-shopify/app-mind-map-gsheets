/* Runtime state + the few things we remember in localStorage. */

const KEY = k => "mm." + k;

function read(k, fallback) {
  try {
    const v = localStorage.getItem(KEY(k));
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function write(k, v) {
  try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch { /* private mode */ }
}

export const prefs = {
  get theme()   { return read("theme", null); },
  set theme(v)  { write("theme", v); },
  get layout()  { return read("layout", "radial"); },
  set layout(v) { write("layout", v); },
  get sort()    { return read("sort", "recent"); },
  set sort(v)   { write("sort", v); },
  get master()  { try { return localStorage.getItem(KEY("master")); } catch { return null; } },
  set master(v) { try { localStorage.setItem(KEY("master"), v); } catch { /* ignore */ } },
};

/* ---- favourites & recents, keyed by the map's CSV url ---- */
export const favourites = {
  all()          { return new Set(read("favs", [])); },
  has(url)       { return this.all().has(url); },
  toggle(url)    { const s = this.all(); s.has(url) ? s.delete(url) : s.add(url); write("favs", [...s]); return s.has(url); },
};

export const recents = {
  all()          { return read("recents", []); },          // [{url, at}]
  touch(url)     {
    const list = this.all().filter(r => r.url !== url);
    list.unshift({ url, at: Date.now() });
    write("recents", list.slice(0, 12));
  },
  at(url)        { return (this.all().find(r => r.url === url) || {}).at || 0; },
};

/* ---- in-memory state for the session ---- */
export const state = {
  /* home */
  masterUrl: null,
  demo: false,
  maps: [],                 // [{title, desc, tags[], url, color}]
  query: "",
  selectedTags: new Set(),
  treeCache: new Map(),     // url -> parsed tree (used for counts + cross-map search)

  /* map view */
  current: null,            // {title, url, color}
  root: null,               // d3 hierarchy
  layout: prefs.layout,
  poll: null,
  zoom: null,
  outlineOpen: false,
  selectedId: null,
  focusId: null,            // branch currently focused
  matches: [],              // ids matching the in-map find
  matchIdx: -1,
  findQuery: "",
  presenting: false,
};
