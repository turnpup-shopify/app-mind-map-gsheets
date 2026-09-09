/* The homepage: the list of maps, filters, and search across every map. */
import { CONFIG } from "./config.js";
import { $, esc, highlight, debounce } from "./util.js";
import { state, prefs, favourites, recents } from "./store.js";
import { fetchCsv, parseMaster, parseMap, countNodes, maxDepth, flatten } from "./data.js";

const MAP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V4"/><path d="M14.2 13.3 18.5 17"/><path d="M9.8 13.3 5.5 17"/><circle cx="12" cy="3" r="1"/><circle cx="19.5" cy="17.8" r="1"/><circle cx="4.5" cy="17.8" r="1"/></svg>`;
const STAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9Z"/></svg>`;

export function resolveMaster() {
  const p = new URLSearchParams(location.search);
  return p.get("master") || prefs.master || CONFIG.MASTER_CSV_URL || null;
}

/* ------------------------------- load ------------------------------ */
export async function loadHome() {
  const body = $("#homeBody");
  state.masterUrl = state.demo ? "demo:master" : resolveMaster();
  $("#demoBanner").hidden = !state.demo;

  const openMaster = $("#openMaster");
  openMaster.hidden = !(state.masterUrl && !state.demo);
  if (!openMaster.hidden) openMaster.href = state.masterUrl.replace(/\/(gviz|export|pub)\b.*$/, "/edit");

  if (!state.masterUrl) { renderSetup(body); return; }

  body.innerHTML = `<p class="count"><span class="spinner"></span> Reading the master sheet…</p>
    <div class="skel"><span></span><span></span><span></span></div>`;
  try {
    state.maps = parseMaster(await fetchCsv(state.masterUrl));
    if (!state.maps.length) {
      body.innerHTML = `<div class="empty glass"><h2>The master sheet is empty</h2>
        <p>Add one row per map: Title, Description, Tags, CSV URL.</p>
        <div class="row"><button class="pill" id="retryHome">Check again</button>
        <button class="pill ghost" id="changeSrc">Change source</button></div></div>`;
      $("#retryHome").onclick = loadHome;
      $("#changeSrc").onclick = () => renderSetup(body);
      return;
    }
    renderHome();
    prefetch();
  } catch (e) {
    body.innerHTML = `<div class="empty glass"><h2>Couldn't read the master sheet</h2><p>${esc(e.message)}</p>
      <div class="row"><button class="pill" id="retryHome">Try again</button>
      <button class="pill ghost" id="changeSrc">Change source</button>
      <button class="pill ghost" id="demoBtn">Look at sample maps</button></div></div>`;
    $("#retryHome").onclick = loadHome;
    $("#changeSrc").onclick = () => renderSetup(body);
    $("#demoBtn").onclick = () => { state.demo = true; loadHome(); };
  }
}

/* ------------------------------ setup ------------------------------ */
export function renderSetup(body = $("#homeBody")) {
  const current = prefs.master || CONFIG.MASTER_CSV_URL || "";
  body.innerHTML = `
  <div class="setup glass">
    <h2>Connect the master list</h2>
    <p>One Google Sheet lists every mind map. Share the folder as <b>Anyone with the link · Viewer</b>, then paste the sheet's CSV export link here.</p>
    <div class="cols"><span>Title</span><span>Description</span><span>Tags</span><span>CSV URL</span><span>Color (optional)</span></div>
    <p style="font-size:.86rem">The CSV link looks like <code>https://docs.google.com/spreadsheets/d/SHEET-ID/gviz/tq?tqx=out:csv</code>. Separate tags with commas or semicolons.</p>
    <label for="masterInput">Master sheet CSV link</label>
    <input id="masterInput" type="url" placeholder="https://docs.google.com/spreadsheets/d/…/gviz/tq?tqx=out:csv" value="${esc(current)}">
    <div class="row">
      <button class="pill" id="saveMaster">Use this sheet</button>
      <button class="pill ghost" id="tryDemo">Look at sample maps first</button>
    </div>
  </div>`;
  $("#saveMaster").onclick = () => {
    const v = $("#masterInput").value.trim();
    if (!v) return $("#masterInput").focus();
    prefs.master = v;
    state.demo = false;
    state.selectedTags.clear();
    state.query = "";
    state.treeCache.clear();
    loadHome();
  };
  $("#tryDemo").onclick = () => { state.demo = true; loadHome(); };
}

