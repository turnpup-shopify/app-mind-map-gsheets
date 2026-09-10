/* The map canvas: layouts, zoom, expand/collapse, selection, polling.
   Other panels listen to the bus rather than reaching in here. */
import { CONFIG, GEOM } from "./config.js";
import { $, esc, bus, fmtTime, copyText, flashLabel } from "./util.js";
import { state, prefs, recents, favourites } from "./store.js";
import { fetchCsv, parseMap } from "./data.js";

/* ------------------------------- setup ----------------------------- */
const svg    = d3.select("#canvas");
const gRoot  = svg.append("g");
const gLinks = gRoot.append("g");
const gNodes = gRoot.append("g");

state.zoom = d3.zoom().scaleExtent([0.08, 4]).on("zoom", e => {
  gRoot.attr("transform", e.transform);
  bus.emit("zoom", e.transform);
});
svg.call(state.zoom).on("dblclick.zoom", null);

export const getSvg = () => svg.node();
export const getGroup = () => gRoot.node();

/* ------------------------------ helpers ---------------------------- */
/** Every node, including ones hidden behind a collapsed parent. */
export function allNodes(root = state.root) {
  const out = [];
  (function walk(n) {
    out.push(n);
    (n.children || n._children || []).forEach(walk);
  })(root);
  return out;
}
export const byId = id => allNodes().find(n => n.id === id) || null;
export const isInside = (n, d) => n === d || n.ancestors().includes(d);
export const pathNames = d => d.ancestors().reverse().map(a => a.data.name);

function collapse(n) { if (n.children) { n._children = n.children; n.children = null; } }
function expand(n)   { if (n._children) { n.children = n._children; n._children = null; } }

export function toggle(d) { d.children ? collapse(d) : expand(d); }

/** Open every ancestor so `d` is on screen. */
export function expandTo(d) { d.ancestors().slice(1).forEach(expand); }

function assignIds(root) {
  root.eachBefore(d => {
    if (!d.parent) { d.id = d.data.name; return; }
    const sibs = d.parent.children || [];
    const twins = sibs.filter(s => s.data.name === d.data.name);
    const dup = twins.length > 1 ? "~" + twins.indexOf(d) : "";
    d.id = d.parent.id + " / " + d.data.name + dup;
  });
}

function setStatus(msg, err = false) {
  const s = $("#status");
  s.hidden = !msg;
  s.textContent = msg || "";
  s.classList.toggle("err", err);
}
function mapMsg(html) {
  const m = $("#mapMsg");
  m.hidden = !html;
  if (html) m.firstElementChild.innerHTML = html;
}

/* --------------------------- loading a map ------------------------- */
export async function openMap(meta, { keepState = false } = {}) {
  const isNew = !state.current || state.current.url !== meta.url;
  state.current = meta;
  $("#mapTitle").textContent = meta.title || "Mind map";
  $("#favBtn").setAttribute("aria-pressed", String(favourites.has(meta.url)));

  if (isNew) {
    closeDetail();
    state.focusId = null;
    state.matches = []; state.matchIdx = -1;
    gLinks.selectAll("*").remove();
    gNodes.selectAll("*").remove();
    state.root = null;
    mapMsg(`<h2>Loading…</h2><p><span class="spinner"></span></p>`);
    recents.touch(meta.url);
  }

  try {
    const data = parseMap(await fetchCsv(meta.url), meta.title);
    if (!meta.title) $("#mapTitle").textContent = data.name;
    document.title = ($("#mapTitle").textContent || "Mind map") + " · Mind Maps";
    mapMsg("");

    const openSet = keepState && state.root
      ? new Set(allNodes().filter(d => d.children).map(d => d.id))
      : null;

    state.root = d3.hierarchy(data);
    assignIds(state.root);
    state.root.each(d => {
      if (!d.children) return;
      const open = openSet ? openSet.has(d.id) : d.depth < CONFIG.INITIAL_DEPTH;
      if (!open) collapse(d);
    });

    update(state.root, !keepState);

    if (state.selectedId) {
      const d = byId(state.selectedId);
      d ? selectNode(d) : closeDetail();
    }
    if (!keepState) setTimeout(fit, 60);

    setStatus(`Updated ${fmtTime()}`);
    bus.emit("map:loaded", state.root);
    startPolling();
  } catch (e) {
    if (!state.root) {
      mapMsg(`<h2>Couldn't read this map</h2><p>${esc(e.message)}</p>
        <div class="row" style="justify-content:center">
          <button class="pill" id="retryMap">Try again</button>
          <button class="pill ghost" id="backFromErr">All maps</button>
        </div>`);
      $("#retryMap").onclick = () => openMap(state.current);
      $("#backFromErr").onclick = () => { location.hash = ""; };
    }
    setStatus("Refresh failed: " + e.message, true);
  }
}

