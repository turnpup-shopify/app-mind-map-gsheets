/* A small overview in the corner: every visible topic as a dot, plus the
   rectangle showing what's on screen. Click or drag it to move around. */
import { $, bus } from "./util.js";
import { state } from "./store.js";
import { getSvg, panTo } from "./mapview.js";

const PAD = 8;
let box = null;          // {x, y, w, h} in map coordinates
let scale = 1, ox = 0, oy = 0;

function els() {
  return { wrap: $("#minimap"), svg: d3.select("#minimapSvg") };
}

function draw() {
  const { wrap, svg } = els();
  if (!state.root) { wrap.hidden = true; return; }
  const nodes = state.root.descendants();
  if (nodes.length < 2) { wrap.hidden = true; return; }
  wrap.hidden = false;

  const W = wrap.clientWidth, H = wrap.clientHeight;
  const xs = nodes.map(d => d.px), ys = nodes.map(d => d.py);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  box = { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };

  scale = Math.min((W - PAD * 2) / box.w, (H - PAD * 2) / box.h);
  ox = PAD + (W - PAD * 2 - box.w * scale) / 2 - box.x * scale;
  oy = PAD + (H - PAD * 2 - box.h * scale) / 2 - box.y * scale;

  const sel = svg.selectAll("circle.mm-node").data(nodes, d => d.id);
  sel.enter().append("circle").attr("class", "mm-node")
    .merge(sel)
    .attr("cx", d => d.px * scale + ox)
    .attr("cy", d => d.py * scale + oy)
    .attr("r", d => d.depth === 0 ? 3.4 : d.depth === 1 ? 2.4 : 1.7)
    .attr("fill", d => d.depth === 0 ? "#fff" : (d.data.color || "#fff"));
  sel.exit().remove();

  if (svg.select("rect.mm-view").empty()) svg.append("rect").attr("class", "mm-view").attr("rx", 3);
  svg.select("rect.mm-view").raise();
  drawViewport();
}

function drawViewport() {
  const { svg } = els();
  const canvas = getSvg();
  if (!canvas || !box) return;
  const t = d3.zoomTransform(canvas);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  // screen rectangle -> map coordinates
  const x0 = (0 - t.x) / t.k, y0 = (0 - t.y) / t.k;
  const x1 = (W - t.x) / t.k, y1 = (H - t.y) / t.k;
  svg.select("rect.mm-view")
    .attr("x", x0 * scale + ox)
    .attr("y", y0 * scale + oy)
    .attr("width", Math.max((x1 - x0) * scale, 4))
    .attr("height", Math.max((y1 - y0) * scale, 4));
}

function jump(event) {
  const { wrap } = els();
  const r = wrap.getBoundingClientRect();
  const mx = (event.clientX - r.left - ox) / scale;
  const my = (event.clientY - r.top - oy) / scale;
  panTo(mx, my);
}

export function initMinimap() {
  const { wrap } = els();
  let dragging = false;
  wrap.addEventListener("pointerdown", e => { dragging = true; wrap.setPointerCapture(e.pointerId); jump(e); });
  wrap.addEventListener("pointermove", e => { if (dragging) jump(e); });
  wrap.addEventListener("pointerup", e => { dragging = false; wrap.releasePointerCapture(e.pointerId); });
  window.addEventListener("resize", () => { draw(); });
  bus.on("map:render", draw);
  bus.on("zoom", drawViewport);
}
