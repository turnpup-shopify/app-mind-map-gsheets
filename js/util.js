/* Small shared helpers. No app state lives here. */

export const $  = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

/** Escape a string for safe use inside a RegExp. */
export const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wrap every case-insensitive occurrence of `q` in <mark>. Input is escaped. */
export function highlight(text, q) {
  const safe = esc(text);
  if (!q) return safe;
  return safe.replace(new RegExp(escRe(esc(q)), "gi"), m => `<mark>${m}</mark>`);
}

export const debounce = (fn, ms = 180) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const fmtTime = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Copy text to the clipboard, with a fallback for insecure contexts. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* ignore */ }
  ta.remove();
  return ok;
}

/** Briefly swap a button's label to confirm an action. */
export function flashLabel(btn, msg, ms = 1400) {
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, ms);
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slugify = s => String(s).toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "mind-map";

/** Normalise a colour cell: "7f6bff" and "#7f6bff" both work. */
export function normColor(v) {
  if (!v) return null;
  const s = String(v).trim();
  return /^#?[0-9a-f]{3,8}$/i.test(s) ? (s.startsWith("#") ? s : "#" + s) : null;
}

/** Tiny publish/subscribe bus so panels don't have to import each other. */
export const bus = {
  _m: new Map(),
  on(evt, fn) { (this._m.get(evt) ?? this._m.set(evt, []).get(evt)).push(fn); return () => this.off(evt, fn); },
  off(evt, fn) { const a = this._m.get(evt); if (a) a.splice(a.indexOf(fn) >>> 0, 1); },
  emit(evt, ...args) { (this._m.get(evt) || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); },
};