export function startPolling() {
  stopPolling();
  state.poll = setInterval(() => {
    if (state.current && !state.presenting) openMap(state.current, { keepState: true });
  }, CONFIG.POLL_MS);
}
export function stopPolling() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
}

/* ------------------------------ layouts ---------------------------- */
const linkRadial = d3.linkRadial().angle(d => d.a).radius(d => d.r);
const linkH = d3.linkHorizontal().x(d => d.px).y(d => d.py);
const linkV = d3.linkVertical().x(d => d.px).y(d => d.py);

function linkPath(source, target) {
  const L = state.layout;
  if (L === "radial") return linkRadial({ source, target });
  if (L === "right")  return linkH({ source, target });
  return linkV({ source, target });
}
const origin = d => ({
  a:  d.a0  ?? d.a  ?? 0,
  r:  d.r0  ?? d.r  ?? 0,
  px: d.px0 ?? d.px ?? 0,
  py: d.py0 ?? d.py ?? 0,
});

function computeLayout(root) {
  if (state.layout === "radial") {
    let deepest = 1;
    root.each(d => { deepest = Math.max(deepest, d.depth); });
    const radius = Math.max(GEOM.radialStep * deepest, root.leaves().length * 6.5);
    d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.6) / Math.max(a.depth, 1))(root);
    root.each(d => {
      d.a = d.x; d.r = d.y;
      d.px = Math.cos(d.a - Math.PI / 2) * d.r;
      d.py = Math.sin(d.a - Math.PI / 2) * d.r;
    });
  } else if (state.layout === "right") {
    d3.tree().nodeSize([GEOM.rowGap, GEOM.colGap])(root);
    root.each(d => { d.px = d.y; d.py = d.x; d.a = 0; d.r = 0; });
  } else {
    d3.tree().nodeSize([GEOM.colWidth, GEOM.rowHeight])(root);
    root.each(d => { d.px = d.x; d.py = d.y; d.a = 0; d.r = 0; });
  }
}

export function setLayout(name) {
  if (state.layout === name) return;
  state.layout = name;
  prefs.layout = name;
  document.querySelectorAll("[data-layout]").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.layout === name)));
  if (state.root) { update(state.root); setTimeout(fit, 460); }
}