/* ------------------------------ render ----------------------------- */
export function renderHome() {
  const body = $("#homeBody");
  const allTags = [...new Set(state.maps.flatMap(m => m.tags))].sort((a, b) => a.localeCompare(b));

  body.innerHTML = `
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search maps and topics" value="${esc(state.query)}" aria-label="Search maps and topics">
    </div>
    <div class="controls" id="controls"></div>
    <div id="results"></div>`;

  $("#q").addEventListener("input", debounce(e => { state.query = e.target.value; renderList(); }, 120));

  const row = $("#controls");
  allTags.forEach(t => {
    const b = document.createElement("button");
    b.className = "pill small";
    b.textContent = t;
    b.setAttribute("aria-pressed", String(state.selectedTags.has(t)));
    b.onclick = () => {
      state.selectedTags.has(t) ? state.selectedTags.delete(t) : state.selectedTags.add(t);
      b.setAttribute("aria-pressed", String(state.selectedTags.has(t)));
      clear.hidden = !state.selectedTags.size;
      renderList();
    };
    row.appendChild(b);
  });

  const clear = document.createElement("button");
  clear.className = "clear";
  clear.textContent = "Clear filters";
  clear.hidden = !state.selectedTags.size;
  clear.onclick = () => { state.selectedTags.clear(); renderHome(); };
  row.appendChild(clear);

  const spacer = document.createElement("span");
  spacer.className = "spacer";
  row.appendChild(spacer);

  const sort = document.createElement("select");
  sort.setAttribute("aria-label", "Sort maps");
  sort.innerHTML = `
    <option value="recent">Recently opened</option>
    <option value="name">Name</option>
    <option value="size">Most topics</option>
    <option value="sheet">Sheet order</option>`;
  sort.value = prefs.sort;
  sort.onchange = () => { prefs.sort = sort.value; renderList(); };
  row.appendChild(sort);

  renderList();
}

function sortMaps(list) {
  const mode = prefs.sort;
  const arr = [...list];
  if (mode === "name") arr.sort((a, b) => a.title.localeCompare(b.title));
  else if (mode === "size") arr.sort((a, b) => (size(b) - size(a)));
  else if (mode === "recent") arr.sort((a, b) => recents.at(b.url) - recents.at(a.url));
  // favourites always float to the top
  const favs = favourites.all();
  arr.sort((a, b) => (favs.has(b.url) ? 1 : 0) - (favs.has(a.url) ? 1 : 0));
  return arr;
}
const size = m => {
  const t = state.treeCache.get(m.url);
  return t ? countNodes(t) : 0;
};

