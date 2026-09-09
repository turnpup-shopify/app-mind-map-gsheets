/* The breadcrumb strip under the map: where the selected topic sits,
   and a way back out of a focused branch. */
import { $, esc, bus } from "./util.js";
import { state } from "./store.js";
import { byId, selectNode, centerOn, expandTo, update, clearFocus } from "./mapview.js";

function render() {
  const el = $("#crumbs");
  const d = state.selectedId ? byId(state.selectedId) : null;
  const focused = state.focusId ? byId(state.focusId) : null;

  if (!d && !focused) { el.hidden = true; el.innerHTML = ""; return; }

  const chain = (d || focused).ancestors().reverse();
  const parts = [];
  if (focused) parts.push(`<span class="focus-tag">Focused</span>`);
  chain.forEach((n, i) => {
    if (i) parts.push(`<span class="sl">›</span>`);
    parts.push(`<button data-i="${i}" class="${i === chain.length - 1 ? "here" : ""}" title="${esc(n.data.name)}">${esc(n.data.name)}</button>`);
  });
  if (focused) parts.push(`<span class="sl">·</span><button data-all="1">Show whole map</button>`);

  el.innerHTML = parts.join("");
  el.hidden = false;

  el.querySelectorAll("button[data-i]").forEach(b => {
    b.onclick = () => {
      const n = chain[+b.dataset.i];
      expandTo(n);
      update(n);
      selectNode(n);
      centerOn(n);
    };
  });
  const all = el.querySelector("button[data-all]");
  if (all) all.onclick = () => clearFocus();
}

bus.on("map:select", render);
bus.on("map:focus", render);
bus.on("map:render", render);