/* ------------------------------ rendering -------------------------- */
export function update(source = state.root, instant = false) {
  const root = state.root;
  if (!root) return;

  computeLayout(root);

  const nodes = root.descendants();
  const links = root.links();
  const big = nodes.length > CONFIG.BIG_MAP;
  const dur = instant || big ? 0 : 420;
  const t = svg.transition().duration(dur).ease(d3.easeCubicOut);
  const o = origin(source);

  /* links */
  const L = gLinks.selectAll("path.link").data(links, d => d.target.id);
  L.enter().append("path")
    .attr("class", "link")
    .style("--lc", d => d.target.data.color || "#fff")
    .attr("d", () => linkPath(o, o))
    .merge(L)
    .transition(t)
      .attr("d", d => linkPath(d.source, d.target))
      .style("--lc", d => d.target.data.color || "#fff");
  L.exit().transition(t).attr("d", () => linkPath(o, o)).remove();

  /* nodes */
  const N = gNodes.selectAll("g.node").data(nodes, d => d.id);
  const enter = N.enter().append("g")
    // the class matters for the next data join — applyClasses() selects g.node
    .attr("class", d => `node depth-${Math.min(d.depth, 2)}`)
    .attr("transform", () => `translate(${o.px},${o.py})`)
    .style("opacity", 0)
    .on("click", (e, d) => { toggle(d); update(d); selectNode(d); })
    .on("mouseenter", (e, d) => showTip(e, d))
    .on("mousemove", moveTip)
    .on("mouseleave", hideTip);
  enter.append("circle").attr("class", "main");
  enter.append("circle").attr("class", "note-dot");
  enter.append("text");

  const all = enter.merge(N);
  all.select("circle.main")
     .attr("r", d => d.depth === 0 ? 11 : d.depth === 1 ? 7 : 5)
     .attr("fill", d => d.depth === 0 ? "#fff" : (d.data.color || "#fff"));
  all.select(".note-dot")
     .attr("r", d => (d.data.notes || d.data.link) ? 2.6 : 0)
     .attr("cx", d => d.depth === 0 ? 10 : d.depth === 1 ? 7 : 5)
     .attr("cy", d => d.depth === 0 ? -10 : d.depth === 1 ? -7 : -5);
  placeText(all.select("text"));
  all.transition(t).style("opacity", 1).attr("transform", d => `translate(${d.px},${d.py})`);
  N.exit().transition(t).style("opacity", 0)
    .attr("transform", () => `translate(${source.px},${source.py})`).remove();

  root.each(d => { d.a0 = d.a; d.r0 = d.r; d.px0 = d.px; d.py0 = d.py; });

  applyClasses();
  bus.emit("map:render", root);
}

function placeText(sel) {
  const L = state.layout;
  sel
    .attr("dy", L === "down" ? "0" : "0.32em")
    .attr("transform", d => {
      if (L === "radial" && d.depth === 0) return "translate(0,-22)";
      return null;
    })
    .attr("x", d => {
      if (L === "radial") return d.depth === 0 ? 0 : (d.a < Math.PI ? 12 : -12);
      if (L === "right")  return d.children ? -11 : 11;
      return 0;
    })
    .attr("y", d => {
      if (L !== "down") return 0;
      return d.children ? -15 : 17;
    })
    .attr("text-anchor", d => {
      if (L === "radial") return d.depth === 0 ? "middle" : (d.a < Math.PI ? "start" : "end");
      if (L === "right")  return d.children ? "end" : "start";
      return "middle";
    })
    .text(d => d.data.name + (d._children ? ` (${d._children.length})` : ""));
}

/** Re-apply the state-driven classes without a full re-layout. */
export function applyClasses() {
  const matches = new Set(state.matches);
  const onPath = new Set();
  if (matches.size) {
    allNodes().forEach(n => {
      if (matches.has(n.id)) n.ancestors().forEach(a => onPath.add(a.id));
    });
  }
  const current = state.matchIdx >= 0 ? state.matches[state.matchIdx] : null;
  gNodes.selectAll("g.node").attr("class", d =>
    `node depth-${Math.min(d.depth, 2)}` +
    (d._children ? " has-hidden" : "") +
    (d.id === state.selectedId ? " selected" : "") +
    (matches.has(d.id) ? " match" : "") +
    (d.id === current ? " current-match" : "") +
    (onPath.has(d.id) ? " on-path" : "")
  );
  $("#map").classList.toggle("searching", matches.size > 0);
}

/* --------------------------- bulk expand/collapse ------------------ */
export function setAll(open) {
  if (!state.root) return;
  allNodes().forEach(d => {
    if (open) expand(d);
    else if (d.depth >= 1) collapse(d);
  });
  state.focusId = null;
  update(state.root);
  setTimeout(fit, 450);
}

