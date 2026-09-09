/* Presentation mode: walk the map branch by branch, one screen at a time. */
import { $, esc } from "./util.js";
import { state } from "./store.js";
import { focusBranch, clearFocus, selectNode, closeDetail, fit, setAll } from "./mapview.js";

let steps = [];
let i = 0;

export function start() {
  if (!state.root) return;
  steps = [state.root, ...(state.root.children || state.root._children || [])];
  if (steps.length < 2) return;
  i = 0;
  state.presenting = true;
  closeDetail();
  $("#map").classList.add("presenting");
  $("#present").hidden = false;
  $("#detail").hidden = true;
  go(0);
}

export function exit() {
  state.presenting = false;
  $("#map").classList.remove("presenting");
  $("#present").hidden = true;
  clearFocus();
  setTimeout(fit, 200);
}

export function next() { go(i + 1); }
export function prev() { go(i - 1); }
export function active() { return state.presenting; }

function go(n) {
  if (n < 0) return;
  if (n >= steps.length) return exit();
  i = n;
  const d = steps[i];

  if (i === 0) { setAll(false); } else { focusBranch(d); }
  selectNode(d);
  $("#detail").hidden = true;              // the card replaces the detail panel
  setTimeout(fit, 480);                    // fit() leaves room for the card

  const kids = d.children || d._children || [];
  $("#presentStep").textContent = i === 0 ? "Overview" : `Branch ${i} of ${steps.length - 1}`;
  $("#presentTitle").textContent = d.data.name;
  const notes = $("#presentNotes");
  notes.textContent = d.data.notes || "";
  notes.hidden = !d.data.notes;
  $("#presentKids").innerHTML = kids.map(k => `<li>${esc(k.data.name)}</li>`).join("");
  $("#presentPrev").disabled = i === 0;
  $("#presentNext").textContent = i === steps.length - 1 ? "Finish" : "Next";
}

export function initPresent() {
  $("#presentNext").onclick = next;
  $("#presentPrev").onclick = prev;
  $("#presentExit").onclick = exit;
}
