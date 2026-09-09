# Mind Maps

A read-only front end for mind maps that live in Google Sheets. Anyone on the team edits a
sheet; this page reads the sheets and draws the maps. Nothing is ever written back to Drive.

```
index.html          the shell — markup only
css/styles.css      all styling, including the light theme and print rules
js/
  config.js         master sheet link, poll interval, layout geometry  ← edit this
  demo.js           built-in sample maps
  util.js           small shared helpers
  store.js          session state + what's remembered in the browser
  data.js           fetching and parsing CSV
  home.js           the homepage: list, filters, search across every map
  mapview.js        the canvas: layouts, zoom, expand/collapse, selection
  outline.js        the outline panel
  find.js           find-in-map
  crumbs.js         the breadcrumb strip
  minimap.js        the overview in the corner
  exports.js        PNG / SVG / Markdown / print / links
  present.js        presentation mode
  app.js            routing, toolbar, keyboard, theme
```

## Setting it up

**1. Make the folder readable by the app.** Right-click the Mind Maps folder in Drive → Share →
under General access choose **Anyone with the link** → **Viewer** → Done. All the sheets inherit
it. The app reads them through each sheet's CSV export link, which only works for link-viewable
sheets.

**2. Point it at your master list.** Either edit `MASTER_CSV_URL` in `js/config.js`, or leave it
and use **Change source** on the homepage — that's remembered in the browser, so each person can
point at a different list without touching the files. A `?master=…` query string also works, which
is handy for sharing a one-off list.

**3. Host it.** Go to https://app.netlify.com/drop and drag the whole **folder** (not just
`index.html`) onto it. Netlify gives you a URL; share that with the team.

> The app is split into JavaScript modules, which browsers only load over http(s). Netlify, any
> static host, or `python3 -m http.server` from this folder all work. Opening `index.html` straight
> off your desktop by double-clicking it will not.

## Adding a new map

1. In the Mind Maps folder, copy any `Map —` sheet and rename it. Being in the folder means it's
   already link-viewable.
2. Edit the topics (format below).
3. Copy its ID from the address bar (`/spreadsheets/d/THIS-PART/edit`).
4. Add a row to the Master List: Title, Description, Tags (`marketing; planning`), and CSV URL as
   `https://docs.google.com/spreadsheets/d/THIS-PART/gviz/tq?tqx=out:csv`.
   Color is optional (e.g. `#7f6bff`).

It appears on the homepage on the next load.

## Map sheet format

Columns `Level 1`, `Level 2`, `Level 3`… as deep as you need, then optional `Notes`, `Link`,
`Color`. Each row has text in exactly **one** Level column. A topic's parent is the nearest row
above it with text further left.

```
Level 1            Level 2     Level 3     Notes
Q4 marketing plan
                   Paid                    Budget $140k
                               Meta
                               Google
                   Organic
                               SEO
```

- Add a sub-topic: new row, type in the column one to the right of its parent.
- Move a branch: cut the rows, paste under the new parent.
- Reorder: drag the rows.
- `Notes` shows on hover and in the details panel. `Link` becomes a clickable link.
- `Color` on a Level 2 topic colours its whole branch.

Edits show up within about a minute (Google caches the export briefly). An open map re-reads its
sheet every 30 seconds.

## Using it

**Homepage**

- The search box searches map titles *and every topic inside every map*. Topic results show where
  the topic sits and which map it's in; clicking one opens that map with the topic selected.
- Tag chips filter; the dropdown sorts by recently opened, name, size, or sheet order.
- The star pins a map to the top of the list. Favourites and recents are per-browser.
- Cards show the topic count, how deep the map goes, and its first few branches.

**A map**

- Three layouts: radial, left-to-right, top-down (`1` `2` `3`). Your choice is remembered.
- Click a topic to open its details and expand or collapse it. Collapsed topics show a ring and a
  count. The details panel lists sub-topics so you can walk down without hunting on the canvas.
- **Focus branch** collapses everything else so one branch has the screen to itself; the breadcrumb
  strip at the bottom says you're focused and takes you back out.
- **Find** (`/`) highlights every match, opens whatever was hiding them, and steps through with
  Enter / Shift+Enter.
- The minimap in the corner shows the whole map; click or drag it to move around.
- **Share and export**: a link back to this exact topic, PNG, SVG, a Markdown outline (whole tree,
  collapsed branches included), print/PDF, and a shortcut to the sheet behind the map.
- **Present** (`p`) walks the map branch by branch with arrow keys — the overview first, then one
  screen per top-level branch.
- Light and dark themes; the toggle is on the homepage and follows your system by default.

**Keys**: `/` find · `f` fit · `o` outline · `e`/`c` expand/collapse · `r` refresh · `p` present ·
`1` `2` `3` layouts · arrows move between topics · Enter expands · Esc backs out · `?` shows this
list.

## Notes

- Everything is read-only by design. The app never writes to Drive, so a wrong click can't damage
  a map — the sheet is always the source of truth.
- A map that fails to load doesn't stop the others; its card just shows no topic count.
- Maps over ~400 topics skip the animations so panning stays smooth.