/* ------------------------------ viewport --------------------------- */
export function fit() {
  const box = gRoot.node().getBBox();
  if (!box.width || !box.height) return;
  // leave room for whatever panels are open
  const rightPad = state.outlineOpen && innerWidth > 900 ? 356 : 0;
  const bottomPad = state.presenting ? 220 : 0;
  const W = svg.node().clientWidth - rightPad;
  const H = svg.node().clientHeight - bottomPad;
  const k = Math.min(0.84 * W / box.width, 0.84 * H / box.height, 1.6);
  const tx = W / 2 - k * (box.x + box.width / 2);
  const ty = H / 2 - k * (box.y + box.height / 2);
  svg.transition().duration(500).call(state.zoom.transform,
    d3.zoomIdentity.translate(tx, ty).scale(k));
}

export function centerOn(d, scale) {
  const W = svg.node().clientWidth, H = svg.node().clientHeight;
  const k = scale ?? Math.max(d3.zoomTransform(svg.node()).k, 1);
  svg.transition().duration(500).call(state.zoom.transform,
    d3.zoomIdentity.translate(W / 2 - k * d.px, H / 2 - k * d.py).scale(k));
}

export function panTo(x, y) {
  const W = svg.node().clientWidth, H = svg.node().clientHeight;
  const k = d3.zoomTransform(svg.node()).k;
  svg.transition().duration(300).call(state.zoom.transform,
    d3.zoomIdentity.translate(W / 2 - k * x, H / 2 - k * y).scale(k));
}

/* ------------------------------- focus ----------------------------- */
export function focusBranch(d) {
  if (!d || !d.parent) return clearFocus();
  state.focusId = d.id;
  const chain = new Set(d.ancestors());
  allNodes().forEach(n => {
    if (isInside(n, d)) return;
    if (chain.has(n)) {
      (n.children || []).forEach(c => { if (!chain.has(c)) collapse(c); });
    } else collapse(n);
  });
  expand(d);
  update(d);
  if (state.selectedId === d.id) selectNode(d);   // keep the panel's labels honest
  setTimeout(fit, 450);
  bus.emit("map:focus", d);
}
export function clearFocus() {
  state.focusId = null;
  update(state.root);
  bus.emit("map:focus", null);
}

/* --------------------------- detail panel -------------------------- */
export function selectNode(d) {
  state.selectedId = d.id;
  const kids = d.children || d._children || [];
  const path = d.ancestors().slice(1).reverse().map(a => a.data.name).join(" › ");
  const el = $("#detail");

  el.innerHTML = `
    <header>
      <span class="sw" style="background:${d.depth === 0 ? "#fff" : esc(d.data.color || "#fff")}"></span>
      <h2>${esc(d.data.name)}</h2>
      <button class="icon-btn" id="detailClose" aria-label="Close details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </header>
    ${path ? `<div class="path" title="${esc(path)}">${esc(path)}</div>` : ""}
    <p class="notes ${d.data.notes ? "" : "none"}">${d.data.notes ? esc(d.data.notes) : "No notes yet. Add them in the Notes column of the sheet."}</p>
    ${d.data.link ? `<a class="link" href="${esc(d.data.link)}" target="_blank" rel="noopener">${esc(d.data.link)}</a>` : ""}
    ${kids.length ? `<ul class="kidlist">${kids.map((k, i) =>
      `<li><button data-kid="${i}"><span class="sw" style="background:${esc(k.data.color || "#fff")}"></span>${esc(k.data.name)}</button></li>`).join("")}</ul>` : ""}
    <div class="foot">
      ${kids.length ? `<button class="pill small" id="detailToggle">${d.children ? "Hide" : "Show"} ${kids.length} sub-topic${kids.length === 1 ? "" : "s"}</button>` : `<span class="pill small ghost" style="cursor:default">No sub-topics</span>`}
      ${kids.length && d.parent ? `<button class="pill small" id="detailFocus">Focus branch</button>` : ""}
      <button class="pill small" id="detailCenter">Centre</button>
      <button class="pill small" id="detailLink">Copy link</button>
      <button class="pill small" id="detailCopy">Copy details</button>
    </div>`;
  el.hidden = false;

  $("#detailClose").onclick = closeDetail;
  const tg = $("#detailToggle");
  if (tg) tg.onclick = () => { toggle(d); update(d); selectNode(d); };
  const fb = $("#detailFocus");
  if (fb) fb.onclick = () => focusBranch(d);
  $("#detailCenter").onclick = () => centerOn(d);
  $("#detailCopy").onclick = () => copyDetails(d, $("#detailCopy"));
  $("#detailLink").onclick = async () => {
    const ok = await copyText(nodeUrl(d));
    flashLabel($("#detailLink"), ok ? "Copied" : "Couldn't copy");
  };
  el.querySelectorAll("[data-kid]").forEach(b => {
    b.onclick = () => {
      const k = kids[+b.dataset.kid];
      expandTo(k); update(k); selectNode(k); centerOn(k);
    };
  });

  applyClasses();
  bus.emit("map:select", d);
}