export function renderList() {
  const q = state.query.trim().toLowerCase();
  const results = $("#results");
  if (!results) return;

  const hits = q.length >= 2 ? topicHits(q) : [];
  const inHits = new Set(hits.map(h => h.map.url));

  const matched = state.maps.filter(m => {
    const tagOk = !state.selectedTags.size || m.tags.some(t => state.selectedTags.has(t));
    const qOk = !q
      || (m.title + " " + m.desc + " " + m.tags.join(" ")).toLowerCase().includes(q)
      || inHits.has(m.url);                 // a map counts as a match if a topic inside it does
    return tagOk && qOk;
  });
  results.innerHTML = "";

  if (hits.length) {
    const h = document.createElement("div");
    h.innerHTML = `<p class="section-title">Topics · ${hits.length}${hits.length > CONFIG.MAX_TOPIC_HITS ? " (showing first " + CONFIG.MAX_TOPIC_HITS + ")" : ""}</p><div class="hits"></div>`;
    const list = h.querySelector(".hits");
    hits.slice(0, CONFIG.MAX_TOPIC_HITS).forEach(hit => {
      const b = document.createElement("button");
      b.className = "hit-btn";
      b.innerHTML = `
        <span class="sw" style="background:${esc(hit.map.color)}"></span>
        <span class="txt">
          <span class="name">${highlight(hit.name, state.query.trim())}</span>
          <span class="where">${esc(hit.path.join(" › ") || "top level")}</span>
        </span>
        <span class="in">${esc(hit.map.title)}</span>`;
      b.onclick = () => openMapHash(hit.map, hit.id);
      list.appendChild(b);
    });
    results.appendChild(h);
  }

  const head = document.createElement("p");
  head.className = "section-title";
  head.textContent = hits.length ? `Maps · ${matched.length}` :
    (matched.length === state.maps.length
      ? `${state.maps.length} ${state.maps.length === 1 ? "map" : "maps"}`
      : `${matched.length} of ${state.maps.length} maps`);
  results.appendChild(head);

  if (!matched.length) {
    const e = document.createElement("div");
    e.className = "empty glass";
    e.innerHTML = `<h2>No maps match</h2><p>Try a different word, or clear the tag filters.</p>`;
    results.appendChild(e);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "maps";
  sortMaps(matched).forEach(m => wrap.appendChild(card(m, q)));
  results.appendChild(wrap);
}

function card(m, q) {
  const tree = state.treeCache.get(m.url);
  const b = document.createElement("button");
  b.className = "map-btn glass";
  b.style.setProperty("--c", m.color);
  const stats = tree ? `${countNodes(tree)} topics · ${maxDepth(tree)} levels deep` : "";
  const branches = tree
    ? tree.children.slice(0, 4).map(c => c.name).join(" · ") + (tree.children.length > 4 ? " · …" : "")
    : "";
  b.innerHTML = `
    <span class="dot">${MAP_ICON}</span>
    <span class="body">
      <span class="title">${highlight(m.title, q)}</span>
      ${m.desc ? `<span class="desc">${highlight(m.desc, q)}</span>` : ""}
      <span class="meta">${m.tags.map(t => `<span class="chip ${state.selectedTags.has(t) ? "hit" : ""}">${esc(t)}</span>`).join("")}<span class="n">${esc(stats)}</span></span>
      ${branches ? `<span class="branches">${esc(branches)}</span>` : ""}
    </span>`;
  b.onclick = () => openMapHash(m);

  const star = document.createElement("button");
  star.className = "star";
  star.innerHTML = STAR;
  star.title = "Favourite";
  star.setAttribute("aria-label", `Favourite ${m.title}`);
  star.setAttribute("aria-pressed", String(favourites.has(m.url)));
  star.onclick = e => {
    e.stopPropagation();
    const on = favourites.toggle(m.url);
    star.setAttribute("aria-pressed", String(on));
    renderList();
  };
  b.appendChild(star);
  return b;
}

export function openMapHash(m, nodeId) {
  const p = new URLSearchParams();
  p.set("map", m.url);
  p.set("title", m.title);
  p.set("color", m.color);
  if (nodeId) p.set("node", nodeId);
  location.hash = p.toString();
}

/* --------------------- search inside every map --------------------- */
function topicHits(q) {
  const out = [];
  for (const m of state.maps) {
    const tree = state.treeCache.get(m.url);
    if (!tree) continue;
    for (const t of flatten(tree)) {
      const inName = t.name.toLowerCase().includes(q);
      const inNotes = (t.notes || "").toLowerCase().includes(q);
      if (!inName && !inNotes) continue;
      out.push({
        name: t.name,
        path: t.path,
        map: m,
        id: [...t.path, t.name].join(" / "),
        score: (inName ? 0 : 1) + (t.name.toLowerCase() === q ? -1 : 0) + t.path.length * 0.05,
      });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

/* Load every map's tree quietly so counts and topic search work. */
async function prefetch() {
  for (const m of state.maps) {
    if (state.treeCache.has(m.url)) continue;
    try {
      const tree = parseMap(await fetchCsv(m.url), m.title);
      state.treeCache.set(m.url, tree);
      if ($("#results")) renderList();
    } catch { /* a broken map shouldn't stop the others */ }
  }
}
