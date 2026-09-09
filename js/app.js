/* Wiring: routing, the toolbar, keyboard shortcuts, theme. */
import { $, bus } from "./util.js";
import { state, prefs, favourites } from "./store.js";
import { loadHome, renderSetup, resolveMaster } from "./home.js";
import {
  openMap, stopPolling, update, setAll, fit, setLayout, selectNode, closeDetail,
  byId, allNodes, expandTo, centerOn, moveSelection, clearFocus, toggle,
} from "./mapview.js";
import { setOutline } from "./outline.js";
import { initFind, openFind, closeFind, isOpen as findOpen } from "./find.js";
import { initMinimap } from "./minimap.js";
import { initExportMenu } from "./exports.js";
import { initPresent, start as startPresent, exit as exitPresent, next as presentNext, prev as presentPrev, active as presenting } from "./present.js";
import "./crumbs.js";

/* ------------------------------- theme ----------------------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  prefs.theme = t;
}
applyTheme(prefs.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
$("#themeBtn").onclick = () =>
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");

/* ------------------------------ routing ---------------------------- */
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  document.body.style.overflow = id === "map" ? "hidden" : "";
}

async function route() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  const mapUrl = h.get("map");

  if (!mapUrl) {
    stopPolling();
    if (presenting()) exitPresent();
    closeFind();
    document.title = "Mind Maps";
    showView("home");
    loadHome();
    return;
  }

  showView("map");
  if (h.get("layout")) setLayout(h.get("layout"));
  const wanted = h.get("node");
  state.selectedId = wanted || state.selectedId;

  await openMap({
    url: mapUrl,
    title: h.get("title") || "",
    color: h.get("color") || "",
  });

  if (wanted) revealNode(wanted);
}

/** Deep links may carry an id from the homepage index; fall back to the name. */
function revealNode(id) {
  if (!state.root) return;
  let d = byId(id);
  if (!d) {
    const leaf = id.split(" / ").pop().replace(/~\d+$/, "");
    d = allNodes().find(n => n.data.name === leaf);
  }
  if (!d) return;
  expandTo(d);
  update(d);
  selectNode(d);
  setTimeout(() => centerOn(d, 1), 300);
}

window.addEventListener("hashchange", route);

/* ---------------------------- home buttons ------------------------- */
$("#settingsBtn").onclick = () => {
  state.demo = false;
  renderSetup();
  $("#demoBanner").hidden = true;
  $("#openMaster").hidden = true;
};
$("#leaveDemo").onclick = () => {
  state.demo = false;
  renderSetup();
  $("#demoBanner").hidden = true;
};

/* --------------------------- map toolbar --------------------------- */
$("#backBtn").onclick = () => { location.hash = ""; };
$("#fitBtn").onclick = fit;
$("#expandBtn").onclick = () => setAll(true);
$("#collapseBtn").onclick = () => setAll(false);
$("#outlineBtn").onclick = () => setOutline(!state.outlineOpen);
$("#outlineClose").onclick = () => setOutline(false);
$("#presentBtn").onclick = () => (presenting() ? exitPresent() : startPresent());
$("#refreshBtn").onclick = async () => {
  const b = $("#refreshBtn");
  const html = b.innerHTML;
  b.innerHTML = `<span class="spinner"></span>`;
  b.disabled = true;
  await openMap(state.current, { keepState: true });
  b.innerHTML = html;
  b.disabled = false;
};
$("#favBtn").onclick = () => {
  if (!state.current) return;
  const on = favourites.toggle(state.current.url);
  $("#favBtn").setAttribute("aria-pressed", String(on));
  note(on ? "Added to favourites" : "Removed from favourites");
};
document.querySelectorAll("[data-layout]").forEach(b => {
  b.onclick = () => setLayout(b.dataset.layout);
  b.setAttribute("aria-pressed", String(b.dataset.layout === state.layout));
});

/* transient message in the status pill */
let noteTimer = null;
function note(msg) {
  const s = $("#status");
  s.hidden = false;
  s.textContent = msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { s.textContent = ""; s.hidden = true; }, 2600);
}

initFind();
initMinimap();
initPresent();
initExportMenu(note);

/* ------------------------------- help ------------------------------ */
const help = $("#help");
$("#helpBtn").onclick = () => { help.hidden = false; };
$("#helpClose").onclick = () => { help.hidden = true; };
help.addEventListener("click", e => { if (e.target === help) help.hidden = true; });

/* ----------------------------- keyboard ---------------------------- */
window.addEventListener("resize", () => {
  if ($("#map").classList.contains("active") && state.root) fit();
});

document.addEventListener("keydown", e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

  if (!$("#map").classList.contains("active")) {
    if (!typing && e.key === "/") { e.preventDefault(); const q = $("#q"); if (q) q.focus(); }
    return;
  }

  if (e.key === "Escape") {
    if (!help.hidden) return void (help.hidden = true);
    if (presenting()) return exitPresent();
    if (findOpen()) return closeFind();
    if (state.selectedId) return closeDetail();
    if (state.focusId) return clearFocus();
    if (state.outlineOpen) return setOutline(false);
    location.hash = "";
    return;
  }
  if (typing) return;

  if (presenting()) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); return presentNext(); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); return presentPrev(); }
  }

  switch (e.key) {
    case "/": e.preventDefault(); openFind(); break;
    case "f": fit(); break;
    case "o": setOutline(!state.outlineOpen); break;
    case "e": setAll(true); break;
    case "c": setAll(false); break;
    case "r": $("#refreshBtn").click(); break;
    case "p": presenting() ? exitPresent() : startPresent(); break;
    case "1": setLayout("radial"); break;
    case "2": setLayout("right"); break;
    case "3": setLayout("down"); break;
    case "?": help.hidden = false; break;
    case "ArrowUp": e.preventDefault(); moveSelection("up"); break;
    case "ArrowDown": e.preventDefault(); moveSelection("down"); break;
    case "ArrowLeft": e.preventDefault(); moveSelection("left"); break;
    case "ArrowRight": e.preventDefault(); moveSelection("right"); break;
    case "Enter": {
      const d = state.selectedId ? byId(state.selectedId) : null;
      if (d) { toggle(d); update(d); selectNode(d); }
      break;
    }
  }
});

/* keep the toolbar's layout buttons in step */
bus.on("map:loaded", () => {
  document.querySelectorAll("[data-layout]").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.layout === state.layout)));
});

/* ------------------------------- boot ------------------------------ */
if (!resolveMaster()) state.demo = false;
route();