export function closeDetail() {
  state.selectedId = null;
  $("#detail").hidden = true;
  applyClasses();
  bus.emit("map:select", null);
}

/** A shareable URL that reopens this map at this topic. */
export function nodeUrl(d) {
  const m = state.current || {};
  const p = new URLSearchParams();
  p.set("map", m.url || "");
  if (m.title) p.set("title", m.title);
  if (m.color) p.set("color", m.color);
  p.set("layout", state.layout);
  if (d) p.set("node", d.id);
  return location.origin + location.pathname + location.search + "#" + p.toString();
}

async function copyDetails(d, btn) {
  const path = pathNames(d).join(" › ");
  const lines = [d.data.name, path !== d.data.name ? path : ""];
  if (d.data.notes) lines.push("", d.data.notes);
  if (d.data.link) lines.push("", d.data.link);
  const kids = d.children || d._children || [];
  if (kids.length) lines.push("", "Sub-topics:", ...kids.map(k => "• " + k.data.name));
  const text = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
  const ok = await copyText(text);
  flashLabel(btn, ok ? "Copied" : "Couldn't copy");
}

/* ------------------------------ tooltip ---------------------------- */
function showTip(e, d) {
  if (!d.data.notes && !d.data.link) return;
  const tip = $("#tip");
  tip.innerHTML = `<b>${esc(d.data.name)}</b>` +
    (d.data.notes ? `<p>${esc(d.data.notes)}</p>` : "") +
    (d.data.link ? `<a>${esc(d.data.link)}</a>` : "");
  tip.classList.add("show");
  moveTip(e);
}
function moveTip(e) {
  const tip = $("#tip");
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 12);
  const y = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 12);
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
function hideTip() { $("#tip").classList.remove("show"); }

/* -------------------------- keyboard movement ---------------------- */
export function moveSelection(dir) {
  if (!state.root) return;
  const cur = state.selectedId ? byId(state.selectedId) : null;
  if (!cur) { selectNode(state.root); centerOn(state.root); return; }

  let next = null;
  if (dir === "left") next = cur.parent;
  else if (dir === "right") {
    if (cur._children) { expand(cur); update(cur); }
    next = (cur.children || [])[0];
  } else {
    const sibs = cur.parent ? cur.parent.children : [cur];
    const i = sibs.indexOf(cur);
    next = dir === "down" ? sibs[i + 1] : sibs[i - 1];
    if (!next && dir === "down") next = (cur.children || [])[0];
  }
  if (!next) return;
  expandTo(next);
  selectNode(next);
  centerOn(next);
}
