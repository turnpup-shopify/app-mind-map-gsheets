/* The outline panel — a text view of the same tree. */
import { $, esc, bus } from "./util.js";
import { state } from "./store.js";
import { toggle, update, selectNode, centerOn } from "./mapview.js";

let dimTimer = null;

export function setOutline(open) {
  state.outlineOpen = open;
  $("#outline").classList.toggle("open", open);
  $("#outlineBtn").setAttribute("aria-pressed", String(open));
  if (open) render();
}

export function render() {
  if (!state.outlineOpen || !state.root) return;
  const el = $("#outlineTree");
  const matches = new Set(state.matches);

  const build = n => {
    const kids = n.children || n._children || [];
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "row"
      + (n.id === state.selectedId ? " active" : "")
      + (matches.has(n.id) ? " match" : "");
    row.innerHTML =
      `<span class="tw">${kids.length ? (n.children ? "▾" : "▸") : ""}</span>` +
      `<span class="sw" style="background:${n.depth === 0 ? "#fff" : esc(n.data.color || "#fff")}"></span>` +
      `<span class="lbl" title="${esc(n.data.notes || n.data.name)}">${esc(n.data.name)}</span>`;
    row.onclick = () => {
      if (kids.length) { toggle(n); update(n); }
      selectNode(n);
      dimOthers(n);
      centerOn(n);
    };
    li.appendChild(row);
    if (n.children) {
      const ul = document.createElement("ul");
      n.children.forEach(c => ul.appendChild(build(c)));
      li.appendChild(ul);
    }
    return li;
  };

  el.innerHTML = "";
  const ul = document.createElement("ul");
  ul.appendChild(build(state.root));
  el.appendChild(ul);

  const active = el.querySelector(".row.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

/** Briefly fade everything that isn't on this node's branch. */
export function dimOthers(n) {
  const nodes = d3.selectAll("#canvas g.node");
  nodes.classed("dim", d => !(d === n || d.ancestors().includes(n) || n.ancestors().includes(d)));
  clearTimeout(dimTimer);
  dimTimer = setTimeout(() => nodes.classed("dim", false), 1400);
}

bus.on("map:render", render);
bus.on("map:select", render);
