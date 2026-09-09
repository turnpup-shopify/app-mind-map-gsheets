/* Find-in-map: highlights matches, opens whatever hides them, steps through. */
import { $, debounce } from "./util.js";
import { state } from "./store.js";
import { allNodes, expandTo, update, selectNode, centerOn, applyClasses, byId } from "./mapview.js";

export function openFind(seed = "") {
  const bar = $("#findBar");
  bar.hidden = false;
  $("#findBtn").setAttribute("aria-pressed", "true");
  const input = $("#findInput");
  if (seed) input.value = seed;
  input.focus();
  input.select();
  if (input.value) run(input.value);
}

export function closeFind() {
  $("#findBar").hidden = true;
  $("#findBtn").setAttribute("aria-pressed", "false");
  const input = $("#findInput");
  input.value = "";
  input.blur();                       // otherwise shortcuts stay swallowed
  clear();
}

export function isOpen() { return !$("#findBar").hidden; }

function clear() {
  state.matches = [];
  state.matchIdx = -1;
  state.findQuery = "";
  $("#findCount").textContent = "";
  applyClasses();
}

export function run(q) {
  q = q.trim().toLowerCase();
  state.findQuery = q;
  if (!state.root || q.length < 1) { clear(); return; }

  const hits = allNodes().filter(n =>
    n.data.name.toLowerCase().includes(q) ||
    (n.data.notes || "").toLowerCase().includes(q));

  state.matches = hits.map(n => n.id);
  state.matchIdx = hits.length ? 0 : -1;
  $("#findCount").textContent = hits.length ? `1 of ${hits.length}` : "no matches";

  if (hits.length) {
    hits.forEach(expandTo);
    update(hits[0]);
    go(0);
  } else {
    applyClasses();
  }
}

export function step(delta) {
  if (!state.matches.length) return;
  go((state.matchIdx + delta + state.matches.length) % state.matches.length);
}

function go(i) {
  state.matchIdx = i;
  $("#findCount").textContent = `${i + 1} of ${state.matches.length}`;
  const d = byId(state.matches[i]);
  if (!d) return;
  expandTo(d);
  selectNode(d);
  centerOn(d);
  applyClasses();
}

/* wiring */
export function initFind() {
  const input = $("#findInput");
  input.addEventListener("input", debounce(e => run(e.target.value), 200));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? step(-1) : step(1); }
    if (e.key === "Escape") { e.preventDefault(); closeFind(); }
  });
  $("#findNext").onclick = () => step(1);
  $("#findPrev").onclick = () => step(-1);
  $("#findClose").onclick = closeFind;
  $("#findBtn").onclick = () => (isOpen() ? closeFind() : openFind());
}
