/* =====================================================================
   CONFIG — paste your master sheet CSV link here, or leave it blank and
   paste it into the setup screen (it's remembered in the browser).
   ===================================================================== */
export const CONFIG = {
  MASTER_CSV_URL: "https://docs.google.com/spreadsheets/d/1kV3jReMwlLnxScfzBDILqpu4OUrSZuR3fb3ZK4Z3FhE/gviz/tq?tqx=out:csv",
  POLL_MS: 30000,        // how often an open map re-reads its sheet
  INITIAL_DEPTH: 2,      // levels shown when a map first opens
  BIG_MAP: 400,          // above this many topics, animations are skipped
  MAX_TOPIC_HITS: 12,    // topic results shown on the homepage
};

export const PALETTE = ["#7f6bff","#2fd4c9","#ffab7a","#ff7aa8","#8ad46a","#ffd166","#62b6ff","#c77dff"];

/* Layout geometry */
export const GEOM = {
  radialStep: 170,       // distance per level
  rowGap: 26,            // sibling gap, left-to-right tree
  colGap: 230,           // level gap, left-to-right tree
  colWidth: 150,         // sibling gap, top-down tree
  rowHeight: 120,        // level gap, top-down tree
};
