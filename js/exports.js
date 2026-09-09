/* Getting a map out of the browser: PNG, SVG, Markdown, print, links. */
import { $, download, slugify, copyText } from "./util.js";
import { state } from "./store.js";
import { getGroup, fit, nodeUrl, byId } from "./mapview.js";

const PAD = 60;

function themeColors() {
  const cs = getComputedStyle(document.body);
  return {
    bg: cs.backgroundColor || "#0f1829",
    text: cs.color || "#eef2f8",
  };
}

function exportCss({ bg, text }) {
  return `
    .link{fill:none;stroke:#8894ad;stroke-opacity:.5;stroke-width:1.4}
    .node circle{stroke:${bg};stroke-width:2}
    .node text{font-family:"Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",sans-serif;
      fill:${text};paint-order:stroke;stroke:${bg};stroke-width:4px;stroke-linejoin:round;font-size:12.5px}
    .node.depth-0 text{font-size:18px;font-weight:700}
    .node.depth-1 text{font-size:14px;font-weight:600}
    .node .note-dot{fill:${text};stroke:${bg};stroke-width:1.5}
    .node.dim,.node.match text{opacity:1}
  `;
}

/** A standalone <svg> string of the whole map at its natural size. */
function serialize() {
  const g = getGroup();
  const box = g.getBBox();
  const colors = themeColors();
  const w = Math.ceil(box.width + PAD * 2);
  const h = Math.ceil(box.height + PAD * 2);
  const inner = g.innerHTML
    .replace(/\sclass="node[^"]*"/g, m => m.replace(/ (selected|match|current-match|on-path|dim)/g, ""));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.x - PAD} ${box.y - PAD} ${w} ${h}">
<style>${exportCss(colors)}</style>
<rect x="${box.x - PAD}" y="${box.y - PAD}" width="${w}" height="${h}" fill="${colors.bg}"/>
${inner}
</svg>`;
}

const filename = ext => slugify((state.current && state.current.title) || "mind-map") + "." + ext;

export function downloadSvg() {
  download(new Blob([serialize()], { type: "image/svg+xml;charset=utf-8" }), filename("svg"));
}

export function downloadPng(scale = 2) {
  const svgText = serialize();
  const g = getGroup().getBBox();
  const w = Math.ceil(g.width + PAD * 2), h = Math.ceil(g.height + PAD * 2);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    c.toBlob(b => { if (b) download(b, filename("png")); URL.revokeObjectURL(url); }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert("Couldn't render the image. Try the SVG download instead."); };
  img.src = url;
}

/** The full tree — collapsed branches included — as a Markdown outline. */
export function toMarkdown() {
  if (!state.root) return "";
  const title = (state.current && state.current.title) || state.root.data.name;
  const lines = [`# ${title}`, ""];
  (function walk(n, depth) {
    if (depth > 0) {
      const indent = "  ".repeat(depth - 1);
      let line = `${indent}- ${n.name}`;
      if (n.notes) line += ` — ${n.notes.replace(/\s+/g, " ")}`;
      if (n.link) line += ` ([link](${n.link}))`;
      lines.push(line);
    }
    (n.children || []).forEach(c => walk(c, depth + 1));
  })(state.root.data, 0);
  lines.push("", `_Exported ${new Date().toLocaleDateString()}_`);
  return lines.join("\n");
}

export function downloadMarkdown() {
  download(new Blob([toMarkdown()], { type: "text/markdown;charset=utf-8" }), filename("md"));
}

export function sheetUrl() {
  const u = (state.current && state.current.url) || "";
  if (!u || u.startsWith("demo:")) return null;
  return u.replace(/\/(gviz|export|pub)\b.*$/, "/edit");
}

/* ------------------------------- menu ------------------------------ */
export function initExportMenu(onNote) {
  const btn = $("#exportBtn"), menu = $("#exportMenu");
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  const open  = () => { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); };

  btn.onclick = e => { e.stopPropagation(); menu.hidden ? open() : close(); };
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) close(); });

  menu.querySelectorAll("button").forEach(b => {
    b.onclick = async () => {
      close();
      switch (b.dataset.act) {
        case "png": downloadPng(); break;
        case "svg": downloadSvg(); break;
        case "md":  downloadMarkdown(); break;
        case "mdcopy": {
          const ok = await copyText(toMarkdown());
          onNote(ok ? "Outline copied to the clipboard" : "Couldn't copy the outline");
          break;
        }
        case "link": {
          const d = state.selectedId ? byId(state.selectedId) : null;
          const ok = await copyText(nodeUrl(d));
          onNote(ok ? "Link copied to the clipboard" : "Couldn't copy the link");
          break;
        }
        case "print": fit(); setTimeout(() => window.print(), 600); break;
        case "sheet": {
          const u = sheetUrl();
          u ? window.open(u, "_blank", "noopener") : onNote("This is a sample map — there's no sheet behind it.");
          break;
        }
      }
    };
  });
}
