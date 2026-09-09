/* Reading Google Sheets CSV and turning it into maps. */
import { CONFIG, PALETTE } from "./config.js";
import { normColor } from "./util.js";
import { DEMO_MASTER, DEMO_MAPS } from "./demo.js";

/* ------------------------------ fetching --------------------------- */
export async function fetchCsv(url) {
  if (url.startsWith("demo:")) {
    const key = url.slice(5);
    if (key === "master") return DEMO_MASTER;
    if (!DEMO_MAPS[key]) throw new Error("Unknown sample map.");
    return DEMO_MAPS[key];
  }
  const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  let res;
  try {
    res = await fetch(url + bust, { cache: "no-store" });
  } catch {
    throw new Error("Couldn't reach the sheet. Check the link and your connection.");
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error("Google refused the request. Set the sheet's sharing to “Anyone with the link · Viewer”.");
    if (res.status === 404)
      throw new Error("No sheet at that link. Check the spreadsheet ID.");
    throw new Error(`The sheet returned ${res.status}.`);
  }
  const text = await res.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(text))
    throw new Error("Got a web page instead of CSV — use the sheet's CSV export link, not the editor link.");
  return text;
}

function parseCsv(text) {
  const out = Papa.parse(text.trim(), { skipEmptyLines: "greedy" });
  return out.data.map(r => r.map(c => (c ?? "").toString().trim()));
}

const norm = h => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/* --------------------------- the master list ----------------------- */
/** CSV -> [{title, desc, tags[], url, color}] */
export function parseMaster(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const H = rows[0].map(norm);
  const idx = (...names) => H.findIndex(h => names.includes(h));
  const iT = idx("title", "name", "map");
  const iD = idx("description", "desc", "summary");
  const iG = idx("tags", "tag", "type", "types", "category");
  const iU = idx("csvurl", "csv", "url", "link", "sheet");
  const iC = idx("color", "colour");
  if (iT < 0 || iU < 0)
    throw new Error("The master sheet needs at least a Title column and a CSV URL column.");
  return rows.slice(1)
    .filter(r => r[iT] && r[iU])
    .map((r, i) => ({
      title: r[iT],
      desc: iD >= 0 ? r[iD] : "",
      tags: iG >= 0 ? r[iG].split(/[;,|]/).map(t => t.trim()).filter(Boolean) : [],
      url: r[iU],
      color: (iC >= 0 && normColor(r[iC])) || PALETTE[i % PALETTE.length],
    }));
}

/* ------------------------------ one map ---------------------------- */
/** Indented CSV -> {name, notes, link, color, children[]} */
export function parseMap(text, fallbackTitle) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("The sheet is empty.");

  const H = rows[0].map(norm);
  let levelCols = H.map((h, i) => /^(level|lvl|l)\d*$/.test(h) ? i : -1).filter(i => i >= 0);
  const notesIdx = H.findIndex(h => h === "notes" || h === "note");
  const colorIdx = H.findIndex(h => h === "color" || h === "colour");
  const linkIdx  = H.findIndex(h => h === "link" || h === "url");
  const reserved = new Set([notesIdx, colorIdx, linkIdx].filter(i => i >= 0));

  let body = rows.slice(1);
  if (!levelCols.length) {
    // No "Level" headers: treat every non-reserved column as a level and the
    // first row as data rather than a header.
    levelCols = H.map((_, i) => (reserved.has(i) ? -1 : i)).filter(i => i >= 0);
    body = rows;
  }

  const roots = [];
  const stack = [];
  for (const r of body) {
    let depth = -1, label = "";
    for (let d = 0; d < levelCols.length; d++) {
      const v = r[levelCols[d]];
      if (v) { depth = d; label = v; break; }
    }
    if (depth < 0) continue;               // blank spacer row

    const node = {
      name: label,
      notes: notesIdx >= 0 ? r[notesIdx] : "",
      link:  linkIdx  >= 0 ? r[linkIdx]  : "",
      color: colorIdx >= 0 ? normColor(r[colorIdx]) : null,
      children: [],
    };

    if (depth === 0) roots.push(node);
    else {
      let parent = null;
      for (let d = depth - 1; d >= 0; d--) if (stack[d]) { parent = stack[d]; break; }
      (parent ? parent.children : roots).push(node);
    }
    stack.length = depth;
    stack[depth] = node;
  }

  if (!roots.length)
    throw new Error("No topics found. Put the centre topic in the Level 1 column.");

  const root = roots.length === 1
    ? roots[0]
    : { name: fallbackTitle || "Mind map", notes: "", link: "", color: null, children: roots };

  // First-level branches take a palette colour unless one is set; children inherit.
  root.children.forEach((c, i) => { if (!c.color) c.color = PALETTE[i % PALETTE.length]; });
  (function inherit(n) {
    n.children.forEach(c => { if (!c.color) c.color = n.color; inherit(c); });
  })(root);

  return root;
}

/* ------------------------------- stats ----------------------------- */
export function countNodes(n) {
  return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}
export function maxDepth(n, d = 0) {
  return n.children.length ? Math.max(...n.children.map(c => maxDepth(c, d + 1))) : d;
}
export function topBranches(n) {
  return n.children.map(c => c.name);
}

/** Flatten a tree into [{name, notes, link, path[]}] for cross-map search. */
export function flatten(root) {
  const out = [];
  (function walk(n, path) {
    out.push({ name: n.name, notes: n.notes, link: n.link, path });
    n.children.forEach(c => walk(c, [...path, n.name]));
  })(root, []);
  return out;
}

/** Load and cache a map's tree. */
export async function loadTree(url, title, cache) {
  if (cache?.has(url)) return cache.get(url);
  const tree = parseMap(await fetchCsv(url), title);
  cache?.set(url, tree);
  return tree;
}

export { CONFIG };
