// The opening dive's upper bands as the mockup draws them (ticket #797, epic #795): the coast and the shore, the
// boulder and the bull kelp, the drop, and the slime inside the drop, on one Canvas 2D canvas. The planet under them is
// the game's since ticket #800 (`dive-planet-band.ts`, on the dive's Pixi canvas under this one): this canvas leaves
// clear where it shows. `dive-macro-band.ts` lays the canvases.
//
// **This file is the mockup's code, not the game's.** It is the design artifact
// (https://claude.ai/artifact/A674H91iLRxEa4MTzCRPhu, src/00-core.js … 72-scene.js) made into one module: its page
// globals became module state set by `createMockupBands`, its timers became the dive's frame loop, and the parts the
// game draws itself (the dish wall, the bacteria in the dish, the light, you) hand over to the game's renderer. It
// is plain JavaScript on purpose and sits outside eslint, prettier, jscpd and coverage (.prettierignore, .jscpd.json,
// angular.json): the follow-up tickets of epic #795 move each band onto the game's GPU renderer and delete its part of
// this file, so it is never brought up to docs/CODE-STANDARDS.md. Do not add to it. docs/rendering/opening-dive.md is
// the contract. Which ticket deletes what (each section's header names its ticket too):
//   ticket #801, the coast and shore: the coast in metres, the shore's tiles and layers, kelp beds, pools, boulders
//   ticket #802, the kelp and drop: the boulder and the bull kelp, the spray beads and the drop's lens
//   ticket #803, the slime: inside the drop (the kelp's cells, slime, diatoms, ciliates, the mockup's own pocket)
// The core helpers, the tile pump and `drawFrame` go with the last of them.
//
// Units: world metres around the focus (x east, y south); z is log10 of the view's width in metres; T is seconds.
import { geoOrthographic } from 'd3-geo';
// The shore's sea depth takes the planet's distance transform (ticket #800 moved it to the game's code).
import { distanceTransform2d as edt2d } from '../planet/signed-distance';

const d3 = { geoOrthographic };
/** The bands the dive's table says draw this frame, and how far each is faded in (`dive-bands.ts`). */
let BANDS = null;
/** The dive's clock (milliseconds); the bake pump reads it. */
let nowMs = () => 0;

// ---------- core: constants, palette, helpers ----------
const R_EARTH = 6.371e6;
const CENTER = [-123.357, 48.4006];
const Z_TOP = 7.4, Z_BOTTOM = -6.2;
const TAU = Math.PI * 2;


// Palette. The micro end reuses the game's own constants (docs/visual-style/principles-and-palette.md §2,
// packages/client/src/app/game/render/constants/colours.ts); the upper bands add a natural-history ramp per material.
const PAL = {
  // game: field, dish wall, light
  BG_DEEP: '#04070d', BG_FIELD: '#0b1626', LIGHT_ACCENT: '#7fe7f5', WHITE: '#ffffff',
  WALL_GLASS: '#182c46', WALL_GLASS_INNER: '#2a4a70', WALL_GLASS_OUTER: '#4a6a90', WALL_LIGHT: '#bff2ff',
  // game: food and bacteria
  FOOD_MOTE: '#8dff6a', FOOD_MOTE_EDGE: '#3f9a2c', FOOD_MOTE_RIM: '#dcffb0',
  LIPID_BASE: '#f2c94c', LIPID_CENTRE: '#c88a2a', LIPID_LIGHT: '#fff8d0', LIPID_RIM: '#ffe7a3',
  BACTERIUM_PLAIN: '#cfefff', PROTO_FILM: '#8fd3e3',
  MITO_BASE: '#ffb15a', MITO_DARK: '#b85c16', MITO_LIGHT: '#ffd39a',
  CHLORO_BASE: '#63d64a', CHLORO_DARK: '#1f7a2b', CHLORO_LIGHT: '#b8ff9a',
  RIBOSOME: '#a6f4ff', NUCLEOID_GLOW: '#7fe7f5', NUCLEOID_STRAND: '#e4faff', FLAGELLUM: '#a6f4ff', CILIA: '#a6f4ff',
  SILICA_BASE: '#a9dcef', SILICA_DARK: '#2f6f8c', SILICA_LIGHT: '#eef9ff',
  DIATOM_PLASTID_LIGHT: '#d7a441', DIATOM_PLASTID_DARK: '#8a5e14',
  // game: the own cell, seat 0 (Cyan)
  YOU_BASE: '#22c1d6', YOU_RIM: '#a6f4ff', YOU_NUC: '#6fdcef',
  // shore: sea
  SEA_DEEP: '#0d3a52', SEA_MID: '#145068', SEA_SHELF: '#1c6678', SEA_SHALLOW: '#2e8c92', SEA_REEF: '#3f9f98', FOAM: '#eef8f6',
  // shore: rock and intertidal zones
  ROCK_DARK: '#4a463f', ROCK_BASE: '#7a756a', ROCK_LIGHT: '#a39d8e', ROCK_WET: '#3e3c37',
  LICHEN_BLACK: '#1f1e1c', LICHEN_ORANGE: '#d88a2c', LICHEN_GREY: '#a9ad96',
  BARNACLE_LIGHT: '#e2dccb', BARNACLE_BASE: '#b3ab98', BARNACLE_DARK: '#5d574b',
  ROCKWEED_DARK: '#3a3013', ROCKWEED_BASE: '#62531f', ROCKWEED_LIGHT: '#9a8636',
  MUSSEL_DARK: '#141a26', MUSSEL_SHEEN: '#5a6784',
  CORALLINE: '#c98c9b', CORALLINE_LIGHT: '#ecc0c9', SURFGRASS: '#3f9a45',
  SAND_BASE: '#b9a57d', SAND_LIGHT: '#d9c9a3', SAND_WET: '#8c7c5c',
  DRIFT_BASE: '#a8a194', DRIFT_LIGHT: '#d8d2c4', DRIFT_DARK: '#6c665b',
  // kelp (Nereocystis): golden-olive, translucent
  KELP_DARK: '#4f3812', KELP_BASE: '#8a6a2a', KELP_LIGHT: '#c29a48', KELP_GLOW: '#e5c27a', STIPE_BASE: '#5f4418',
  // inside the drop (brightfield) and the kelp's surface cells
  CELL_WALL: '#e3c98a', CELL_BASE: '#9c7a34', CELL_DARK: '#6e5220', PHAEO: '#6b4f16', PHAEO_LIGHT: '#b98c38',
  WATER_TINT: '#7fc9cf',
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const hexRgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, v) => smooth(clamp((v - a) / (b - a), 0, 1));
const lerp = (a, b, t) => a + (b - a) * t;
function hash(x, y, k) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mix32(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// seeded PRNG for bakes
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = mix32(s + 0x9e3779b9); return s / 4294967296; }; }
// periodic value noise (for tileable bakes): lattice period px × py, lattice values from one seeded table
const LAT = (() => { const t = new Float32Array(1 << 16), r = rng(12345); for (let i = 0; i < t.length; i++) t[i] = r(); return t; })();
const lat = (x, y, k) => LAT[(Math.imul(k, 40503) + Math.imul(y, 2749) + Math.imul(x, 7919)) & 65535];
function pnoise(x, y, px, py, k) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  let x0 = ix % px; if (x0 < 0) x0 += px; let y0 = iy % py; if (y0 < 0) y0 += py;
  const x1 = x0 + 1 === px ? 0 : x0 + 1, y1 = y0 + 1 === py ? 0 : y0 + 1;
  const a = lat(x0, y0, k), b = lat(x1, y0, k), c = lat(x0, y1, k), d = lat(x1, y1, k);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// Voronoi on a jittered G × G grid that wraps: distances to the nearest and second-nearest site (tile units), and
// the nearest site's index. Searches the 3 × 3 neighbouring cells only.
function vor(u, v, G, jit, ax = 1) {
  const gx = u * G, gy = v * G, ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G;
    const sx = cx + .5 + (jit(wx, wy, 0) - .5), sy = cy + .5 + (jit(wx, wy, 1) - .5);
    const dx = (sx - gx) * ax, dy = sy - gy, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = wy * G + wx; } else if (d < d2) d2 = d;
  }
  return [Math.sqrt(d1) / G, Math.sqrt(d2) / G, id];
}
function pfbm(x, y, px, py, oct, k) {
  let a = 0, b = .5, w = 0;
  for (let i = 0; i < oct; i++) { a += b * pnoise(x, y, px, py, k + i * 17); w += b; x *= 2; y *= 2; px *= 2; py *= 2; b *= .5; }
  return a / w;
}
// plain value noise on the plane (world-stable choices: beaches, meadows)
function vnoise(x, y, k) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy, k), hash(ix + 1, iy, k), ux), lerp(hash(ix, iy + 1, k), hash(ix + 1, iy + 1, k), ux), uy);
}
function runSync(gen) { let r; do r = gen.next(); while (!r.done); return r.value; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- view state (world metres around the focus: x east, y south) ----------
let cv = null, ctx = null;
let cw = 0, ch = 0, dpr = 1;
let z = Z_TOP, s = 1, hx = 1, hy = 1, T = 0;
const vis = (x, y, r) => x + r > -hx && x - r < hx && y + r > -hy && y - r < hy;
const px = n => n / s; // n screen pixels in metres
const worldXf = () => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cw / 2, dpr * ch / 2);
// world-stable grid scatter: fn(i, j, x, y, a, b) per cell overlapping the view
function forCells(cell, k, fn, max = 5000, pad = 1) {
  const x0 = Math.floor(-hx / cell) - pad, x1 = Math.floor(hx / cell) + pad;
  const y0 = Math.floor(-hy / cell) - pad, y1 = Math.floor(hy / cell) + pad;
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > max) return;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) fn(i, j, (i + hash(i, j, k)) * cell, (j + hash(i, j, k + 1)) * cell, hash(i, j, k + 2), hash(i, j, k + 3));
}
// A self-similar texture drawn at two neighbouring octaves (ratio `ratio`) whose weights follow the zoom, so it has
// detail at every scale without ever popping. fn(tileWorldSize, alpha) draws one layer.
function octaves(tileWorld0, tilePx, ratio, fn, targetPx = 380) {
  const lvl = Math.log((s * tileWorld0) / targetPx) / Math.log(ratio);
  const k = Math.floor(lvl), f = lvl - k;
  fn(tileWorld0 / Math.pow(ratio, k), 1);
  fn(tileWorld0 / Math.pow(ratio, k + 1), smooth(f));
}
// a pattern whose tile spans `world` metres, anchored at the world origin, optionally rotated
function patXf(pat, tilePx, world, rot = 0, ox = 0, oy = 0) {
  const k = world / tilePx, c = Math.cos(rot) * k, sn = Math.sin(rot) * k;
  pat.setTransform(new DOMMatrix([c, sn, -sn, c, ox, oy]));
  return pat;
}

// ---------- geo data ----------
let SALISH_RINGS = null, REG_BOX = null;
// the Salish rings' extent (degrees): a segment along it is where the data was clipped, not coast
const regionBox = () => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const r of SALISH_RINGS) for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
};
function initGeo(salishRings) { SALISH_RINGS = salishRings; REG_BOX = regionBox(); }

// ---------- the coast in metres (z 4.85 → -1.4; ticket #801) ----------
// The Salish rings in plane metres around the focus (the same orthographic projection the globe uses, so the handoff
// lines up). Below the data's resolution the coast is refined by deterministic midpoint displacement: each child's
// offset comes from its parent's hash, never from the zoom, so the same infinite coastline appears at every scale
// and the focus vertex (CENTER is a vertex of the data) stays on the waterline.
const lproj = d3.geoOrthographic().rotate([-CENTER[0], -CENTER[1]]).scale(R_EARTH).translate([0, 0]).clipAngle(90);
const COAST_AMP = .27, COAST_AMP_FOCUS = .1;
let LRINGS = null, LAND_SIDE = 1;
const landRings = () => {
  const out = [];
  SALISH_RINGS.forEach((r, ri) => {
    const pts = [];
    for (const p of r) {
      const q = lproj(p); if (!q) continue;
      const x = Math.abs(q[0]) < 1e-6 ? 0 : q[0], y = Math.abs(q[1]) < 1e-6 ? 0 : q[1];
      const n = pts.length; if (n && pts[n - 2] === x && pts[n - 1] === y) continue;
      pts.push(x, y);
    }
    if (pts.length >= 2 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
    if (pts.length < 6) return;
    let area = 0, x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[(2 * i + 2) % pts.length], by = pts[(2 * i + 3) % pts.length];
      area += ax * by - bx * ay;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax); y1 = Math.max(y1, ay);
    }
    // a segment's clip-box edges (the data was cut to a box) are not coast: they get no surf, rock or refinement
    const [ba, bb, bc, bd] = REG_BOX, box = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const A = r[i], B = r[(i + 1) % r.length]; if (A && B && ((A[0] === B[0] && (A[0] === ba || A[0] === bc)) || (A[1] === B[1] && (A[1] === bb || A[1] === bd)))) box[i] = 1; }
    out.push({ pts, n, sign: Math.sign(area), x0, y0, x1, y1, id: ri + 1, box });
  });
  return out;
};
// which side is land: calibrated on the ring through the focus, whose land lies to the north (−y)
const landSide = () => {
  for (const R of LRINGS) for (let i = 0; i < R.n; i++) if (R.pts[2 * i] === 0 && R.pts[2 * i + 1] === 0) {
    const j = (i + 1) % R.n, bx = R.pts[2 * j], by = R.pts[2 * j + 1];
    const cross = bx * (-50) - by * 0; // (b − a) × (p − a) with a = origin, p = (0, −50)
    return Math.sign(cross) * R.sign;
  }
  return 1;
};
function initCoast() { LRINGS = landRings(); LAND_SIDE = landSide(); }

// view window for the coast (metres), set per frame
let CV = { x0: 0, y0: 0, x1: 0, y1: 0, m: 0, detail: 4 };
const coast = { rings: [], segs: null, grid: null, gcell: 1, gx0: 0, gy0: 0, gw: 0, gh: 0 };

function refineSeg(ax, ay, bx, by, h, depth, out, focusA, focusB) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  const mx0 = (ax + bx) / 2, my0 = (ay + by) / 2;
  // stop when short on screen; farther from the view it may be coarser
  const ex = Math.max(0, CV.x0 - mx0, mx0 - CV.x1), ey = Math.max(0, CV.y0 - my0, my0 - CV.y1);
  const far = 1 + Math.max(ex, ey) / (hx * .5);
  if (L * s < CV.detail * far || depth > 46) { out.push(bx, by); return; }
  const m = L * .36;
  if (Math.max(ax, bx) + m < CV.x0 - CV.m || Math.min(ax, bx) - m > CV.x1 + CV.m || Math.max(ay, by) + m < CV.y0 - CV.m || Math.min(ay, by) - m > CV.y1 + CV.m) { out.push(bx, by); return; }
  const r = (h >>> 0) / 4294967296 - .5;
  let mx, my;
  // next to the focus, below ~600 m, the shore runs east–west at every scale (the boulder sits on a waterline);
  // above that the coast keeps the data's own shape
  if ((focusA || focusB) && L < 600) {
    const dir = focusA ? Math.sign(bx) || 1 : Math.sign(ax) || 1;
    const half = L / 2;
    if (focusA) { mx = dir * half; my = r * COAST_AMP_FOCUS * L; }
    else { mx = dir * half; my = r * COAST_AMP_FOCUS * L; }
  } else { mx = mx0 - dy * r * COAST_AMP; my = my0 + dx * r * COAST_AMP; }
  refineSeg(ax, ay, mx, my, mix32(h ^ 0x68e31da4), depth + 1, out, focusA, false);
  refineSeg(mx, my, bx, by, mix32(h ^ 0xb5297a4d), depth + 1, out, false, focusB);
}
// Sutherland–Hodgman against one axis-aligned edge; keeps the fill bounded so the canvas never sees huge coordinates
function clipEdge(inp, axis, v, keepLess) {
  const out = [], n = inp.length / 2;
  if (!n) return out;
  const inside = i => keepLess ? inp[2 * i + axis] <= v : inp[2 * i + axis] >= v;
  for (let i = 0; i < n; i++) {
    const j = (i + n - 1) % n, ci = inside(i), cj = inside(j);
    if (ci !== cj) {
      const ax = inp[2 * j], ay = inp[2 * j + 1], bx = inp[2 * i], by = inp[2 * i + 1];
      const t = ((axis ? ay : ax) - v) / ((axis ? ay - by : ax - bx) || 1e-30);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
    if (ci) out.push(inp[2 * i], inp[2 * i + 1]);
  }
  return out;
}
// The focus sits on a small rocky point: the shore on either side is drawn back a little (0 at the focus, so it
// stays on the waterline), fading out within a few kilometres.
const POINT = { A: 90, w: 240, L: 2600 };
// Right at the focus the waterline is pushed 0.6 m seaward, so the stranded kelp and its drop of spray lie on dry
// stone just above the swash.
function warpY(x, y) {
  const r2 = (x * x + y * y) / (POINT.L * POINT.L);
  if (r2 > 9) return y;
  return y - POINT.A * (1 - Math.exp(-(x * x) / (POINT.w * POINT.w))) * Math.exp(-r2) + .6 * Math.exp(-(x * x + y * y) / 9);
}
function buildCoast() {
  const m = Math.max(hx * 1.5, 90);
  CV = { x0: -hx, y0: -hy, x1: hx, y1: hy, m, detail: 4 };
  coast.rings = [];
  const X0 = -hx - m, X1 = hx + m, Y0 = -hy - m, Y1 = hy + m;
  const segs = [];
  for (const R of LRINGS) {
    const pad = Math.max(R.x1 - R.x0, R.y1 - R.y0) * .05;
    if (R.x1 + pad < X0 || R.x0 - pad > X1 || R.y1 + pad < Y0 || R.y0 - pad > Y1) continue;
    const out = [], flags = [];
    const P = R.pts;
    for (let i = 0; i < R.n; i++) {
      const j = (i + 1) % R.n, ax = P[2 * i], ay = P[2 * i + 1], bx = P[2 * j], by = P[2 * j + 1];
      if (i === 0) out.push(ax, ay);
      const before = out.length;
      if (R.box[i]) out.push(bx, by);
      else refineSeg(ax, ay, bx, by, mix32(R.id * 7919 + i * 104729), 0, out, ax === 0 && ay === 0, bx === 0 && by === 0);
      for (let k = before; k < out.length; k += 2) flags.push(R.box[i]);
    }
    out.length -= 2; // the loop closed back on the first point
    for (let i = 1; i < out.length; i += 2) out[i] = warpY(out[i - 1], out[i]);
    // refined segments near the view feed the distance queries
    const n = out.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = out[2 * i], ay = out[2 * i + 1], bx = out[2 * j], by = out[2 * j + 1];
      if (flags[i]) continue;
      if (Math.max(ax, bx) < X0 || Math.min(ax, bx) > X1 || Math.max(ay, by) < Y0 || Math.min(ay, by) > Y1) continue;
      segs.push(ax, ay, bx, by, R.sign * LAND_SIDE);
    }
    let c = clipEdge(out, 0, X0, false); c = clipEdge(c, 0, X1, true); c = clipEdge(c, 1, Y0, false); c = clipEdge(c, 1, Y1, true);
    if (c.length >= 6) coast.rings.push({ pts: c, sign: R.sign * LAND_SIDE });
  }
  // spatial hash of the refined segments
  const gc = Math.max((X1 - X0) / 48, 1e-9);
  const gw = Math.ceil((X1 - X0) / gc) + 1, gh = Math.ceil((Y1 - Y0) / gc) + 1;
  const grid = new Array(gw * gh);
  const ns = segs.length / 5;
  for (let k = 0; k < ns; k++) {
    const ax = segs[5 * k], ay = segs[5 * k + 1], bx = segs[5 * k + 2], by = segs[5 * k + 3];
    const i0 = clamp(Math.floor((Math.min(ax, bx) - X0) / gc), 0, gw - 1), i1 = clamp(Math.floor((Math.max(ax, bx) - X0) / gc), 0, gw - 1);
    const j0 = clamp(Math.floor((Math.min(ay, by) - Y0) / gc), 0, gh - 1), j1 = clamp(Math.floor((Math.max(ay, by) - Y0) / gc), 0, gh - 1);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (grid[j * gw + i] || (grid[j * gw + i] = [])).push(k);
  }
  Object.assign(coast, { segs, grid, gcell: gc, gx0: X0, gy0: Y0, gw, gh });
}
// signed distance to the coast (+ land, − sea) within maxR metres; NaN when no coast is that close
function coastDist(x, y, maxR) {
  const { segs, grid, gcell, gx0, gy0, gw, gh } = coast;
  const i0 = Math.max(0, Math.floor((x - maxR - gx0) / gcell)), i1 = Math.min(gw - 1, Math.floor((x + maxR - gx0) / gcell));
  const j0 = Math.max(0, Math.floor((y - maxR - gy0) / gcell)), j1 = Math.min(gh - 1, Math.floor((y + maxR - gy0) / gcell));
  let best = maxR * maxR, bs = NaN;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cell = grid[j * gw + i]; if (!cell) continue;
    for (const k of cell) {
      const ax = segs[5 * k], ay = segs[5 * k + 1], dx = segs[5 * k + 2] - ax, dy = segs[5 * k + 3] - ay;
      const L2 = dx * dx + dy * dy || 1e-30, t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
      const ex = x - ax - t * dx, ey = y - ay - t * dy, d2 = ex * ex + ey * ey;
      if (d2 < best) { best = d2; bs = Math.sign(dx * (y - ay) - dy * (x - ax)) * segs[5 * k + 4] || 1; }
    }
  }
  return Number.isNaN(bs) ? NaN : bs * Math.sqrt(best);
}
function landPath() { ctx.beginPath(); for (const R of coast.rings) { const p = R.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); } }
function seaPath() { const m = CV.m; ctx.beginPath(); ctx.rect(-hx - m, -hy - m, 2 * (hx + m), 2 * (hy + m)); for (const R of coast.rings) { const p = R.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); } }
// offset copy of every ring toward the sea by d metres (a number, or fn(x, y) → metres; negative goes inland),
// normals smoothed over `win` samples
function offsetRings(d, win) {
  const res = [];
  for (const R of coast.rings) {
    const p = R.pts, n = p.length / 2, o = new Float64Array(p.length);
    const sg = R.sign;
    for (let i = 0; i < n; i++) {
      const a = (i - win + n) % n, b = (i + win) % n;
      let tx = p[2 * b] - p[2 * a], ty = p[2 * b + 1] - p[2 * a + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      // land lies where (t × (q − p)) · sign > 0, so the sea normal is −sign · (−ty, tx)
      const dd = typeof d === 'number' ? d : d(p[2 * i], p[2 * i + 1]);
      o[2 * i] = p[2 * i] + sg * ty * dd; o[2 * i + 1] = p[2 * i + 1] - sg * tx * dd;
    }
    res.push(o);
  }
  return res;
}

// ---------- baked textures: code-drawn tiles, made once ----------
// Every bake is a generator that yields every few rows, run a few milliseconds at a time by `pump` after the first
// frame, so the dive never stalls on one; a tile needed before its turn is finished on the spot.
const TEX = {};
const BAKES = {};
function finishTex(name, c) {
  // the tile's mean colour stands in for it once a tile shrinks below a few pixels
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let r = 0, g = 0, b = 0, a = 0;
  for (let i = 0; i < d.length; i += 4 * 7) { const w = d[i + 3]; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; a += w; }
  const n = d.length / 28, avg = a ? `rgba(${Math.round(r / a)},${Math.round(g / a)},${Math.round(b / a)},${(a / n / 255).toFixed(3)})` : 'rgba(0,0,0,0)';
  // patterns draw from a plain copy: a canvas made for pixel reads is a slow image source
  const plain = makeCanvas(c.width, c.height); plain.getContext('2d').drawImage(c, 0, 0);
  TEX[name] = { c: plain, pat: ctx.createPattern(plain, 'repeat'), n: c.width, avg };
}
let curJob = null;
// a finished bake asks for one more frame (the frame loop may be idle: reduced motion, or a paused dive)
let bakeLanded = false, allBaked = false;
function requestRender() { bakeLanded = true; }
// a tile not baked yet draws nothing (and jumps the queue) rather than stalling the frame
const WANT = [];
let PLACEHOLDER = null;
const placeholder = () => PLACEHOLDER || (PLACEHOLDER = (() => { const c = makeCanvas(1, 1); return { c, pat: ctx.createPattern(c, 'repeat'), n: 1, avg: 'rgba(0,0,0,0)', ph: true }; })());
function tex(name) {
  if (TEX[name]) return TEX[name];
  if (!WANT.includes(name)) WANT.push(name);
  return placeholder();
}
// the order the dive needs them in
const BAKE_ORDER = ['rock', 'grain', 'lichenBlack', 'kelpbedFar', 'swell', 'barnacleFar', 'musselFar', 'rockweedFar', 'lowzoneFar', 'seabed', 'caustic', 'foam', 'kelpbed', 'ripple', 'glint', 'sand', 'barnacle', 'mussel', 'lowzone', 'rockweed', 'blade', 'cells', 'cellsDark'];
function pump(budgetMs) {
  const t0 = nowMs();
  while (nowMs() - t0 < budgetMs) {
    if (curJob && TEX[curJob.name]) curJob = null;
    if (!curJob) {
      const next = WANT.concat(BAKE_ORDER, Object.keys(BAKES)).find(k => BAKES[k] && !TEX[k]);
      if (!next) { allBaked = true; return; }
      curJob = { name: next, gen: BAKES[next]() };
    }
    const r = curJob.gen.next();
    if (r.done) { finishTex(curJob.name, r.value); curJob = null; requestRender(); }
  }
}
function* imgBakeG(N, M, fn) {
  const c = makeCanvas(N, M), g = c.getContext('2d', { willReadFrequently: true }), img = g.createImageData(N, M), d = img.data;
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < N; x++) { const o = (y * N + x) * 4, v = fn(x, y); d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = v[3] === undefined ? 255 : v[3]; }
    if ((y & 7) === 7) yield;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const ramp3 = (A, B, C, v) => v < .5 ? [lerp(A[0], B[0], v * 2), lerp(A[1], B[1], v * 2), lerp(A[2], B[2], v * 2)] : [lerp(B[0], C[0], v * 2 - 1), lerp(B[1], C[1], v * 2 - 1), lerp(B[2], C[2], v * 2 - 1)];
// draw fn at the tile and its 8 wrapped neighbours so shapes cross the seams
function wrapDraw(g, N, x, y, r, fn) {
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const X = x + i * N, Y = y + j * N;
    if (X + r < 0 || X - r > N || Y + r < 0 || Y - r > N) continue;
    fn(X, Y);
  }
}

// bedrock: diorite and greenstone, glacially smoothed, speckled, cracked (self-similar: drawn by octaves)
BAKES.rock = function* () {
  const N = 512, A = hexRgb(PAL.ROCK_DARK), B = hexRgb(PAL.ROCK_BASE), C = hexRgb(PAL.ROCK_LIGHT);
  const c = yield* imgBakeG(N, N, (x, y) => {
    const n = pfbm(x / N * 6, y / N * 6, 6, 6, 5, 11), m = pfbm(x / N * 40, y / N * 40, 40, 40, 2, 23);
    let v = clamp((n - .5) * 1.7 + .5, 0, 1) * .8 + m * .2;
    const h = hash(x, y, 7); if (h > .94) v -= .22; else if (h < .04) v += .18;
    const col = ramp3(A, B, C, clamp(v, 0, 1));
    return col;
  });
  const g = c.getContext('2d'), r = rng(31);
  g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    let x = r() * N, y = r() * N, a = r() * 6.28;
    const pts = [[x, y]];
    for (let i = 0; i < 14; i++) { a += (r() - .5) * .9; x += Math.cos(a) * 14; y += Math.sin(a) * 14; pts.push([x, y]); }
    wrapDraw(g, N, 0, 0, 1e9, (ox, oy) => {
      g.beginPath(); pts.forEach(([px0, py0], i) => i ? g.lineTo(px0 + ox, py0 + oy) : g.moveTo(px0 + ox, py0 + oy));
      g.strokeStyle = 'rgba(25,22,18,.35)'; g.lineWidth = 1.2; g.stroke();
      g.translate(1, 1); g.strokeStyle = 'rgba(210,205,190,.25)'; g.lineWidth = .8; g.stroke(); g.translate(-1, -1);
    });
  }
  return c;
};
// crystals in the stone: dark grains, pale feldspar, a few glints, on transparent (self-similar)
BAKES.grain = function* () {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(131);
  for (let k = 0; k < 2600; k++) {
    if (k % 400 === 399) yield;
    const x = r() * N, y = r() * N, t = r(), rr = .6 + r() * r() * 3.2, a = r() * 3.14;
    g.fillStyle = t < .45 ? 'rgba(18,18,14,.75)' : t < .85 ? 'rgba(225,220,205,.55)' : 'rgba(150,120,95,.5)';
    wrapDraw(g, N, x, y, rr * 2, (X, Y) => { g.beginPath(); g.ellipse(X, Y, rr * 1.4, rr, a, 0, 7); g.fill(); });
  }
  return c;
};
// black tar lichen (Verrucaria) of the splash zone: mottled, with holes that let the rock through
BAKES.lichenBlack = function* () {
  const N = 512, C = hexRgb(PAL.LICHEN_BLACK);
  return yield* imgBakeG(N, N, (x, y) => { const n = pfbm(x / N * 16, y / N * 16, 16, 16, 4, 41), m = pfbm(x / N * 64, y / N * 64, 64, 64, 2, 43); return [C[0] + m * 40, C[1] + m * 36, C[2] + m * 30, clamp((n - .42) * 4, 0, 1) * (150 + m * 90)]; });
};
// acorn barnacles (Balanus), true scale: tile = 0.24 m
BAKES.barnacle = function* () {
  const N = 1024, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(51);
  const items = [];
  for (let k = 0; k < 520; k++) {
    const x = r() * N, y = r() * N;
    const clump = pnoise(x / N * 5, y / N * 5, 5, 5, 3);
    if (clump < .38 && r() < .8) continue;
    items.push([x, y, 10 + r() * 28 * (.6 + clump * .6), r()]);
  }
  items.sort((a, b) => a[1] - b[1]);
  // four baked barnacles, turned and scaled, instead of one gradient set per shell
  const spr = [0, 1, 2, 3].map(k => { const sc = makeCanvas(96, 96), sg = sc.getContext('2d'); barnacle(sg, 44, 44, 36, k * .23); return sc; });
  let n = 0;
  for (const [x, y, rr, t] of items) { if (++n % 60 === 0) yield; wrapDraw(g, N, x, y, rr * 1.4, (X, Y) => { g.drawImage(spr[Math.floor(t * 4) & 3], X - rr * 44 / 36, Y - rr * 44 / 36, rr * 96 / 36, rr * 96 / 36); }); }
  return c;
};
function barnacle(g, X, Y, rr, t) {
  g.fillStyle = 'rgba(20,18,14,.35)'; g.beginPath(); g.ellipse(X + rr * .22, Y + rr * .28, rr * 1.05, rr, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(X - rr * .35, Y - rr * .4, rr * .1, X, Y, rr);
  gr.addColorStop(0, PAL.BARNACLE_LIGHT); gr.addColorStop(.6, PAL.BARNACLE_BASE); gr.addColorStop(1, PAL.BARNACLE_DARK);
  g.fillStyle = gr; g.beginPath();
  for (let i = 0; i <= 6; i++) { const a = i / 6 * 6.283 + t * 3, k = rr * (.9 + .1 * Math.cos(i * 2.7 + t * 9)); i ? g.lineTo(X + Math.cos(a) * k, Y + Math.sin(a) * k) : g.moveTo(X + Math.cos(a) * k, Y + Math.sin(a) * k); }
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,64,52,.5)'; g.lineWidth = Math.max(.6, rr * .07);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + t * 3; g.beginPath(); g.moveTo(X + Math.cos(a) * rr * .35, Y + Math.sin(a) * rr * .35); g.lineTo(X + Math.cos(a) * rr * .92, Y + Math.sin(a) * rr * .92); g.stroke(); }
  g.fillStyle = '#3c372e'; g.beginPath(); g.ellipse(X, Y, rr * .3, rr * .17, t * 3, 0, 7); g.fill();
  g.strokeStyle = 'rgba(240,236,224,.7)'; g.lineWidth = Math.max(.5, rr * .06); g.beginPath(); g.ellipse(X, Y, rr * .3, rr * .17, t * 3, Math.PI, Math.PI * 1.7); g.stroke();
}
// rockweed (Fucus): forked olive fronds with swollen tips, true scale: tile = 0.9 m
BAKES.rockweed = function* () {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(61);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // record each clump's strokes once, then replay them at every wrapped offset so the seams match
  const frond = (ops, x, y, a, len, w, d) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ops.push(['s', x, y, (x + x2) / 2 + Math.cos(a + 1.57) * len * .12, (y + y2) / 2 + Math.sin(a + 1.57) * len * .12, x2, y2, w, d > 2 ? PAL.ROCKWEED_LIGHT : PAL.ROCKWEED_BASE]);
    if (d > 0 && r() < .5) ops.push(['b', (x + x2) / 2, (y + y2) / 2, w, a]);
    if (d < 3) { frond(ops, x2, y2, a - .32 - r() * .2, len * .85, w * .9, d + 1); frond(ops, x2, y2, a + .32 + r() * .2, len * .85, w * .9, d + 1); }
    else ops.push(['t', x2, y2, w, a]);
  };
  for (let k = 0; k < 44; k++) {
    yield;
    const x = r() * N, y = r() * N, a0 = r() * 6.28, ops = [];
    for (let b = 0; b < 3; b++) frond(ops, x, y, a0 + b * 2.1 + r() * .5, 16 + r() * 10, 9, 0);
    wrapDraw(g, N, x, y, 140, (X, Y) => {
      const ox = X - x, oy = Y - y;
      // shade on the rock first (down-right of the light), then the fronds
      g.strokeStyle = 'rgba(0,0,0,.3)';
      for (const o of ops) if (o[0] === 's') { g.lineWidth = o[7] + 3; g.beginPath(); g.moveTo(o[1] + ox + 2, o[2] + oy + 3); g.quadraticCurveTo(o[3] + ox + 2, o[4] + oy + 3, o[5] + ox + 2, o[6] + oy + 3); g.stroke(); }
      for (const o of ops) {
        if (o[0] === 's') {
          g.strokeStyle = PAL.ROCKWEED_DARK; g.lineWidth = o[7] + 1.6; g.beginPath(); g.moveTo(o[1] + ox, o[2] + oy); g.quadraticCurveTo(o[3] + ox, o[4] + oy, o[5] + ox, o[6] + oy); g.stroke();
          g.strokeStyle = o[8]; g.lineWidth = o[7]; g.stroke();
          g.strokeStyle = 'rgba(210,190,110,.35)'; g.lineWidth = 1; g.stroke();
        } else if (o[0] === 'b') {
          for (const sd of [-1, 1]) { const bx = o[1] + ox + Math.cos(o[4] + 1.57) * sd * o[3] * .28, by = o[2] + oy + Math.sin(o[4] + 1.57) * sd * o[3] * .28;
            const gr = g.createRadialGradient(bx - 1, by - 1, .5, bx, by, o[3] * .32); gr.addColorStop(0, '#d8c27a'); gr.addColorStop(1, PAL.ROCKWEED_BASE);
            g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by, o[3] * .34, o[3] * .26, o[4], 0, 7); g.fill(); }
        } else { g.fillStyle = '#b3a04c'; g.beginPath(); g.ellipse(o[1] + ox, o[2] + oy, o[3] * .8, o[3] * .55, o[4], 0, 7); g.fill(); }
      }
    });
  }
  return c;
};
// blue mussels in clumps, true scale: tile = 0.5 m
BAKES.mussel = function* () {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(71);
  for (let k = 0; k < 420; k++) {
    const x = r() * N, y = r() * N; if (pnoise(x / N * 4, y / N * 4, 4, 4, 9) < .45) continue;
    const L = 16 + r() * 22, a = r() * 6.28;
    wrapDraw(g, N, x, y, L, (X, Y) => {
      g.save(); g.translate(X, Y); g.rotate(a);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(2, 3, L * .5, L * .26, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(0, -L * .25, 0, L * .25); gr.addColorStop(0, PAL.MUSSEL_SHEEN); gr.addColorStop(.35, '#26304a'); gr.addColorStop(1, PAL.MUSSEL_DARK);
      g.fillStyle = gr; g.beginPath(); g.moveTo(-L * .5, 0); g.quadraticCurveTo(-L * .2, -L * .3, L * .5, -L * .05); g.quadraticCurveTo(L * .1, L * .3, -L * .5, 0); g.fill();
      g.strokeStyle = 'rgba(180,195,220,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L * .3, -L * .08); g.quadraticCurveTo(0, -L * .2, L * .35, -L * .07); g.stroke();
      g.restore();
    });
  }
  return c;
};
// the low zone: pink coralline crusts and bright surfgrass, true scale: tile = 0.7 m
BAKES.lowzone = function* () {
  const N = 512, c = yield* imgBakeG(N, N, (x, y) => {
    const n = pfbm(x / N * 6, y / N * 6, 6, 6, 4, 81), m = pfbm(x / N * 24, y / N * 24, 24, 24, 2, 83);
    const a = clamp((n - .42) * 4, 0, 1);
    const P = hexRgb(PAL.CORALLINE), L = hexRgb(PAL.CORALLINE_LIGHT);
    return [lerp(P[0], L[0], m), lerp(P[1], L[1], m), lerp(P[2], L[2], m), a * 230];
  });
  const g = c.getContext('2d'), r = rng(85);
  g.lineCap = 'round';
  for (let k = 0; k < 160; k++) {
    const x = r() * N, y = r() * N; if (pnoise(x / N * 3, y / N * 3, 3, 3, 87) < .5) continue;
    const a = .6 + (r() - .5) * .6, L = 30 + r() * 50, col = r() < .5 ? PAL.SURFGRASS : '#57b44f';
    wrapDraw(g, N, x, y, L, (X, Y) => {
      g.strokeStyle = col; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(a) * L * .5 + 6, Y + Math.sin(a) * L * .5, X + Math.cos(a) * L, Y + Math.sin(a) * L); g.stroke();
    });
  }
  return c;
};
// sand and fine gravel of a pocket beach (self-similar)
BAKES.sand = function* () {
  const N = 256, A = hexRgb(PAL.SAND_WET), B = hexRgb(PAL.SAND_BASE), C = hexRgb(PAL.SAND_LIGHT);
  return yield* imgBakeG(N, N, (x, y) => { const n = pfbm(x / N * 8, y / N * 8, 8, 8, 4, 91); const h = hash(x, y, 93); return ramp3(A, B, C, clamp(n * .8 + .2 + (h > .9 ? .15 : h < .08 ? -.2 : 0), 0, 1)); });
};
// wind ripples on the water, neutral grey for soft-light (self-similar, animated by drifting)
BAKES.ripple = function* () {
  const N = 256;
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N * 6.2832, v = y / N * 6.2832;
    const h = Math.sin(u * 3 + v * 2 + 1.3 * Math.sin(v * 2)) * .5 + Math.sin(u * 5 - v * 4 + 2) * .3 + Math.sin(u * 2 + v * 7 + 1.7 * Math.sin(u * 3)) * .25
      + (pfbm(x / N * 8, y / N * 8, 8, 8, 3, 97) - .5) * 1.2;
    const g0 = 128 + h * 42;
    return [g0, g0, g0];
  });
};
// long swell from the open strait: soft crests (neutral grey for soft-light), true scale: tile = 90 m
BAKES.swell = function* () {
  const N = 256;
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N, w = pfbm(u * 3, v * 3, 3, 3, 3, 701);
    const h = Math.sin((v * 7 + u * 1 + w * 1.4) * 6.2832) * .6 + Math.sin((v * 11 - u * 2 + w * 2) * 6.2832) * .25 + (pfbm(u * 12, v * 12, 12, 12, 2, 703) - .5) * .5;
    const g0 = 128 + h * 36;
    return [g0, g0, g0];
  });
};
// sun glints: sparse bright specks (added with 'lighter', drifting against the ripples)
BAKES.glint = function* () {
  const N = 256, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(101);
  for (let k = 0; k < 60; k++) {
    const x = r() * N, y = r() * N, rr = .6 + r() * 1.6;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr * 2.5); gr.addColorStop(0, 'rgba(255,252,235,.95)'); gr.addColorStop(1, 'rgba(255,252,235,0)');
    g.fillStyle = gr; g.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6);
  }
  return c;
};
// a bull kelp canopy seen from above: bulbs trailing blades down-current, true scale: tile = 24 m
BAKES.kelpbed = function* () {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), r = rng(111), k = N / 24;
  g.lineCap = 'round';
  for (let i = 0; i < 120; i++) {
    const x = r() * N, y = r() * N, a = .45 + (r() - .5) * .5, Ls = [0, 1, 2, 3, 4].map(() => (1.4 + r() * 1.6) * k);
    wrapDraw(g, N, x, y, 3.2 * k, (X, Y) => {
      for (let b = 0; b < 5; b++) {
        const aa = a + (b - 2) * .12, L = Ls[b];
        g.strokeStyle = b % 2 ? 'rgba(120,92,34,.8)' : 'rgba(146,112,44,.8)'; g.lineWidth = .1 * k;
        g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(aa) * L * .5 + 2, Y + Math.sin(aa) * L * .5 - 2, X + Math.cos(aa) * L, Y + Math.sin(aa) * L); g.stroke();
      }
      g.fillStyle = PAL.KELP_DARK; g.beginPath(); g.arc(X + 1, Y + 1, .08 * k, 0, 7); g.fill();
      g.fillStyle = PAL.KELP_LIGHT; g.beginPath(); g.arc(X, Y, .065 * k, 0, 7); g.fill();
    });
  }
  return c;
};

// lacy sea foam: a white sheet torn into holes, streaked, with loose bubbles; true scale: tile = 2.4 m
BAKES.foam = function* () {
  const N = 512, G = 14, jit = (x, y, k) => hash(x, y, 601 + k) * .9 + .05;
  const c = yield* imgBakeG(N, N, (x, y) => {
    let u = x / N, v = y / N;
    u += (pfbm(u * 4, v * 4, 4, 4, 2, 608) - .5) * .06; v += (pfbm(u * 4 + 3, v * 4, 4, 4, 2, 609) - .5) * .06;
    const [d1, d2] = vor(((u % 1) + 1) % 1, ((v % 1) + 1) % 1, G, jit);
    const e = (d2 - d1) * G;
    const sheet = pfbm(u * 5, v * 5, 5, 5, 4, 605);
    const hole = clamp((e - .08) / .5, 0, 1) * clamp((sheet - .35) * 3, 0, 1);
    const al = clamp(1 - hole, 0, 1) * clamp((sheet - .2) * 2.5, 0, 1);
    return [246, 250, 249, al * 235];
  });
  const g = c.getContext('2d'), r = rng(607);
  for (let k = 0; k < 420; k++) { const x = r() * N, y = r() * N, rr = .8 + r() * 3.2; wrapDraw(g, N, x, y, rr + 1, (X, Y) => { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .9; g.beginPath(); g.arc(X, Y, rr, 0, 7); g.stroke(); }); }
  return c;
};
// the shallow sea floor: sand with ripple marks, cobbles, weed tufts; true scale: tile = 5 m
BAKES.seabed = function* () {
  const N = 512, A = hexRgb('#1f2a20'), B = hexRgb('#3d4a33'), C = hexRgb('#79784f');
  const c = yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N;
    const rip = Math.sin((u * 9 + v * 3 + pfbm(u * 3, v * 3, 3, 3, 2, 611) * 1.5) * 6.2832) * .5 + .5;
    const n = pfbm(u * 6, v * 6, 6, 6, 4, 613);
    return ramp3(A, B, C, clamp(n * .7 + rip * .3, 0, 1));
  });
  const g = c.getContext('2d'), r = rng(615);
  for (let k = 0; k < 90; k++) {
    const x = r() * N, y = r() * N, rr = 4 + r() * 14, t = r();
    if (pnoise(x / N * 3, y / N * 3, 3, 3, 617) < .45) continue;
    wrapDraw(g, N, x, y, rr * 1.4, (X, Y) => {
      g.fillStyle = 'rgba(20,20,16,.35)'; g.beginPath(); g.ellipse(X + rr * .2, Y + rr * .25, rr, rr * .8, t, 0, 7); g.fill();
      const gr = g.createRadialGradient(X - rr * .35, Y - rr * .35, rr * .1, X, Y, rr);
      gr.addColorStop(0, '#8a8a78'); gr.addColorStop(.6, '#56594a'); gr.addColorStop(1, '#2c2f27');
      g.fillStyle = gr; g.beginPath(); g.ellipse(X, Y, rr, rr * .8, t, 0, 7); g.fill();
    });
  }
  for (let k = 0; k < 40; k++) {
    const x = r() * N, y = r() * N, col = r() < .5 ? 'rgba(70,120,50,.8)' : 'rgba(120,80,40,.75)';
    const fr = [...Array(7)].map(() => [r() * 6.28, 6 + r() * 14]);
    wrapDraw(g, N, x, y, 24, (X, Y) => { g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); for (const [a, L] of fr) { g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(a) * L * .6 + 3, Y + Math.sin(a) * L * .6, X + Math.cos(a) * L, Y + Math.sin(a) * L); } g.stroke(); });
  }
  return c;
};
// A zone's cover seen from farther away: its own bake at a larger true size, kept only in slow-noise patches so the
// zone reads as a mosaic, not a stripe of paint. Its alpha doubles as the patch mask for the near tile (zoneFill).
const FAR = { barnacle: [25, .24], mussel: [12, .5], rockweed: [8, .9], lowzone: [8, .7] };
const patch = (u, v, seed, cover) => clamp((pfbm(u * 6, v * 6, 6, 6, 5, seed) - (1 - cover)) * 6 + .5, 0, 1);
BAKES.barnacleFar = function* () {
  const N = 512, L = hexRgb(PAL.BARNACLE_LIGHT), B = hexRgb(PAL.BARNACLE_BASE), D = hexRgb(PAL.BARNACLE_DARK);
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N, a = patch(u, v, 501, .62);
    const h = hash(x, y, 503), n = pfbm(u * 96, v * 96, 96, 96, 2, 505);
    const c = h > .82 ? B : ramp3(D, B, L, clamp(n * .8 + .3, 0, 1));
    return [c[0], c[1], c[2], a * 245];
  });
};
BAKES.musselFar = function* () {
  const N = 512, D = hexRgb(PAL.MUSSEL_DARK), S = hexRgb(PAL.MUSSEL_SHEEN);
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N, a = clamp((pfbm(u * 8, v * 8, 8, 8, 4, 521) - .56) * 14, 0, 1);
    const n = pfbm(u * 64, v * 64, 64, 64, 2, 523), sh = hash(x, y, 525) > .88 ? .7 : 0;
    return [lerp(D[0], S[0], n * .35 + sh), lerp(D[1], S[1], n * .35 + sh), lerp(D[2], S[2], n * .35 + sh), a * 240];
  });
};
// rockweed mats: strands lying downslope (tile y runs toward the sea), golden at the tips
BAKES.rockweedFar = function* () {
  const N = 512, D = hexRgb(PAL.ROCKWEED_DARK), B = hexRgb(PAL.ROCKWEED_BASE), L = hexRgb(PAL.ROCKWEED_LIGHT);
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N, a = patch(u, v, 511, .72);
    const st = pfbm(u * 36 + pfbm(u * 4, v * 4, 4, 4, 2, 513) * 5, v * 14, 36, 14, 3, 515), cl = pfbm(u * 16, v * 16, 16, 16, 4, 517);
    const gl = hash(x, y, 519) > .985 ? .5 : 0;
    const c = ramp3(D, B, L, clamp((st - .5) * 1.8 + .3 + cl * .35 + gl, 0, 1));
    return [c[0], c[1], c[2], a * clamp((cl - .3) * 4, 0, 1) * 245];
  });
};
// the low zone: bright surfgrass streaks and pink coralline crust
BAKES.lowzoneFar = function* () {
  const N = 512, G = hexRgb(PAL.SURFGRASS), P = hexRgb(PAL.CORALLINE), PL = hexRgb(PAL.CORALLINE_LIGHT);
  return yield* imgBakeG(N, N, (x, y) => {
    const u = x / N, v = y / N, a = patch(u, v, 531, .72);
    const g = pfbm(u * 60, v * 8, 60, 8, 3, 533), pk = pfbm(u * 10, v * 10, 10, 10, 3, 535);
    const pink = pk > .7, c = pink ? ramp3(P, P, PL, pfbm(u * 40, v * 40, 40, 40, 2, 537) * .5) : [G[0] * (.5 + g * .45), G[1] * (.5 + g * .45), G[2] * (.55 + g * .4)];
    return [c[0] * .8 + 14, c[1] * .8 + 12, c[2] * .8 + 14, a * (pink ? 110 : clamp(g * 1.6 - .3, 0, 1) * 225)];
  });
};

// a kelp canopy seen from far off: mottled golden-brown clumps, true scale: tile = 150 m
BAKES.kelpbedFar = function* () {
  const N = 256, D = hexRgb('#4c3812'), B = hexRgb('#7c5e22'), L = hexRgb('#a7843c');
  return yield* imgBakeG(N, N, (x, y) => { const u = x / N, v = y / N, n = pfbm(u * 12, v * 12, 12, 12, 4, 621), m = pfbm(u * 48, v * 48, 48, 48, 2, 623);
    const c = ramp3(D, B, L, clamp(m * .8 + .1, 0, 1)); return [c[0], c[1], c[2], clamp((n - .36) * 3, 0, 1) * 230]; });
};

// ---------- sprites ----------
// soft round glow (white; tinted by drawing into a colour via 'source-in' copies)
function glowSprite(hex, N = 64) {
  const c = makeCanvas(N, N), g = c.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(.35, rgba(hex, .45)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, N, N); return c;
}
const SPR = {};
function sprite(name, make) { return SPR[name] || (SPR[name] = make()); }


// ---------- the shore (metres, z 4.85 → -1.4; ticket #801) ----------
const FOCAL_ROCK = { x: .15, y: -.55, r: 1.6 };
const FIXED_POOL = { x: -9, y: -6, rx: 3.2, ry: 2 };
const KELP_PATCHES = [[180, 70, 30], [-140, 95, 38], [420, 120, 44], [-420, 60, 26], [40, 150, 32], [760, 180, 54], [-800, 150, 48]];
const KELP_BED_LABEL = [180, 70];
// intertidal zones from the forest edge down to the water, as half-widths of strokes centred on the waterline
const ZONE = { band: 16, lichen: 12.5, barnacle: 8, mussel: 6.2, rockweed: 4.6, low: 1.7 };

// a true-scale tile: the pattern while its tile is big enough to read, its mean colour below that
function trueStyle(name, tileWorld, rot = 0) {
  const t = tex(name), tp = tileWorld * s;
  const w = sstep(40, 90, tp);
  return { w, avg: t.avg, pat: w > 0 ? patXf(t.pat, t.n, tileWorld, rot) : null };
}
function strokeTrue(name, tileWorld, width, alpha = 1) {
  const st = trueStyle(name, tileWorld);
  ctx.lineWidth = width;
  if (st.w < 1) { ctx.globalAlpha = alpha * (1 - st.w); ctx.strokeStyle = st.avg; ctx.stroke(); }
  if (st.w > 0) { ctx.globalAlpha = alpha * st.w; ctx.strokeStyle = st.pat; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function fillTrue(name, tileWorld, alpha = 1, rule) {
  const st = trueStyle(name, tileWorld);
  if (st.w < 1) { ctx.globalAlpha = alpha * (1 - st.w); ctx.fillStyle = st.avg; ctx.fill(rule); }
  if (st.w > 0) { ctx.globalAlpha = alpha * st.w; ctx.fillStyle = st.pat; ctx.fill(rule); }
  ctx.globalAlpha = 1;
}
// a self-similar tile at two octaves (see `octaves`)
function strokeOct(name, tile0, width, alpha = 1, target = 380) {
  const t = tex(name); ctx.lineWidth = width;
  octaves(tile0, t.n, 4, (w, a) => { ctx.globalAlpha = alpha * a; ctx.strokeStyle = patXf(t.pat, t.n, w); ctx.stroke(); }, target);
  ctx.globalAlpha = 1;
}
function fillOct(name, tile0, alpha = 1, rule, target = 380, rot = 0, ox = 0, oy = 0) {
  const t = tex(name);
  octaves(tile0, t.n, 4, (w, a) => { ctx.globalAlpha = alpha * a; ctx.fillStyle = patXf(t.pat, t.n, w, rot, ox % w, oy % w); ctx.fill(rule); }, target);
  ctx.globalAlpha = 1;
}
function ringsPath(rings) { ctx.beginPath(); for (const p of rings) { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); } }
const capHalf = w => Math.min(w, CV.m * .9);
// ---- wide strokes along the coast ----
// A stroke of half-width w can only paint the view from segments within w of it, and with round joins and caps a
// polyline cut into the runs that pass that test paints exactly the same pixels there. At close range the coast
// strokes are thousands of pixels wide over thousands of vertices, and every kept segment is a view-sized quad for
// the GPU, so the runs are also thinned (radial decimation at a few percent of the width, never under a pixel),
// which moves an edge by at most that much. Dashed strokes keep every vertex (the dash phase follows arc length).
// runs: [{ p: flat [x, y, ...], u0: arc length of the run's first point, closed }]
function nearRuns(polys, w, closed = true, seam = true) {
  const runs = [], x0 = -hx - w, x1 = hx + w, y0 = -hy - w, y1 = hy + w;
  for (const P of polys) {
    const n = P.length / 2, segs = closed ? n : n - 1;
    if (n < 2) continue;
    let run = null, u = 0, first = null;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n, ax = P[2 * i], ay = P[2 * i + 1], bx = P[2 * j], by = P[2 * j + 1];
      const keep = !(Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1);
      if (keep) { if (!run) { run = { p: [ax, ay], u0: u, closed: false, P, i0: i }; if (i === 0) first = run; runs.push(run); } run.p.push(bx, by); }
      else run = null;
      u += Math.hypot(bx - ax, by - ay);
    }
    // a closed ring kept whole stays closed; a run through the seam joins the run that starts at vertex 0 (not for
    // dashes, whose phase restarts at vertex 0 as it did on the whole ring)
    if (closed && seam && run && first && run !== first) { const f = first.p; for (let i = 2; i < f.length; i++) run.p.push(f[i]); runs.splice(runs.indexOf(first), 1); }
    else if (closed && run && run === first && run.p.length / 2 === segs + 1) { run.p.length -= 2; run.closed = true; }
  }
  return runs;
}
function runsPath(runs, tol) {
  ctx.beginPath();
  for (const R of runs) {
    const p = R.p, m = p.length;
    // keep a vertex each time the arc length along the whole ring passes a multiple of tol: the choice is the same
    // from frame to frame, so a thinned edge does not shimmer as the culled runs change
    let u = R.u0, cell = tol > 0 ? Math.floor(u / tol) : 0;
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < m; i += 2) {
      u += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      const c = tol > 0 ? Math.floor(u / tol) : cell + 1;
      if (c !== cell || i === m - 2) { cell = c; ctx.lineTo(p[i], p[i + 1]); }
    }
    if (R.closed) ctx.closePath();
  }
}
// the path for a solid stroke of half-width w (metres) along the polylines, near the view only; thinned to a small
// fraction of the narrowest width that will be stroked on it (tw)
function strokeNearPath(polys, w, closed = true, tw = w) { runsPath(nearRuns(polys, w, closed), Math.max(tw * .015, px(.35))); }
// A dashed stroke near the view. Canvas restarts the dash pattern at every subpath, so each run starts a little
// earlier on its ring, at the arc length where the pattern would begin a period, then all of them are stroked as one
// path (overlaps blend once, as on the whole ring).
function strokeNearDashed(polys, w, offset, period, paint) {
  const runs = nearRuns(polys, w, true, false);
  for (const R of runs) {
    let e = R.u0 % period;
    const P = R.P, pre = [];
    for (let i = R.i0; i > 0 && e > 0; i--) {
      const ax = P[2 * i], ay = P[2 * i + 1], bx = P[2 * i - 2], by = P[2 * i - 1], L = Math.hypot(bx - ax, by - ay);
      if (L >= e) { const t = e / L; pre.push(ax + (bx - ax) * t, ay + (by - ay) * t); e = 0; }
      else { pre.push(bx, by); e -= L; }
    }
    if (pre.length) { const q = []; for (let i = pre.length - 2; i >= 0; i -= 2) q.push(pre[i], pre[i + 1]); R.p = q.concat(R.p); }
  }
  runsPath(runs, 0); ctx.lineDashOffset = offset; paint();
}
// a view-sized scratch layer (device pixels), for patterns that need a mask
const LAYER = { c: null, g: null, pats: {} };
function layer() {
  const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
  if (!LAYER.c || LAYER.c.width !== W || LAYER.c.height !== H) { LAYER.c = makeCanvas(W, H); LAYER.g = LAYER.c.getContext('2d'); LAYER.pats = {}; }
  const g = LAYER.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  g.setTransform(dpr, 0, 0, dpr, dpr * cw / 2, dpr * ch / 2);
  return g;
}
function layerPat(name, tileWorld, rot = 0) {
  // a tile still baking is drawn through the placeholder, never cached: a cached placeholder outlived the bake and
  // the sea floor stayed blank (ticket #797's evidence: seconds a frame at zoom 2.5 on the software GL box)
  const t = tex(name), pat = t.ph ? t.pat : LAYER.pats[name] || (LAYER.pats[name] = LAYER.g.createPattern(t.c, 'repeat'));
  const k = tileWorld * s / t.n, c = Math.cos(rot) * k, sn = Math.sin(rot) * k;
  pat.setTransform(new DOMMatrix([c, sn, -sn, c, 0, 0]));
  return pat;
}
// The near tile masked by its own far tile (the patch mosaic), once per frame per zone in a view-sized layer that the
// zone's band and the focal rock both draw from.
const ZLAYER = {};
function nearLayer(name) {
  const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
  let L = ZLAYER[name];
  if (!L || L.c.width !== W || L.c.height !== H) { L = ZLAYER[name] = { c: makeCanvas(W, H), frame: -1 }; L.g = L.c.getContext('2d'); L.pats = {}; }
  if (L.frame === frameNo) return L;
  L.frame = frameNo;
  const [K, tile] = FAR[name], g = L.g, pat = (n, tw) => {
    const t = tex(n), pt = t.ph ? t.pat : L.pats[n] || (L.pats[n] = g.createPattern(t.c, 'repeat')), k = tw * s / t.n;
    pt.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); return pt;
  };
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  // 'copy' replaces the last frame's pixels in the same pass that draws the tile
  g.globalCompositeOperation = 'copy';
  g.setTransform(dpr, 0, 0, dpr, dpr * cw / 2, dpr * ch / 2);
  g.fillStyle = pat(name, tile); g.fillRect(-cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = pat(name + 'Far', tile * K); g.fillRect(-cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4);
  g.globalCompositeOperation = 'source-over';
  return L;
}
// a world box [x0, y0, x1, y1] as a view-centred CSS-pixel rect [x, y, w, h], cut to the view; null when off it
function viewRect(box) {
  const X0 = -cw / 2 - 2, Y0 = -ch / 2 - 2, X1 = cw / 2 + 2, Y1 = ch / 2 + 2;
  if (!box) return [X0, Y0, X1 - X0, Y1 - Y0];
  const a = Math.max(X0, Math.floor(box[0] * s) - 2), b = Math.max(Y0, Math.floor(box[1] * s) - 2);
  const c = Math.min(X1, Math.ceil(box[2] * s) + 2), d = Math.min(Y1, Math.ceil(box[3] * s) + 2);
  return c > a && d > b ? [a, b, c - a, d - b] : null;
}
// An intertidal zone's cover inside the current path: its mean colour far off, the patchy far tile in the middle
// distance, and close in the near tile masked by the same patches, so the mosaic never changes as you zoom.
// `box` (world) bounds the path: every fill stays inside it, so a small shape never pays for the whole view.
function zoneFill(name, alpha, rule, near = true, box = null) {
  const r = viewRect(box);
  if (!r) return;
  const [K, tile] = FAR[name], farName = name + 'Far';
  const wn = near ? sstep(60, 130, tile * s) : 0, wf = sstep(24, 70, tile * K * s);
  ctx.save(); ctx.clip(rule);
  if (wf < 1) { ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, dpr * cw / 2, dpr * ch / 2); ctx.globalAlpha = alpha * (1 - wf); ctx.fillStyle = tex(farName).avg; ctx.fillRect(...r); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (wf > 0 && wn < 1) viewPat(farName, tile * K, alpha * wf * (1 - wn), 0, 0, 0, undefined, r);
  if (wn > .02) {
    const L = nearLayer(name);
    const sx = Math.max(0, Math.floor((r[0] + cw / 2) * dpr)), sy = Math.max(0, Math.floor((r[1] + ch / 2) * dpr));
    const sw = Math.min(L.c.width, Math.ceil((r[0] + r[2] + cw / 2) * dpr)) - sx, sh = Math.min(L.c.height, Math.ceil((r[1] + r[3] + ch / 2) * dpr)) - sy;
    if (sw > 0 && sh > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha * wn; ctx.drawImage(L.c, sx, sy, sw, sh, sx, sy, sw, sh); ctx.restore(); }
  }
  ctx.restore();
}
// The shallows and the sea-floor mask are both functions of one number: how far a pixel of sea is from the coast.
// They used to be stacks of 28 and 6 round-joined strokes of the rings, up to ~270 px wide: exact, but every join is
// a disc the size of the view, so the GPU paid thousands of view-sized overdraws a frame. Instead the distance comes
// from an exact Euclidean distance transform of the land mask (edt2d, as the planet's coast bakes use) on the same 1/6-res
// grid, plus a 4× coarser grid for land beyond it (the wide strokes reached up to 0.9 × CV.m past the view); each
// pixel then composites the very strokes that would have covered it, with the same anti-aliased edge.
const SEA_K = 6, SEA_KC = 4, SEA_PAD = 8, SEA_COARSE_MAX = 12000;
const SEA = { mc: null, mg: null, cc: null, cg: null, frame: -1, W: 0, H: 0, d: null };
function landGrid(g, c, W, H, scale, rings) {
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.setTransform(scale, 0, 0, scale, W / 2, H / 2);
  g.beginPath(); for (const p of rings) { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  g.fillStyle = '#fff'; g.fill('nonzero');
  const img = g.getImageData(0, 0, W, H).data, f = new Float64Array(W * H);
  for (let i = 0; i < f.length; i++) f[i] = img[i * 4 + 3] >= 128 ? 0 : 1e20;
  return f;
}
// distance (metres) from each cell of the W × H grid (k px a cell, centred on the view) to the nearest land
function seaDistance(rings, W, H) {
  if (SEA.frame === frameNo && SEA.W === W && SEA.H === H) return SEA.d;
  if (!SEA.mc) { SEA.mc = makeCanvas(1, 1); SEA.mg = SEA.mc.getContext('2d', { willReadFrequently: true }); SEA.cc = makeCanvas(1, 1); SEA.cg = SEA.cc.getContext('2d', { willReadFrequently: true }); }
  const cell = SEA_K / s;
  // fine: the grid plus a pad, so land just past the edge is measured exactly too
  const FW = W + 2 * SEA_PAD, FH = H + 2 * SEA_PAD;
  const f = landGrid(SEA.mg, SEA.mc, FW, FH, s / SEA_K, rings);
  runSync(edt2d(f, FW, FH));
  // coarse: land past the fine grid matters only where it is nearer than the farthest fine distance, and never past
  // the widest stroke's reach; land inside the fine grid is left out (the fine grid has it exactly)
  let far = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f[(y + SEA_PAD) * FW + x + SEA_PAD]; if (v > far) far = v; }
  const reach = Math.min(capHalf(9000), far >= 1e19 ? 1e30 : Math.sqrt(far) * cell);
  let kf = SEA_KC, mc = 0, CW = 0, CH = 0;
  for (;;) {
    mc = Math.ceil(reach * s / (SEA_K * kf)) + 1; CW = Math.ceil(FW / kf) + 2 * mc; CH = Math.ceil(FH / kf) + 2 * mc;
    if (CW * CH <= SEA_COARSE_MAX) break;
    kf *= 2;
  }
  const c = landGrid(SEA.cg, SEA.cc, CW, CH, s / (SEA_K * kf), rings);
  // coarse cell (i, j) spans fine-grid columns (i - CW/2) * kf + FW/2 … + kf
  for (let j = 0; j < CH; j++) {
    const y0 = (j - CH / 2) * kf + FH / 2;
    if (y0 < 0 || y0 + kf > FH) continue;
    for (let i = 0; i < CW; i++) { const x0 = (i - CW / 2) * kf + FW / 2; if (x0 >= 0 && x0 + kf <= FW) c[j * CW + i] = 1e20; }
  }
  runSync(edt2d(c, CW, CH));
  const d = SEA.d && SEA.d.length === W * H ? SEA.d : new Float32Array(W * H);
  let dmax = 0;
  const cc = cell * kf, q = k => k >= 1e19 ? 1e9 : (Math.sqrt(k) - .5) * cc;
  for (let y = 0; y < H; y++) {
    // the fine cell's centre in coarse cell units (bilinear between coarse centres)
    const cy = ((y + SEA_PAD + .5 - FH / 2) / kf + CH / 2) - .5, j0 = clamp(Math.floor(cy), 0, CH - 2), fy = clamp(cy - j0, 0, 1);
    for (let x = 0; x < W; x++) {
      const fv = f[(y + SEA_PAD) * FW + x + SEA_PAD];
      let dd = fv === 0 ? 0 : (Math.sqrt(fv) - .5) * cell;
      if (fv > 0) {
        const cx = ((x + SEA_PAD + .5 - FW / 2) / kf + CW / 2) - .5, i0 = clamp(Math.floor(cx), 0, CW - 2), fx = clamp(cx - i0, 0, 1);
        const a = q(c[j0 * CW + i0]), b = q(c[j0 * CW + i0 + 1]), e = q(c[(j0 + 1) * CW + i0]), g2 = q(c[(j0 + 1) * CW + i0 + 1]);
        const dc = lerp(lerp(a, b, fx), lerp(e, g2, fx), fy);
        if (dc < dd) dd = dc;
      }
      d[y * W + x] = dd;
      if (dd > dmax) dmax = dd;
    }
  }
  Object.assign(SEA, { frame: frameNo, W, H, d, dmax });
  return d;
}
const seaGrid = () => [Math.ceil(cw / SEA_K) + 4, Math.ceil(ch / SEA_K) + 4];
function gridCanvas(o, W, H) {
  if (!o.c || o.c.width !== W || o.c.height !== H) { o.c = makeCanvas(W, H); o.g = o.c.getContext('2d'); o.img = o.g.createImageData(W, H); }
  return o;
}
// the sea-floor mask and the shallows: low-res canvases the ramps are written into
const DMASK = { c: null, g: null, img: null };
const DMASK_W = [34, 25, 18, 12, 7, 3.5];
// Both ramps are a function of the distance alone: tabulated per frame (premultiplied RGBA at steps of a quarter
// cell, interpolated), then looked up per cell. paint(d, out) composites the strokes covering distance d.
const LUT_MAX = 4096, LUT = { v: new Float32Array(4 * (LUT_MAX + 2)) };
function rampLut(hwMax, pw, paint) {
  const top = Math.min(SEA.dmax, hwMax + pw);
  let step = pw / 4, n = Math.ceil(top / step) + 1;
  if (n > LUT_MAX) { step = top / (LUT_MAX - 1); n = LUT_MAX; }
  const v = LUT.v, o = [0, 0, 0, 0];
  for (let i = 0; i <= n; i++) { paint(i * step, o); v[4 * i] = o[0]; v[4 * i + 1] = o[1]; v[4 * i + 2] = o[2]; v[4 * i + 3] = o[3]; }
  return { v, step, n };
}
function rampImage(img, d, L) {
  const px8 = img.data, v = L.v, inv = 1 / L.step, n = L.n;
  for (let p = 0, m = d.length; p < m; p++) {
    let f = d[p] * inv; if (f > n) f = n;
    const i = f | 0, t = f - i, a = 4 * i, b = a + 4, o = 4 * p;
    const A = v[a + 3] + (v[b + 3] - v[a + 3]) * t;
    if (A <= 0) { px8[o + 3] = 0; continue; }
    px8[o] = (v[a] + (v[b] - v[a]) * t) / A; px8[o + 1] = (v[a + 1] + (v[b + 1] - v[a + 1]) * t) / A; px8[o + 2] = (v[a + 2] + (v[b + 2] - v[a + 2]) * t) / A;
    px8[o + 3] = A * 255 + .5;
  }
}
// how much sea floor shows through: a smooth ramp from the waterline to ~30 m out (low-res, scaled up)
function depthMask(rings) {
  const [W, H] = seaGrid(), k = SEA_K, d = seaDistance(rings, W, H), pw = k / s;
  gridCanvas(DMASK, W, H);
  const hw = DMASK_W.map(capHalf);
  rampImage(DMASK.img, d, rampLut(hw[0], pw, (dd, o) => {
    let keep = 1;
    for (let j = 0; j < hw.length; j++) { const cov = clamp((hw[j] - dd) / pw + .5, 0, 1); if (cov <= 0) break; keep *= 1 - .26 * cov; }
    o[0] = o[1] = o[2] = 255 * (1 - keep); o[3] = 1 - keep;
  }));
  DMASK.g.putImageData(DMASK.img, 0, 0);
  return { c: DMASK.c, W, H, k };
}
// the depth ramp, drawn at a sixth of the resolution so the steps melt into one smooth gradient when scaled up
const SHALLOW = { c: null, g: null, img: null };
const SHALLOW_N = 28;
function drawShallows(rings) {
  const [W, H] = seaGrid(), k = SEA_K, d = seaDistance(rings, W, H), pw = k / s;
  gridCanvas(SHALLOW, W, H);
  const FARC = hexRgb('#134660'), NEAR = hexRgb('#22716c');
  const hw = new Float64Array(SHALLOW_N), cr = new Float64Array(SHALLOW_N), cg = new Float64Array(SHALLOW_N), cb = new Float64Array(SHALLOW_N), al = new Float64Array(SHALLOW_N);
  for (let i = 0; i < SHALLOW_N; i++) {
    const t = i / (SHALLOW_N - 1);
    hw[i] = capHalf(9000 * Math.pow(3 / 9000, t));
    cr[i] = Math.round(lerp(FARC[0], NEAR[0], t)); cg[i] = Math.round(lerp(FARC[1], NEAR[1], t)); cb[i] = Math.round(lerp(FARC[2], NEAR[2], t));
    al[i] = +(.045 + .13 * t).toFixed(3);
  }
  rampImage(SHALLOW.img, d, rampLut(hw[0], pw, (dp, o) => {
    // source-over, widest stroke first, premultiplied
    let A = 0, R = 0, G = 0, B = 0;
    for (let i = 0; i < SHALLOW_N; i++) {
      const cov = clamp((hw[i] - dp) / pw + .5, 0, 1); if (cov <= 0) break;
      const a = al[i] * cov, ia = 1 - a;
      R = R * ia + cr[i] * a; G = G * ia + cg[i] * a; B = B * ia + cb[i] * a; A = A * ia + a;
    }
    o[0] = R; o[1] = G; o[2] = B; o[3] = A;
  }));
  SHALLOW.g.putImageData(SHALLOW.img, 0, 0);
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(SHALLOW.c, cw / 2 - W / 2 * k, ch / 2 - H / 2 * k, W * k, H * k);
  ctx.restore();
}
// block-culled scatter near the coast: fn(x, y, a, b, d) for grid cells whose coast distance d is in [d0, d1]
function nearCoastCells(cell, d0, d1, k, fn, max = 4000) {
  const B = 4, blk = cell * B, reach = Math.max(Math.abs(d0), Math.abs(d1)) + blk;
  const bx0 = Math.floor(-hx / blk) - 1, bx1 = Math.floor(hx / blk) + 1, by0 = Math.floor(-hy / blk) - 1, by1 = Math.floor(hy / blk) + 1;
  if ((bx1 - bx0 + 1) * (by1 - by0 + 1) * B * B > max * 4) return;
  let n = 0;
  for (let bi = bx0; bi <= bx1; bi++) for (let bj = by0; bj <= by1; bj++) {
    const cx = (bi + .5) * blk, cy = (bj + .5) * blk;
    const dc = coastDist(cx, cy, reach);
    if (Number.isNaN(dc) || dc < d0 - blk || dc > d1 + blk) continue;
    for (let i = bi * B; i < bi * B + B; i++) for (let j = bj * B; j < bj * B + B; j++) {
      const a = hash(i, j, k + 2); if (a > .999) continue;
      const x = (i + hash(i, j, k)) * cell, y = (j + hash(i, j, k + 1)) * cell;
      if (!vis(x, y, cell * 2)) continue;
      const d = coastDist(x, y, Math.max(Math.abs(d0), Math.abs(d1)) + cell);
      if (Number.isNaN(d) || d < d0 || d > d1) continue;
      if (++n > max) return;
      fn(x, y, a, hash(i, j, k + 3), d, i, j);
    }
  }
}

function drawWorld(glOn) {
  if (BANDS.shore.isActive) drawShore(glOn);
  if (BANDS.kelp.isActive) drawFocal();
  drawCloseUp();
}

function drawShore(glOn) {
  const rings = coast.rings.map(r => r.pts);
  if (!glOn) {
    ctx.fillStyle = PAL.SEA_MID; ctx.fillRect(-hx - CV.m, -hy - CV.m, 2 * (hx + CV.m), 2 * (hy + CV.m));
    ringsPath(rings); ctx.fillStyle = '#1c3320'; ctx.fill('nonzero');
  }
  // ---- the sea ----
  ctx.save();
  seaPath(); ctx.clip('evenodd');
  ctx.fillStyle = PAL.SEA_DEEP; ctx.fillRect(-hx - CV.m, -hy - CV.m, 2 * (hx + CV.m), 2 * (hy + CV.m));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  drawShallows(rings);
  // the sea floor through the shallows, with the sun's caustic net on it, fading smoothly with depth
  if (z < 2.9) {
    const A = sstep(2.9, 2.4, z);
    const g = layer();
    g.fillStyle = layerPat('seabed', 5); g.fillRect(-cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4);
    g.globalCompositeOperation = 'lighter';
    for (const [tile, rot, vx, vy, a] of [[.9, .3, .06, .025, .17], [.55, 1.2, -.04, .05, .12]]) {
      const pat = layerPat('caustic', tile, rot), k2 = tile * s;
      pat.setTransform(new DOMMatrix([Math.cos(rot) * k2 / 512, Math.sin(rot) * k2 / 512, -Math.sin(rot) * k2 / 512, Math.cos(rot) * k2 / 512, (T * vx * s) % k2, (T * vy * s) % k2]));
      g.globalAlpha = a; g.fillStyle = pat; g.fillRect(-cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    g.setTransform(1, 0, 0, 1, 0, 0);
    const m = depthMask(rings);
    g.imageSmoothingQuality = 'high'; g.drawImage(m.c, (cw / 2 - m.W / 2 * m.k) * dpr, (ch / 2 - m.H / 2 * m.k) * dpr, m.W * m.k * dpr, m.H * m.k * dpr);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = A * .42; ctx.drawImage(LAYER.c, 0, 0); ctx.restore();
  }
  drawKelpBeds();
  // the swell: long soft crests some tens of metres apart, drifting shoreward
  const swA = sstep(3.4, 2.9, z) * sstep(-.2, .6, z);
  if (swA > 0) { ctx.globalAlpha = 1; viewPat('swell', 90, .35 * swA, .15, 0, (T * 1.6) % 90, 'soft-light'); }
  // wind ripples and sun glints, at their true size (a few metres), gone once they are sub-pixel
  const rw = 16, rA = sstep(70, 240, rw * s);
  if (rA > 0) {
    const drift = T * .5;
    ctx.globalAlpha = 1;
    viewPat('ripple', rw, .8 * rA, .4, drift, drift * .6, 'soft-light');
    viewPat('ripple', rw * .37, .5 * rA, 1.9, -drift * .6, drift * .8, 'soft-light');
    const tw = .5 + .5 * Math.sin(T * 2.1);
    viewPat('glint', 9, .45 * tw * rA, 0, -drift * .7, drift * .4, 'lighter');
    viewPat('glint', 9, .45 * (1 - tw) * rA, 1.3, drift * .5, -drift * .3, 'lighter');
  }
  drawSurf();
  ctx.restore();

  // ---- the land's edge ----
  ctx.save();
  ringsPath(rings); ctx.clip('nonzero');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the forest's shadow on the upper shore, then the bare rock band and its zones
  strokeNearPath(rings, ZONE.band + 4); ctx.lineWidth = 2 * (ZONE.band + 4); ctx.strokeStyle = 'rgba(6,12,6,.55)'; ctx.stroke();
  strokeNearPath(rings, ZONE.band + 1.5); ctx.lineWidth = 2 * (ZONE.band + 1.5); ctx.strokeStyle = 'rgba(18,26,14,.5)'; ctx.stroke();
  if (ZONE.band * s < 3) {
    const bw = Math.max(2 * ZONE.band, px(1.6));
    strokeNearPath(rings, bw / 2); ctx.lineWidth = bw; ctx.strokeStyle = '#8d887b'; ctx.stroke();
  } else {
    // each zone reaches up the shore a distance that wanders with the rock (two noise octaves); a zone's band is the
    // ring and its offset copy (even-odd), built once a frame and used as a clip, so each layer on it is a plain rect
    const reach = (D, k) => (x, y) => -D * (1 + .5 * (vnoise(x / 38, y / 38, k) - .5) * 2 + .22 * (vnoise(x / 7, y / 7, k + 1) - .5) * 2);
    const offs = {};
    const off = (D, k) => offs[k] || (offs[k] = offsetRings(reach(D, k), 3));
    const band = (D, k) => { const o = off(D, k); ringsPath(rings); for (const q of o) { ctx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]); ctx.closePath(); } };
    // the band's extent in the view: the coast near it, out to the farthest the zone can reach (1.72 D)
    const bandBox = D => {
      const e = D * 1.72, segs = coast.segs, n = segs.length / 5;
      let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
      for (let i = 0; i < n; i++) {
        const ax = segs[5 * i], ay = segs[5 * i + 1], bx = segs[5 * i + 2], by = segs[5 * i + 3];
        if (Math.max(ax, bx) < -hx - e || Math.min(ax, bx) > hx + e || Math.max(ay, by) < -hy - e || Math.min(ay, by) > hy + e) continue;
        x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
      }
      return x1 < x0 ? [0, 0, 0, 0] : [x0 - e, y0 - e, x1 + e, y1 + e];
    };
    const inBand = (D, k, fn) => {
      const box = bandBox(D), r = viewRect(box);
      if (!r) return;
      ctx.save(); band(D, k); ctx.clip('evenodd');
      ctx.beginPath(); ctx.rect(r[0] / s, r[1] / s, r[2] / s, r[3] / s);
      fn(box); ctx.restore();
    };
    inBand(ZONE.band, 401, () => {
      ctx.fillStyle = PAL.ROCK_BASE; ctx.fill();
      fillOct('rock', 8, 1, undefined, 700);
      fillOct('rock', 30, .35, undefined, 1400);
    });
    // the forest's edge throws its shade down onto the rock
    const edge = off(ZONE.band, 401);
    strokeNearPath(edge, 3.5); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,14,6,.4)'; ctx.stroke();
    strokeNearPath(edge, 1.5); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,14,6,.35)'; ctx.stroke();
    inBand(ZONE.lichen, 411, () => fillOct('lichenBlack', 10, .65, undefined, 900));
    inBand(ZONE.barnacle, 421, box => { ctx.fillStyle = 'rgba(40,36,30,.18)'; ctx.fill(); zoneFill('barnacle', .95, undefined, true, box); });
    inBand(ZONE.mussel, 431, box => zoneFill('mussel', .7, undefined, true, box));
    inBand(ZONE.rockweed, 441, box => zoneFill('rockweed', .95, undefined, true, box));
    inBand(ZONE.low, 451, box => zoneFill('lowzone', .95, undefined, true, box));
    // wet rock at the waterline
    strokeNearPath(rings, .5); ctx.lineWidth = 2 * .5; ctx.strokeStyle = 'rgba(30,34,32,.45)'; ctx.stroke();
  }
  drawBeaches();
  if (z < 2.9) drawPools();
  if (z < 2.6) drawDriftwood();
  ctx.restore();
  if (z < 2.45) drawBoulders();
}

// sand coves where a slow noise says so, never near the focus (the scene there is rock)
function drawBeaches() {
  const lines = [];
  for (const R of coast.rings) {
    const p = R.pts, n = p.length / 2;
    let open = null;
    for (let i = 0; i < n; i++) {
      const x = p[2 * i], y = p[2 * i + 1];
      const beach = vnoise(x / 520 + 11.3, y / 520 + 4.1, 131) * .75 + vnoise(x / 130, y / 130, 133) * .25 > .66 && Math.hypot(x, y) > 350;
      if (beach) { if (!open) lines.push(open = []); open.push(x, y); }
      else open = null;
    }
  }
  if (!lines.length) return;
  const at = w => strokeNearPath(lines, w, false);
  at(11); ctx.lineWidth = 2 * 11; ctx.strokeStyle = PAL.SAND_BASE; ctx.stroke();
  if (11 * s > 4) strokeOct('sand', 2, 2 * 11, 1);
  ctx.lineWidth = 2 * 11; ctx.strokeStyle = 'rgba(60,44,20,.18)'; ctx.stroke();
  // drift line and wet sand
  at(3); ctx.lineWidth = 2 * 3; ctx.strokeStyle = rgba(PAL.SAND_WET, .75); ctx.stroke();
  at(1); ctx.lineWidth = 2 * 1; ctx.strokeStyle = 'rgba(60,52,40,.35)'; ctx.stroke();
}

const SURF_DASH = [5, 1.6, 9, 3, 3, 1.2, 7, 2.2], SURF_DASH_PERIOD = SURF_DASH.reduce((a, b) => a + b);
function drawSurf() {
  if (z > 3.6) {
    // far out: a bright rim of surf along the coast
    ringsPath(coast.rings.map(r => r.pts));
    ctx.lineWidth = Math.max(px(2.4), 8); ctx.strokeStyle = rgba(PAL.FOAM, .45 * sstep(4.8, 4.3, z)); ctx.stroke();
    return;
  }
  const W = [];
  const period = 9;
  for (let k = 0; k < 4; k++) {
    const ph = ((T / period + k / 4) % 1 + 1) % 1;
    const d = 1.2 + 30 * Math.pow(1 - ph, 1.25);
    W.push({ d, a: Math.pow(Math.sin(ph * Math.PI), .8) * (.25 + .6 * ph), w: .16 + .75 * ph * ph, k });
  }
  for (const wv of W) {
    if (wv.w * s < .5) continue;
    // each breaker wanders in and out along the shore, so the lines are never parallel
    const o = offsetRings((x, y) => wv.d * (1 + .35 * (vnoise(x / 22 + wv.k * 3.1, y / 22, 471) - .5) * 2), 3 + Math.round(wv.d / 6));
    strokeNearPath(o, wv.w * 1.6, true, wv.w * .9);
    ctx.lineWidth = wv.w * 3.2; ctx.strokeStyle = rgba(PAL.FOAM, wv.a * .1); ctx.stroke();
    ctx.setLineDash(SURF_DASH);
    strokeNearDashed(o, wv.w * .9, wv.k * 11 + T * .4, SURF_DASH_PERIOD, () => {
      ctx.lineWidth = wv.w * .45; ctx.strokeStyle = rgba(PAL.FOAM, wv.a * .6); ctx.stroke();
      strokeTrue('foam', 2.4, wv.w * 1.8, Math.min(1, wv.a * 1.3));
    });
    ctx.setLineDash([]);
  }
  // the swash: foam lace hugging the waterline
  const sw = offsetRings(.45 + .25 * Math.sin(T * 2 * Math.PI / period), 2);
  strokeNearPath(sw, Math.max(.6, px(1.2)), true, Math.max(.15, px(.6)));
  strokeTrue('foam', 1.3, Math.max(.3, px(1.2)), .9);
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(PAL.FOAM, .12); ctx.stroke();
}

// ---- kelp beds offshore ----
function kelpBeds() {
  const beds = [];
  for (const [x, y, r] of KELP_PATCHES) beds.push({ x, y, r, seed: Math.round(x * 7 + y) });
  if (z < 3.8) {
    const cell = 150;
    const x0 = Math.floor(-hx / cell) - 1, x1 = Math.floor(hx / cell) + 1, y0 = Math.floor(-hy / cell) - 1, y1 = Math.floor(hy / cell) + 1;
    if ((x1 - x0) * (y1 - y0) < 900) for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      if (hash(i, j, 141) > .5) continue;
      const x = (i + hash(i, j, 142)) * cell, y = (j + hash(i, j, 143)) * cell;
      if (Math.hypot(x, y) < 1200) continue; // near the focus the fixed beds rule
      beds.push({ x, y, r: 22 + hash(i, j, 144) * 50, seed: i * 31 + j });
    }
  }
  return beds.filter(b => {
    if (!vis(b.x, b.y, b.r * 1.6)) return false;
    const d = coastDist(b.x, b.y, 400);
    return !Number.isNaN(d) && d < -b.r * .5 - 10 && d > -380;
  });
}
function bedPath(b) {
  ctx.beginPath();
  for (let k = 0; k < 13; k++) {
    const a = hash(k, b.seed, 151) * 6.28, rr = b.r * (.2 + hash(k, b.seed, 152) * .35), dd = hash(k, b.seed, 153) * .75;
    const cx = b.x + Math.cos(a) * b.r * dd, cy = b.y + Math.sin(a) * b.r * dd * .6;
    ctx.moveTo(cx + rr * 1.3, cy); ctx.ellipse(cx, cy, rr * 1.3, rr * .8, .5, 0, 7);
  }
}
function drawKelpBeds() {
  if (z > 4.1) return;
  const A = sstep(4.1, 3.6, z);
  for (const b of kelpBeds()) {
    bedPath(b);
    ctx.fillStyle = `rgba(60,48,20,${.22 * A})`; ctx.fill();
    ctx.lineWidth = b.r * .15; ctx.strokeStyle = `rgba(60,48,20,${.1 * A})`; ctx.stroke();
    ctx.save(); ctx.clip();
    const near = sstep(40, 90, 24 * s);
    if (near < 1) { bedPath(b); fillTrue('kelpbedFar', 150, .9 * A * (1 - near)); }
    if (near > 0) { bedPath(b); fillTrue('kelpbed', 24, .95 * A * near); }
    ctx.restore();
    if (z < 2.3) kelpPlants(b);
  }
}
// single plants in a bed: bulb and a sheaf of blades streaming down-current, swaying
function kelpPlants(b) {
  const cell = 2.4, A = sstep(2.3, 1.9, z);
  const i0 = Math.floor((b.x - b.r * 1.4) / cell), i1 = Math.floor((b.x + b.r * 1.4) / cell);
  const j0 = Math.floor((b.y - b.r) / cell), j1 = Math.floor((b.y + b.r) / cell);
  if ((i1 - i0) * (j1 - j0) > 2500) return;
  ctx.lineCap = 'round';
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    if (hash(i, j, 161) > .6) continue;
    const x = (i + hash(i, j, 162)) * cell, y = (j + hash(i, j, 163)) * cell;
    if (Math.hypot((x - b.x) / 1.3, (y - b.y) / .8) > b.r * .8 || !vis(x, y, 3)) continue;
    const sway = Math.sin(T * .8 + i * .7 + j * 1.3) * .12;
    ctx.globalAlpha = A;
    for (let k = 0; k < 6; k++) {
      const a = .5 + sway + (k - 2.5) * .11 + (hash(i, j, 164 + k) - .5) * .2, L = 1.2 + hash(i, j, 170 + k) * 1.8;
      ctx.strokeStyle = k % 2 ? '#7a5d22' : '#937030'; ctx.lineWidth = .11;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * L * .5 + .15, y + Math.sin(a) * L * .5 - .1, x + Math.cos(a + sway) * L, y + Math.sin(a + sway) * L); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,14,4,.5)'; ctx.beginPath(); ctx.arc(x + .03, y + .04, .075, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x - .025, y - .03, .005, x, y, .065);
    g.addColorStop(0, PAL.KELP_GLOW); g.addColorStop(.6, PAL.KELP_BASE); g.addColorStop(1, PAL.KELP_DARK);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, .065, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- tide pools ----
function poolShape(x, y, r, seed, sq = .65) {
  ctx.beginPath();
  const n = 12, P = [];
  for (let k = 0; k < n; k++) { const a = k / n * 6.2832, rr = r * (.78 + .36 * hash(seed, k, 181)); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq]); }
  for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; k ? ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]) : ctx.moveTo(m[0], m[1]); }
  const a = P[0], b = P[1]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  ctx.closePath();
}
function pool(x, y, r, seed, sq) {
  if (r * s < 1.2) return;
  // wet rim, pink crust, the water with the sky's reflection
  poolShape(x, y, r * 1.12, seed, sq); ctx.fillStyle = 'rgba(28,30,28,.55)'; ctx.fill();
  poolShape(x, y, r * 1.04, seed, sq); ctx.fillStyle = rgba(PAL.CORALLINE, .75); ctx.fill();
  poolShape(x, y, r, seed, sq);
  const g = ctx.createRadialGradient(x - r * .15, y - r * .1, r * .05, x, y, r);
  g.addColorStop(0, '#0d3f4a'); g.addColorStop(.7, '#1b5d63'); g.addColorStop(1, '#3a8584');
  ctx.fillStyle = g; ctx.fill();
  if (r * s > 25) {
    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = patXf(tex('rock').pat, 512, r * 1.6); ctx.globalAlpha = .45; ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // sea lettuce and anemones on the bottom
    for (let k = 0; k < 9; k++) {
      const ax = x + (hash(seed, k, 191) - .5) * r * 1.3, ay = y + (hash(seed, k, 192) - .5) * r * sq * 1.2, ar = r * (.03 + hash(seed, k, 193) * .05);
      if (k < 4) { ctx.fillStyle = 'rgba(90,170,80,.55)'; ctx.beginPath(); ctx.ellipse(ax, ay, ar * 2.4, ar * 1.3, k, 0, 7); ctx.fill(); }
      else {
        ctx.fillStyle = 'rgba(70,150,110,.7)'; ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(150,220,170,.6)'; ctx.lineWidth = ar * .18;
        for (let t = 0; t < 12; t++) { const a = t / 12 * 6.28; ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * ar * .5, ay + Math.sin(a) * ar * .5); ctx.lineTo(ax + Math.cos(a) * ar * 1.25, ay + Math.sin(a) * ar * 1.25); ctx.stroke(); }
      }
    }
    // sky in the surface, and a glint that breathes
    const sk = ctx.createLinearGradient(x - r, y - r, x + r * .2, y + r * .4);
    sk.addColorStop(0, 'rgba(200,235,240,.32)'); sk.addColorStop(.5, 'rgba(200,235,240,.06)'); sk.addColorStop(1, 'rgba(200,235,240,0)');
    ctx.fillStyle = sk; ctx.fillRect(x - r * 1.2, y - r, r * 2.4, r * 2);
    ctx.restore();
  }
  poolShape(x, y, r, seed, sq); ctx.strokeStyle = 'rgba(215,240,240,.5)'; ctx.lineWidth = Math.max(px(1), r * .02); ctx.stroke();
  const gl = .5 + .5 * Math.sin(T * 1.7 + seed);
  ctx.fillStyle = `rgba(255,255,245,${.55 * gl})`; ctx.beginPath(); ctx.ellipse(x - r * .45, y - r * .3 * sq, r * .09, r * .035, -.5, 0, 7); ctx.fill();
}
function drawPools() {
  const A = sstep(2.9, 2.5, z);
  ctx.globalAlpha = A;
  nearCoastCells(7, 1.8, 10, 201, (x, y, a, b, d, i, j) => {
    if (a > .3) return;
    if (Math.hypot(x - FOCAL_ROCK.x, y - FOCAL_ROCK.y) < 4 || Math.hypot(x - FIXED_POOL.x, y - FIXED_POOL.y) < 6) return;
    ctx.globalAlpha = A;
    pool(x, y, .5 + b * b * 2.6, i * 131 + j, .5 + a);
  }, 1500);
  ctx.globalAlpha = A;
  pool(FIXED_POOL.x, FIXED_POOL.y, FIXED_POOL.rx, 77, FIXED_POOL.ry / FIXED_POOL.rx);
  ctx.globalAlpha = 1;
}

// ---- driftwood on the upper shore ----
function drawDriftwood() {
  const A = sstep(2.6, 2.25, z);
  nearCoastCells(40, ZONE.band - 5, ZONE.band - 1, 211, (x, y, a, b) => {
    if (a > .5) return;
    const gx = coastDist(x + 1, y, 30) - coastDist(x - 1, y, 30), gy = coastDist(x, y + 1, 30) - coastDist(x, y - 1, 30);
    const ang = Math.atan2(gy, gx) + Math.PI / 2 + (b - .5) * .5;
    const L = 3 + b * 9, W = .35 + a * .9;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = A;
    ctx.fillStyle = 'rgba(10,10,8,.4)'; ctx.beginPath(); ctx.ellipse(W * .35, W * .5, L / 2, W * .62, 0, 0, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
    g.addColorStop(0, PAL.DRIFT_LIGHT); g.addColorStop(.45, PAL.DRIFT_BASE); g.addColorStop(1, PAL.DRIFT_DARK);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, W / 2); ctx.fill();
    if (W * s > 6) {
      ctx.strokeStyle = 'rgba(90,82,70,.5)'; ctx.lineWidth = Math.max(px(.8), W * .03);
      for (let k = 0; k < 5; k++) { const yy = (k / 4 - .5) * W * .7; ctx.beginPath(); ctx.moveTo(-L / 2 + W * .4, yy); ctx.bezierCurveTo(-L / 6, yy + W * .06, L / 6, yy - W * .06, L / 2 - W * .4, yy); ctx.stroke(); }
      ctx.fillStyle = '#c9c1b0'; ctx.beginPath(); ctx.ellipse(L / 2 - W * .12, 0, W * .12, W * .48, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(110,100,86,.8)'; ctx.beginPath(); ctx.ellipse(L / 2 - W * .12, 0, W * .06, W * .26, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }, 400);
  ctx.globalAlpha = 1;
}

// ---- boulders ----
function rockPath(x, y, r, seed, sq = .84) {
  const n = 24, P = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * 6.2832, big = hash(seed, Math.floor(k / 2), 5), nb = hash(seed, Math.floor(k / 2) + 1, 5), f = (k % 2) / 2;
    const rr = r * (.84 + .26 * lerp(big, nb, f) + .05 * (hash(seed, k, 6) - .5));
    P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq]);
  }
  ctx.beginPath();
  for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; k ? ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]) : ctx.moveTo(m[0], m[1]); }
  const a = P[0], b = P[1]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  ctx.closePath();
}
// d: height up the shore (metres from the waterline): wet and weedy low, barnacled mid, lichened high
function boulder(x, y, r, seed, d, detail = 1) {
  if (!vis(x, y, r * 1.5) || r * s < 1.5) return;
  const sq = .8 + hash(seed, 1, 9) * .1;
  // ground contact: a soft shadow cast to the bottom-right (the light is top-left)
  rockPath(x + r * .12, y + r * .16, r * 1.02, seed, sq); ctx.fillStyle = 'rgba(8,8,6,.22)'; ctx.fill();
  rockPath(x + r * .05, y + r * .07, r * 1.0, seed, sq); ctx.fillStyle = 'rgba(8,8,6,.3)'; ctx.fill();
  rockPath(x, y, r, seed, sq);
  const wet = sstep(4, 0, d), green = seed === 999 || hash(seed, 3, 9) < .45;
  // two stones of this shore: dark greenstone and pale diorite
  const RAMP = green ? ['#8d958a', '#535b52', '#20251e'] : ['#b3ad9e', PAL.ROCK_BASE, '#4a463f'];
  const g = ctx.createRadialGradient(x - r * .38, y - r * .42, r * .08, x + r * .05, y + r * .05, r * 1.08);
  g.addColorStop(0, RAMP[0]); g.addColorStop(.55, RAMP[1]); g.addColorStop(1, RAMP[2]);
  ctx.fillStyle = g; ctx.fill();
  if (wet > 0) { ctx.fillStyle = `rgba(14,16,14,${.3 * wet})`; ctx.fill(); }
  if (r * s > 14) {
    ctx.save(); ctx.clip();
    if (green) ctx.globalCompositeOperation = 'overlay';
    fillOct('rock', r * 3, green ? .55 : .42, undefined, 380);
    ctx.globalCompositeOperation = 'source-over';
    // crystals: dark mafic grains and pale feldspar, fine at every scale
    fillOct('grain', r * .8, green ? .5 : .4, undefined, 260);
    // joints: a few fractures across the stone, dark with a lit lower lip
    if (r * s > 120) for (let k = 0; k < 2; k++) {
      const a0 = hash(seed, k, 241) * 3.14, ox0 = (hash(seed, k, 242) - .5) * r, oy0 = (hash(seed, k, 243) - .5) * r * sq;
      ctx.beginPath();
      const len = r * (.35 + hash(seed, k, 244) * .5);
      for (let t = -1; t <= 1.001; t += .08) { const w = (vnoise(t * 3 + k * 5, seed, 245) - .5) * r * .12; const px0 = x + ox0 + Math.cos(a0) * t * len - Math.sin(a0) * w, py0 = y + oy0 + Math.sin(a0) * t * len + Math.cos(a0) * w; t > -1 ? ctx.lineTo(px0, py0) : ctx.moveTo(px0, py0); }
      ctx.strokeStyle = 'rgba(8,8,6,.4)'; ctx.lineWidth = Math.max(px(1.2), r * .008); ctx.stroke();
    }
    // zone cover on the stone: barnacles mid-shore, rockweed and pink crust low
    // cover by height up the shore: a barnacle mosaic on the stone, a weed skirt low down, pink crust at the foot
    const near = detail > 1;
    // each cover is an ellipse inside the stone's clip: its fills stay within the stone's box
    const box = [x - r * 1.15, y - r * 1.15, x + r * 1.15, y + r * 1.15];
    if (d < 11 && near) { ctx.beginPath(); ctx.ellipse(x + r * .05, y + r * .2, r * 1.05, r * .7 * sq, 0, 0, 7); zoneFill('barnacle', .6, undefined, near, box); }
    if (d < 5) { ctx.beginPath(); ctx.ellipse(x + r * .05, y + r * .85, r * 1.12, r * .45 * sq, 0, 0, 7); zoneFill('rockweed', .92, undefined, near, box); }
    if (d < 1.6) { ctx.beginPath(); ctx.ellipse(x, y + r * .98, r * 1.0, r * .28, 0, 0, 7); zoneFill('lowzone', .85, undefined, near, box); }
    if (d > 9 && r * s > 30) {
      for (let k = 0; k < 7; k++) { const a = hash(seed, k, 221) * 6.28, rr = r * (.1 + hash(seed, k, 222) * .45), lr = r * (.06 + hash(seed, k, 223) * .12);
        ctx.fillStyle = k % 3 ? rgba(PAL.LICHEN_ORANGE, .7) : rgba(PAL.LICHEN_GREY, .6); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq - r * .2, lr, lr * .8, a, 0, 7); ctx.fill(); }
    }
    // volume: a dark pool low-right, then the wet sheen
    rockPath(x, y, r, seed, sq);
    const sh = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .35, x, y, r * 1.1);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.6, 'rgba(10,10,8,.16)'); sh.addColorStop(1, 'rgba(10,10,8,.45)'); ctx.fillStyle = sh; ctx.fill();
    const lp = ctx.createRadialGradient(x - r * .4, y - r * .45, 0, x - r * .4, y - r * .45, r * .9);
    lp.addColorStop(0, 'rgba(255,250,235,.22)'); lp.addColorStop(1, 'rgba(255,250,235,0)'); ctx.fillStyle = lp; ctx.fill();
    if (wet > 0) {
      const sp = ctx.createRadialGradient(x - r * .42, y - r * .46, 0, x - r * .42, y - r * .46, r * .45);
      sp.addColorStop(0, `rgba(255,255,250,${.5 * wet})`); sp.addColorStop(.3, `rgba(230,240,240,${.18 * wet})`); sp.addColorStop(1, 'rgba(230,240,240,0)');
      ctx.fillStyle = sp; ctx.fill();
    }
    ctx.restore();
  }
  // rim light on the lit side
  rockPath(x, y, r, seed, sq);
  ctx.save(); ctx.clip();
  const rl = ctx.createLinearGradient(x - r, y - r, x + r * .3, y + r * .3);
  rl.addColorStop(0, 'rgba(240,236,224,.5)'); rl.addColorStop(1, 'rgba(240,236,224,0)');
  ctx.strokeStyle = rl; ctx.lineWidth = Math.max(px(1.5), r * .06); ctx.stroke();
  ctx.restore();
  // in the water: a foam collar at the waterline
  if (d < .6 || detail > 1) {
    ctx.save(); seaPath(); ctx.clip('evenodd');
    // the part of the stone below the waterline, seen through the sea
    rockPath(x, y, r, seed, sq); ctx.fillStyle = 'rgba(28,104,104,.38)'; ctx.fill();
    ctx.save(); ctx.clip(); viewPat('caustic', .7, .1, .3, T * .05, T * .02, 'lighter', viewRect([x - r * 1.1, y - r * 1.1, x + r * 1.1, y + r * 1.1])); ctx.restore();
    rockPath(x, y, r * 1.08, seed, sq);
    ctx.lineWidth = r * .22; ctx.strokeStyle = rgba(PAL.FOAM, .1); ctx.stroke();
    rockPath(x, y, r * 1.05, seed, sq);
    strokeTrue('foam', 1.3, Math.max(px(1.5), Math.min(r * .12, .14)), .75 + .2 * Math.sin(T * 1.4 + seed));
    ctx.restore();
  }
}
function drawBoulders() {
  const A = sstep(2.45, 2.15, z);
  ctx.globalAlpha = A;
  const list = [];
  nearCoastCells(4.2, -5, ZONE.band - 2, 231, (x, y, a, b, d, i, j) => {
    const p = d < 0 ? .25 : d < 6 ? .55 : .35;
    if (a > p) return;
    if (Math.hypot(x - FOCAL_ROCK.x, y - FOCAL_ROCK.y) < 3.6 || Math.hypot((x - FIXED_POOL.x) / 1.3, y - FIXED_POOL.y) < 5) return;
    list.push([x, y, .35 + b * b * 1.4, i * 7 + j, d]);
  }, 2500);
  list.sort((p, q) => p[1] - q[1]);
  for (const [x, y, r, seed, d] of list) { ctx.globalAlpha = A; boulder(x, y, r, seed, d); }
  ctx.globalAlpha = 1;
}

// ---------- the boulder and the bull kelp (z 2.4 → -2.4; ticket #802) ----------
const BULB = { x: .9, y: .45, r: .065 };
const BLADE_PTS = [
  [[.9, .45], [.45, .2], [0, 0], [-.8, -.35], [-1.6, -.75], [-2.2, -1.1]],
  [[.9, .45], [.5, .05], [.05, -.35], [-.6, -.9], [-1.1, -1.6]],
  [[.9, .45], [.55, .35], [-.1, .45], [-.9, .4], [-1.8, .55]],
  [[.9, .45], [.7, -.1], [.55, -.7], [.3, -1.4], [.2, -2.0]],
  [[.9, .45], [.35, .55], [-.4, .9], [-1.2, 1.15]],
];
const STIPE_PTS = [[11.5, 13.5], [8.2, 9.4], [6.2, 7.0], [4.6, 5.2], [3.4, 3.1], [2.2, 1.6], [1.4, .8], [.9, .45]];
const DROP = { x: .0014, y: .0009, r: .0025 };
const BLADE_W = .11;
// blade 0 runs through the focus; its direction there orients every close-up
const BLADE_ANG = Math.atan2(-.2, -.45);

// Catmull-Rom samples every `step` metres: position, unit tangent, arc length
function spline(pts, step) {
  const out = [];
  let u = 0, px0 = pts[0][0], py0 = pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(L / step));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const x = f(p0[0], p1[0], p2[0], p3[0]), y = f(p0[1], p1[1], p2[1], p3[1]);
      u += Math.hypot(x - px0, y - py0); px0 = x; py0 = y;
      out.push({ x, y, u, tx: 0, ty: 0 });
    }
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; out[i].tx = (b.x - a.x) / l; out[i].ty = (b.y - a.y) / l;
  }
  return out;
}
// a blade: ruffled margins (the bull kelp's wavy edge), narrow at the bulb, tapering at the tip
const BLADES = BLADE_PTS.map((pts, bi) => {
  const S = spline(pts, .003), Lt = S[S.length - 1].u;
  const w0 = bi === 0 ? BLADE_W : BLADE_W * (.85 + .1 * bi % 3);
  for (const p of S) {
    const taper = (.25 + .75 * sstep(0, .35, p.u)) * (1 - .85 * sstep(Lt - .5, Lt, p.u));
    // ruffled margins: three incommensurate waves and a little noise, different on each side
    const ruf = k => 1 + .055 * Math.sin(p.u / .045 * 6.283 + bi * 1.7 + k * 2.1) + .045 * Math.sin(p.u / .071 * 6.283 + bi * 2.3 + k * 4.4)
      + .03 * Math.sin(p.u / .16 * 6.283 + k + bi) + .05 * (vnoise(p.u / .018, bi * 7 + k * 3, 551) - .5);
    p.hwL = w0 / 2 * taper * ruf(0);
    p.hwR = w0 / 2 * taper * ruf(1);
  }
  return { S, Lt, bi };
});
const STIPE = (() => { const S = spline(STIPE_PTS, .01), Lt = S[S.length - 1].u; for (const p of S) p.hwL = p.hwR = .006 + .012 * sstep(Lt - 3, Lt, p.u); return { S, Lt }; })();
function ribbonPath(R) {
  const S = R.S;
  ctx.beginPath();
  // only the stretch near the view needs full resolution
  const pad = Math.max(hx, hy) * 1.5 + .06;
  let started = false, i0 = -1, i1 = -1;
  for (let i = 0; i < S.length; i++) if (Math.abs(S[i].x) < pad + .06 && Math.abs(S[i].y) < pad + .06) { if (i0 < 0) i0 = i; i1 = i; }
  const stepOf = i => (i >= i0 - 2 && i <= i1 + 2) ? 1 : 12;
  for (let i = 0; i < S.length; i += stepOf(i)) { const p = S[i]; const X = p.x - p.ty * p.hwL, Y = p.y + p.tx * p.hwL; started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), started = true); }
  const e = S[S.length - 1]; ctx.lineTo(e.x, e.y);
  for (let i = S.length - 1; i >= 0; i -= stepOf(i)) { const p = S[i]; ctx.lineTo(p.x + p.ty * p.hwR, p.y - p.tx * p.hwR); }
  ctx.closePath();
}
function edgePath(R, side, inset = 0) {
  const S = R.S, pad = Math.max(hx, hy) * 1.5 + .06;
  ctx.beginPath(); let on = false;
  for (const p of S) {
    if (Math.abs(p.x) > pad || Math.abs(p.y) > pad) { on = false; continue; }
    const hw = (side < 0 ? p.hwL : p.hwR) - inset;
    const ex = side < 0 ? p.x - p.ty * hw : p.x + p.ty * hw, ey = side < 0 ? p.y + p.tx * hw : p.y - p.tx * hw;
    on ? ctx.lineTo(ex, ey) : (ctx.moveTo(ex, ey), on = true);
  }
}
function ruffles(R, crest) {
  const S = R.S, pad = Math.max(hx, hy) * 1.5 + .06, half = .045 / 2;
  ctx.beginPath();
  let next = 0;
  for (const p of S) {
    if (p.u < next) continue;
    const k = Math.floor(p.u / half); next = (k + 1) * half;
    if ((k & 1) !== crest || Math.abs(p.x) > pad || Math.abs(p.y) > pad) continue;
    for (const side of [-1, 1]) {
      const hw = side < 0 ? p.hwL : p.hwR, nx = side < 0 ? -p.ty : p.ty, ny = side < 0 ? p.tx : -p.tx;
      const ex = p.x + nx * hw * .97, ey = p.y + ny * hw * .97, ix = p.x + nx * hw * .66, iy = p.y + ny * hw * .66;
      ctx.moveTo(ex, ey); ctx.quadraticCurveTo(lerp(ex, ix, .5) + p.tx * half * .3, lerp(ey, iy, .5) + p.ty * half * .3, ix, iy);
    }
  }
}
function midPath(R, off = 0) {
  const S = R.S, pad = Math.max(hx, hy) * 1.5 + .06;
  ctx.beginPath(); let on = false;
  for (const p of S) { if (Math.abs(p.x) > pad || Math.abs(p.y) > pad) { on = false; continue; } const X = p.x - p.ty * off, Y = p.y + p.tx * off; on ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), on = true); }
}

// the blade's surface: long wrinkles, mottling and a wet sheen, lying in the blade's own direction
function bladeSurface(R, alpha) {
  fillOct('blade', .4, .55 * alpha, undefined, 420, BLADE_ANG);
}
function drawBlade(R) {
  const lod = BLADE_W * s;
  if (lod < 1.5) return;
  // shade on the rock, cast down-right
  ctx.save(); ctx.translate(.014, .018); ribbonPath(R); ctx.fillStyle = 'rgba(10,8,4,.32)'; ctx.fill(); ctx.restore();
  ribbonPath(R);
  ctx.fillStyle = R.bi % 2 ? '#80622a' : PAL.KELP_BASE; ctx.globalAlpha = .96; ctx.fill(); ctx.globalAlpha = 1;
  if (lod > 8) {
    ctx.save(); ribbonPath(R); ctx.clip();
    bladeSurface(R, 1);
    // the ruffles: soft folds running in from each margin, lit on the crests, shaded in the troughs
    ctx.lineCap = 'round';
    if (.045 * s > 36) for (const crest of [0, 1]) {
      ruffles(R, crest);
      ctx.lineWidth = .045 * .3; ctx.strokeStyle = crest ? 'rgba(40,24,4,.13)' : 'rgba(240,206,130,.12)'; ctx.stroke();
    }
    // translucent midline glow and the wet sheen offset toward the light
    midPath(R); ctx.lineWidth = BLADE_W * .34; ctx.strokeStyle = 'rgba(214,170,84,.2)'; ctx.stroke();
    midPath(R, BLADE_W * .12); ctx.lineWidth = BLADE_W * .07; ctx.strokeStyle = 'rgba(255,246,220,.14)'; ctx.stroke();
    ctx.restore();
  }
  // margins: a thin dark edge with the light catching the near rim
  ribbonPath(R); ctx.strokeStyle = 'rgba(46,30,6,.55)'; ctx.lineWidth = Math.max(px(1), .0015); ctx.stroke();
  if (lod > 20) { edgePath(R, -1, .002); ctx.strokeStyle = 'rgba(250,220,150,.35)'; ctx.lineWidth = Math.max(px(1), .002); ctx.stroke(); }
}
function drawStipe(submerged) {
  const R = STIPE;
  if (.03 * s < 1) return;
  ribbonPath(R);
  if (!submerged) { ctx.save(); ctx.translate(.01, .014); ctx.fillStyle = 'rgba(8,6,2,.35)'; ctx.fill(); ctx.restore(); ribbonPath(R); }
  ctx.fillStyle = PAL.STIPE_BASE; ctx.fill();
  midPath(R, .004); ctx.lineWidth = .009; ctx.strokeStyle = 'rgba(210,170,90,.35)'; ctx.lineCap = 'round'; ctx.stroke();
  ribbonPath(R); ctx.strokeStyle = 'rgba(30,20,4,.6)'; ctx.lineWidth = Math.max(px(1), .0012); ctx.stroke();
}
function drawBulb() {
  const { x, y, r } = BULB;
  if (r * s < 1.2) return;
  // the apophyses: short stalks at the crown where the blades attach
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const S = BLADES[k + (k > 0 ? 1 : 0)].S, p = S[Math.min(S.length - 1, Math.round(.1 / .003))];
    ctx.strokeStyle = PAL.STIPE_BASE; ctx.lineWidth = .014; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, p.x, .7), lerp(y, p.y, .7)); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,170,90,.3)'; ctx.lineWidth = .004; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(10,6,2,.38)'; ctx.beginPath(); ctx.ellipse(x + r * .28, y + r * .36, r * 1.02, r * .96, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r);
  g.addColorStop(0, PAL.KELP_GLOW); g.addColorStop(.45, '#a57c34'); g.addColorStop(.85, '#6a4c1a'); g.addColorStop(1, PAL.KELP_DARK);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  // light passing through the gas-filled float, gathering at the far edge
  const tr = ctx.createRadialGradient(x + r * .45, y + r * .5, 0, x + r * .45, y + r * .5, r * .6);
  tr.addColorStop(0, 'rgba(255,214,120,.45)'); tr.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = tr; ctx.beginPath(); ctx.arc(x, y, r * .97, 0, 7); ctx.fill();
  if (r * s > 30) {
    ctx.strokeStyle = 'rgba(60,40,10,.25)'; ctx.lineWidth = r * .02;
    for (let k = 0; k < 7; k++) { const a = k * .9 + .3; ctx.beginPath(); ctx.arc(x, y, r * (.35 + .08 * k), a, a + .7); ctx.stroke(); }
  }
  // wet specular: a window-shaped highlight and a hard glint
  ctx.fillStyle = 'rgba(255,252,240,.55)'; ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .44, r * .24, r * .13, -.7, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x - r * .46, y - r * .5, r * .055, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,4,.5)'; ctx.lineWidth = Math.max(px(1), r * .02); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}
// the stranded kelp's rock: low on the shore, barnacled, weedy at its foot, wet
function drawFocalRock() {
  const { x, y, r } = FOCAL_ROCK;
  boulder(x, y, r, 999, 4.2, 2);
  if (z < .45) closeBarnacles(x, y, r);
}
// single barnacles on the focal rock once they are big enough to read
function closeBarnacles(x, y, r) {
  const A = sstep(.45, .05, z);
  ctx.save(); rockPath(x, y, r, 999, .8 + hash(999, 1, 9) * .1); ctx.clip();
  ctx.globalAlpha = A;
  forCells(.028, 241, (i, j, bx, by, a, b) => {
    if (a > .5) return;
    if (by > y + r * .35) return;
    const rr = .003 + b * .006;
    ctx.save(); ctx.translate(bx, by); ctx.scale(rr / 10, rr / 10); barnacle(ctx, 0, 0, 10, a * 7); ctx.restore();
  }, 5000);
  ctx.globalAlpha = 1; ctx.restore();
}
function drawFocal() {
  const A = BANDS.kelp.weight;
  ctx.globalAlpha = A;
  // the stipe's run through the water, dimmed by the sea over it
  if (z > -.3) {
    drawStipe(true);
    ctx.save(); seaPath(); rockPath(FOCAL_ROCK.x, FOCAL_ROCK.y, FOCAL_ROCK.r, 999, .8 + hash(999, 1, 9) * .1); ctx.clip('evenodd');
    ribbonPath(STIPE); ctx.fillStyle = rgba(PAL.SEA_SHALLOW, .55); ctx.fill();
    ctx.restore();
  }
  drawFocalRock();
  if (z > -.3) {
    ctx.save(); ctx.beginPath(); for (const R of coast.rings) { const p = R.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }
    rockPath(FOCAL_ROCK.x, FOCAL_ROCK.y, FOCAL_ROCK.r, 999, .8 + hash(999, 1, 9) * .1); ctx.clip('nonzero');
    drawStipe(false); ctx.restore();
  }
  for (let i = BLADES.length - 1; i >= 1; i--) drawBlade(BLADES[i]);
  drawBulb();
  drawBlade(BLADES[0]);
  ctx.globalAlpha = 1;
}

// ---------- spray beads and the drop (ticket #802) ----------
function dropSprite() {
  return sprite('drop', () => {
    const N = 128, c = makeCanvas(N, N), g = c.getContext('2d'), R = N * .4, C = N / 2;
    g.fillStyle = 'rgba(20,12,2,.28)'; g.beginPath(); g.ellipse(C + R * .16, C + R * .2, R * 1.02, R * .98, 0, 0, 7); g.fill();
    const b = g.createRadialGradient(C, C, R * .2, C, C, R);
    b.addColorStop(0, 'rgba(255,236,190,.08)'); b.addColorStop(.72, 'rgba(120,90,40,.12)'); b.addColorStop(.92, 'rgba(40,28,8,.45)'); b.addColorStop(1, 'rgba(255,245,220,.55)');
    g.fillStyle = b; g.beginPath(); g.arc(C, C, R, 0, 7); g.fill();
    const k = g.createRadialGradient(C + R * .38, C + R * .42, 0, C + R * .38, C + R * .42, R * .55);
    k.addColorStop(0, 'rgba(255,238,170,.8)'); k.addColorStop(1, 'rgba(255,238,170,0)');
    g.fillStyle = k; g.beginPath(); g.arc(C, C, R, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(C - R * .38, C - R * .42, R * .22, R * .12, -.7, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(C - R * .45, C - R * .47, R * .06, 0, 7); g.fill();
    return c;
  });
}
function bead(x, y, r) {
  const d = r * s;
  if (d < .8) return;
  // big on screen: the full lens; small: the baked sprite
  if (d > 110) { lens(x, y, r, 0, 1.18); return; }
  const spr = dropSprite(), k = r / (128 * .4);
  ctx.drawImage(spr, x - 64 * k, y - 64 * k, 128 * k, 128 * k);
}
function drawBeads() {
  if (!(s * .001 > 1.2 && z > -2.45)) return;
  const A = BANDS.drop.weight;
  ctx.globalAlpha = A;
  const S = BLADES[0].S;
  forCells(.009, 51, (i, j, x, y, a, b) => {
    if (a > .5) return;
    const r = .0006 + b * b * .0024;
    if (Math.hypot(x - DROP.x, y - DROP.y) < DROP.r + r + .0008) return;
    // on blade 0, inside its margins
    let best = 1e9;
    for (let k = 0; k < S.length; k += 6) { const d = (S[k].x - x) ** 2 + (S[k].y - y) ** 2; if (d < best) best = d; }
    if (Math.sqrt(best) > BLADE_W * .4) return;
    bead(x, y, r);
  }, 7000);
  ctx.globalAlpha = 1;
}
// A drop on the blade is a lens: inside it the blade shows magnified and upright, the rim goes dark where it
// reflects the dark, the light gathers into a caustic on the far side, a soft window highlight and a hard glint sit
// toward the light. `inside` (0 → 1) relaxes the magnification and fades the surface lights as the camera sinks in.
function lens(x, y, r, inside, mag0) {
  const mag = lerp(mag0, 1, inside), out = 1 - inside;
  const sh = ctx.createRadialGradient(x + r * .14, y + r * .18, r * .9, x + r * .14, y + r * .18, r * 1.12);
  sh.addColorStop(0, 'rgba(30,18,4,.35)'); sh.addColorStop(1, 'rgba(30,18,4,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x + r * .14, y + r * .18, r * 1.12, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  fillBladeClose(1, mag, x, y);
  const w = ctx.createRadialGradient(x - r * .1, y - r * .1, r * .2, x, y, r);
  w.addColorStop(0, `rgba(190,225,220,${.08 * out})`); w.addColorStop(.6, `rgba(60,50,30,${.06 * out})`); w.addColorStop(.88, `rgba(35,22,6,${.22 * out})`); w.addColorStop(.975, `rgba(30,20,6,${.34 * out})`); w.addColorStop(1, `rgba(250,240,215,${.75 * out})`);
  ctx.fillStyle = w; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  const k = ctx.createRadialGradient(x + r * .34, y + r * .4, 0, x + r * .34, y + r * .4, r * .62);
  k.addColorStop(0, `rgba(255,232,150,${.34 * (1 - inside * .6)})`); k.addColorStop(.45, `rgba(255,232,150,${.1 * (1 - inside * .6)})`); k.addColorStop(1, 'rgba(255,232,150,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = k; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over';
  if (out > 0) {
    // the sky window: a soft curved highlight, and a sharp glint on it
    ctx.save(); ctx.translate(x - r * .36, y - r * .4); ctx.rotate(-.72); ctx.scale(1, .5);
    const hw = ctx.createRadialGradient(0, 0, 0, 0, 0, r * .3);
    hw.addColorStop(0, `rgba(255,255,255,${.7 * out})`); hw.addColorStop(.55, `rgba(255,255,255,${.35 * out})`); hw.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hw; ctx.beginPath(); ctx.arc(0, 0, r * .3, 0, 7); ctx.fill(); ctx.restore();
    const gl = ctx.createRadialGradient(x - r * .44, y - r * .48, 0, x - r * .44, y - r * .48, r * .07);
    gl.addColorStop(0, `rgba(255,255,255,${out})`); gl.addColorStop(.4, `rgba(255,255,255,${.8 * out})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - r * .52, y - r * .56, r * .16, r * .16);
    ctx.fillStyle = `rgba(255,255,255,${.18 * out})`; ctx.beginPath(); ctx.ellipse(x + r * .5, y + r * .56, r * .1, r * .04, -.72, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = `rgba(250,244,225,${.5 + .25 * inside})`; ctx.lineWidth = Math.max(px(1.3), r * .008); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
}
function drawDrop() { lens(DROP.x, DROP.y, DROP.r, sstep(-1.9, -2.35, z), 1.28); }
// the blade under everything once the view is inside its margins (z < -1.42); screen pixels, optionally magnified
// about (mx, my) for the lens of a drop
function fillBladeClose(alpha, mag = 1, mx = 0, my = 0) {
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, dpr * cw / 2, dpr * ch / 2);
  ctx.translate(mx * s, my * s); ctx.scale(mag, mag); ctx.translate(-mx * s, -my * s);
  const Rp = Math.hypot(cw, ch);
  ctx.globalAlpha = alpha; ctx.fillStyle = PAL.KELP_BASE; ctx.fillRect(-Rp, -Rp, 2 * Rp, 2 * Rp);
  const t = tex('blade');
  octaves(.4, t.n, 4, (w, a) => {
    const k2 = w * s / t.n, c = Math.cos(BLADE_ANG) * k2, sn = Math.sin(BLADE_ANG) * k2;
    t.pat.setTransform(new DOMMatrix([c, sn, -sn, c, 0, 0]));
    ctx.globalAlpha = .55 * alpha * a; ctx.fillStyle = t.pat; ctx.fillRect(-Rp, -Rp, 2 * Rp, 2 * Rp);
  }, 420);
  // the translucent midline glow, as on the whole blade
  ctx.globalAlpha = alpha;
  const bw = BLADE_W * .3 * s;
  if (bw < 4 * Rp) {
    ctx.rotate(BLADE_ANG);
    const g = ctx.createLinearGradient(0, -bw, 0, bw);
    g.addColorStop(0, 'rgba(214,170,84,0)'); g.addColorStop(.5, 'rgba(214,170,84,.2)'); g.addColorStop(1, 'rgba(214,170,84,0)');
    ctx.fillStyle = g; ctx.fillRect(-2 * Rp, -2 * Rp, 4 * Rp, 4 * Rp);
  } else { ctx.fillStyle = 'rgba(214,170,84,.2)'; ctx.fillRect(-Rp, -Rp, 2 * Rp, 2 * Rp); }
  ctx.restore();
}
function drawCloseUp() {
  if (BANDS.drop.isActive) {
    // under the drop the kelp's own cells take over the floor from z ≈ -2.95
    if (z < -1.42) fillBladeClose(1);
    drawBeads();
    if (DROP.r * s > 1.5 && z > -2.4) drawDrop();
  }
  if (BANDS.slime.isActive) drawMicro();
}

// ---------- inside the drop, the slime and the mockup's pocket (z -1.95 → the dish; ticket #803) ----------
const POCKET_R = 20e-6;
const ORGS = [
  { kind: 'nauplius', x: 5.2e-4, y: -3.1e-4, L: 2.5e-4, a: .5 },
  { kind: 'ciliate', x: -3.0e-4, y: 1.6e-4, L: 1.0e-4, a: -.4 },
  { kind: 'ciliate', x: 7.0e-4, y: 4.5e-4, L: 1.2e-4, a: 2.1 },
  { kind: 'dino', x: -1.6e-4, y: -2.2e-4, L: 3.5e-5, a: .3 },
  { kind: 'dino', x: 2.4e-4, y: 1.9e-4, L: 3.0e-5, a: 1.2 },
  { kind: 'pennate', x: 3.8e-5, y: 1.2e-5, L: 7.0e-5, a: 1.45 },
  { kind: 'pennate', x: -5.5e-5, y: -3.0e-5, L: 4.5e-5, a: .3 },
];
// dark-field weight: the game's own look takes over around the dish
const darkfield = () => BANDS.dish.weight;

// ---- bakes for the micro scale ----
// blade surface: long wrinkles and mottling along the blade (x of the tile runs along the blade; self-similar)
BAKES.blade = function* () {
  const N = 512, A = hexRgb('#5c421a'), B = hexRgb('#94702e'), C = hexRgb('#caa154');
  return yield* imgBakeG(N, N, (x, y) => {
    const st = pfbm(x / N * 2, y / N * 26, 2, 26, 3, 301), mo = pfbm(x / N * 5, y / N * 5, 5, 5, 4, 303), sp = hash(x, y, 305);
    let v = st * .6 + mo * .4; if (sp > .985) v += .25;
    return [...ramp3(A, B, C, clamp(v, 0, 1)), 200];
  });
};
// the kelp's surface cells, true scale: tile = 100 µm, 8 columns × 9 rows of polygonal cells ~12 µm
const CELL_TILE = 100e-6;
let CELL_GEOM = null;
// cells on a brick-offset jittered grid (8 columns along the blade × 9 rows); the field is computed once for both looks
function cellGeom() {
  if (CELL_GEOM) return CELL_GEOM;
  const cols = 8, rows = 9, sites = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const off = (j % 2) * .5;
    sites.push([(i + off + .5 + (hash(i, j, 311) - .5) * .5) / cols, (j + .5 + (hash(i, j, 312) - .5) * .35) / rows, hash(i, j, 313)]);
  }
  CELL_GEOM = { sites, cols, rows, field: null };
  return CELL_GEOM;
}
function* cellFieldG(N, fn) {
  const G = cellGeom(), { sites, cols, rows } = G;
  if (!G.field || G.field.N !== N) {
    // nearest two sites among the 3 × 3 grid neighbours (rows are offset, so check the rows above and below too)
    const e = new Float32Array(N * N), dc = new Float32Array(N * N), id = new Uint16Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, rj = Math.floor(v * rows);
      let d1 = 9, d2 = 9, best = 0;
      for (let j = rj - 1; j <= rj + 1; j++) {
        const wj = ((j % rows) + rows) % rows, ci = Math.floor(u * cols);
        for (let i = ci - 2; i <= ci + 1; i++) {
          const wi = ((i % cols) + cols) % cols, k = wj * cols + wi;
          let dx = Math.abs(u - sites[k][0]), dy = Math.abs(v - sites[k][1]);
          dx = Math.min(dx, 1 - dx) * 1.12; dy = Math.min(dy, 1 - dy);
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2 && k !== best) d2 = d;
        }
      }
      const o = y * N + x; e[o] = (Math.sqrt(d2) - Math.sqrt(d1)) * N; dc[o] = Math.sqrt(d1) * N; id[o] = best;
      if (x === N - 1 && (y & 7) === 7) yield;
    }
    G.field = { N, e, dc, id };
  }
  const F = G.field;
  return yield* imgBakeG(N, N, (x, y) => { const o = y * N + x; return fn(F.e[o], F.dc[o], sites[F.id[o]][2]); });
}
function plastids(g, N, bright) {
  const { sites } = cellGeom();
  for (let k = 0; k < sites.length; k++) {
    const [u, v, h] = sites[k], n = 6 + Math.floor(h * 6);
    for (let p = 0; p < n; p++) {
      const a = hash(k, p, 321) * 6.28, rr = (.018 + hash(k, p, 322) * .03) * N, pr = (.008 + hash(k, p, 323) * .005) * N;
      wrapDraw(g, N, u * N + Math.cos(a) * rr, v * N + Math.sin(a) * rr, pr * 2, (X, Y) => {
        if (bright) {
          const gr = g.createRadialGradient(X - pr * .3, Y - pr * .3, pr * .1, X, Y, pr);
          gr.addColorStop(0, PAL.PHAEO_LIGHT); gr.addColorStop(1, PAL.PHAEO); g.fillStyle = gr;
        } else g.fillStyle = 'rgba(227,190,110,.35)';
        g.beginPath(); g.ellipse(X, Y, pr, pr * .8, a, 0, 7); g.fill();
      });
    }
    wrapDraw(g, N, u * N, v * N, N * .03, (X, Y) => { g.fillStyle = bright ? 'rgba(230,210,160,.3)' : 'rgba(230,210,160,.08)'; g.beginPath(); g.arc(X, Y, N * .018, 0, 7); g.fill(); });
  }
}
BAKES.cells = function* () {
  const N = 1024, A = hexRgb(PAL.CELL_DARK), B = hexRgb(PAL.CELL_BASE), W = hexRgb(PAL.CELL_WALL);
  const c = yield* cellFieldG(N, (e, dc, h) => {
    const body = ramp3(A, B, hexRgb('#b48d44'), clamp(.35 + h * .4 - dc / N * 2.2, 0, 1));
    const wall = clamp(1 - e / 3.2, 0, 1), groove = clamp(1 - Math.abs(e - 4.5) / 2.5, 0, 1) * .35;
    return [lerp(body[0] * (1 - groove), W[0], wall), lerp(body[1] * (1 - groove), W[1], wall), lerp(body[2] * (1 - groove), W[2], wall)];
  });
  plastids(c.getContext('2d'), N, true);
  return c;
};
BAKES.cellsDark = function* () {
  const N = 1024;
  const c = yield* cellFieldG(N, e => { const w = Math.exp(-e / 2.2) * .9 + Math.exp(-e / 9) * .12; return [227 * w + 11, 190 * w + 22, 120 * w + 38, 255]; });
  plastids(c.getContext('2d'), N, false);
  return c;
};
// caustics: the bright net that the drop's rippling skin throws on the floor
BAKES.caustic = function* () {
  const N = 512, G = 6, jit = (x, y, k) => hash(x, y, 331 + k) * .9 + .05;
  return yield* imgBakeG(N, N, (x, y) => {
    // warped, and brighter where the net converges: organic filaments rather than a mesh
    let u = x / N, v = y / N;
    u += (pfbm(u * 3, v * 3, 3, 3, 2, 335) - .5) * .09; v += (pfbm(u * 3 + 7, v * 3, 3, 3, 2, 336) - .5) * .09;
    const [d1, d2] = vor(((u % 1) + 1) % 1, ((v % 1) + 1) % 1, G, jit);
    const e = (d2 - d1) * G, lum = .35 + .65 * pfbm(u * 4, v * 4, 4, 4, 3, 337);
    const a = (Math.pow(clamp(1 - e / .11, 0, 1), 2) * .9 + Math.pow(clamp(1 - e / .45, 0, 1), 2) * .12) * lum;
    return [255, 250, 225, clamp(a, 0, 1) * 255];
  });
};

// ---- game-style glass: translucent body lit top-left, a scattering rim, a halo and a glint ----
// Canvas drops gradients and patterns whose user-space numbers are ~1e-5, so every micro object is drawn in its own
// unit (UN metres): translate, rotate, scale(UN), then sizes are fractions of the object.
let UN = 1;
const pxu = n => px(n) / UN;
const lw = w => Math.max(pxu(1.1), w);
function rimGrad(x, y, r, rim, base) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, PAL.WHITE); g.addColorStop(.35, rim); g.addColorStop(.72, base); g.addColorStop(1, rim);
  return g;
}
function bodyGrad(x, y, r, light, base, dark, a) {
  const g = ctx.createRadialGradient(x - r * .35, y - r * .38, r * .05, x + r * .1, y + r * .1, r * 1.1);
  g.addColorStop(0, rgba(light, a)); g.addColorStop(.55, rgba(base, a)); g.addColorStop(1, rgba(dark, a * .9));
  return g;
}
function halo(x, y, r, hex, a) {
  if (a <= 0) return;
  const spr = sprite('glow' + hex, () => glowSprite(hex));
  const g0 = ctx.globalAlpha; ctx.globalAlpha = g0 * a; ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = g0;
}
function glint(x, y, r) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
// enter an object's frame: position and heading in metres, then its size as the unit
function objIn(x, y, a, size) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(size, size); UN = size; }
function objOut() { UN = 1; ctx.restore(); }

// ---- diatoms ----
function lanceolate(L, W) {
  ctx.beginPath();
  const n = 28;
  for (let k = 0; k <= n; k++) { const u = k / n * 2 - 1, w = W / 2 * Math.pow(1 - u * u, .62); k ? ctx.lineTo(u * L / 2, -w) : ctx.moveTo(u * L / 2, -w); }
  for (let k = n; k >= 0; k--) { const u = k / n * 2 - 1, w = W / 2 * Math.pow(1 - u * u, .62); ctx.lineTo(u * L / 2, w); }
  ctx.closePath();
}
// a boat-shaped (pennate) diatom: two golden plastids in a glass box scored with striae, the raphe down its middle
function pennate(o, df) {
  const Lp = o.L;
  if (Lp * s < 3) return;
  objIn(o.x, o.y, o.a, Lp);
  const L = 1, W = .2;
  halo(0, 0, .62, PAL.SILICA_BASE, .16 + .26 * df);
  lanceolate(L, W);
  ctx.fillStyle = rgba(PAL.SILICA_BASE, .14 + .1 * df); ctx.fill();
  if (Lp * s > 12) for (const sg of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(0, sg * W * .2, .36, W * .17, 0, 0, 7);
    ctx.fillStyle = bodyGrad(0, sg * W * .2, .3, PAL.DIATOM_PLASTID_LIGHT, '#b98a2e', PAL.DIATOM_PLASTID_DARK, .85); ctx.fill();
  }
  const sp = 1 / 60;
  if (sp * Lp * s > 2.6) {
    ctx.save(); lanceolate(L, W); ctx.clip();
    ctx.strokeStyle = rgba(PAL.SILICA_LIGHT, .26 + .22 * df); ctx.lineWidth = lw(sp * .3);
    ctx.beginPath(); for (let k = -30; k <= 30; k++) { if (Math.abs(k) < 2) continue; ctx.moveTo(k * sp, -W / 2); ctx.lineTo(k * sp, W / 2); } ctx.stroke();
    ctx.restore();
  }
  if (Lp * s > 16) {
    ctx.strokeStyle = rgba(PAL.SILICA_LIGHT, .7); ctx.lineWidth = lw(.006);
    ctx.beginPath(); ctx.moveTo(-.44, 0); ctx.lineTo(-.04, 0); ctx.moveTo(.04, 0); ctx.lineTo(.44, 0); ctx.stroke();
    ctx.fillStyle = rgba(PAL.SILICA_LIGHT, .5); ctx.beginPath(); ctx.ellipse(0, 0, .03, W * .12, 0, 0, 7); ctx.fill();
  }
  lanceolate(L, W); ctx.strokeStyle = rimGrad(0, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); ctx.lineWidth = lw(.012); ctx.stroke();
  if (Lp * s > 20) glint(-.3, -W * .22, Math.max(pxu(3), .03));
  objOut();
}
// Cocconeis: a flat oval diatom pressed onto the kelp
function cocconeis(x, y, Lp, a, df) {
  if (Lp * s < 3) return;
  objIn(x, y, a, Lp);
  halo(0, 0, .7, PAL.SILICA_BASE, .14 + .26 * df);
  ctx.beginPath(); ctx.ellipse(0, 0, .5, .33, 0, 0, 7);
  ctx.fillStyle = bodyGrad(0, 0, .5, PAL.DIATOM_PLASTID_LIGHT, '#a87a28', PAL.DIATOM_PLASTID_DARK, .5 + .15 * (1 - df)); ctx.fill();
  if (Lp * s > 14) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(PAL.SILICA_LIGHT, .3); ctx.lineWidth = lw(.008);
    ctx.beginPath(); for (let k = 0; k < 36; k++) { const t = k / 36 * 6.283; ctx.moveTo(Math.cos(t) * .1, Math.sin(t) * .05); ctx.lineTo(Math.cos(t) * .5, Math.sin(t) * .33); } ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba(PAL.SILICA_LIGHT, .6); ctx.lineWidth = lw(.01); ctx.beginPath(); ctx.moveTo(-.3, 0); ctx.lineTo(.3, 0); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, .5, .33, 0, 0, 7); ctx.strokeStyle = rimGrad(0, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); ctx.lineWidth = lw(.02); ctx.stroke();
  if (Lp * s > 20) glint(-.22, -.14, Math.max(pxu(2.5), .04));
  objOut();
}
// Licmophora: wedge-shaped cells fanned out on a mucilage stalk, a signature epiphyte of kelp
function licmophora(x, y, Lp, a, df) {
  if (Lp * s < 4) return;
  objIn(x, y, a, Lp);
  const sway = Math.sin(T * .7 + x * 1e5) * .05;
  ctx.strokeStyle = rgba(PAL.SILICA_BASE, .35); ctx.lineWidth = lw(.03); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-.45, 0); ctx.stroke();
  for (let k = 0; k < 5; k++) {
    ctx.save(); ctx.rotate((k - 2) * .22 + sway);
    ctx.beginPath(); ctx.moveTo(0, -.02); ctx.lineTo(1, -.09); ctx.quadraticCurveTo(1.04, 0, 1, .09); ctx.lineTo(0, .02); ctx.closePath();
    ctx.fillStyle = bodyGrad(.5, 0, .5, PAL.DIATOM_PLASTID_LIGHT, '#a87a28', PAL.DIATOM_PLASTID_DARK, .55); ctx.fill();
    ctx.strokeStyle = rimGrad(.5, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); ctx.lineWidth = lw(.012); ctx.stroke();
    ctx.restore();
  }
  objOut();
}

// ---- the copepod larva: a shield of a body, three pairs of rowing limbs fringed with setae, one red eye ----
function nauplius(o, df) {
  const Lp = o.L;
  if (Lp * s < 4) return;
  objIn(o.x, o.y, o.a, Lp);
  const L = 1;
  halo(0, 0, .75, '#f0d9a8', .1 + .2 * df);
  const limbs = [[.3, .55, .0], [.1, .62, 1.1], [-.08, .5, 2.2]];
  ctx.lineCap = 'round';
  for (const sg of [-1, 1]) for (const [ax, len, ph] of limbs) {
    const beat = Math.sin(T * 5.5 + ph) * .35;
    const a0 = sg * (1.15 + beat * .6);
    const bx = ax, by = sg * .22;
    const ex = bx + Math.cos(a0 - sg * .3) * len * .55 - len * .25, ey = by + Math.sin(a0) * len * .7;
    ctx.strokeStyle = 'rgba(240,226,190,.8)'; ctx.lineWidth = lw(.03);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + .02, by + sg * len * .35, ex, ey); ctx.stroke();
    if (Lp * s > 40) {
      ctx.strokeStyle = 'rgba(245,238,215,.55)'; ctx.lineWidth = lw(.006);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const t = .55 + k * .1, qx = lerp(bx, ex, t), qy = lerp(by, ey, t); ctx.moveTo(qx, qy); ctx.lineTo(qx - .22, qy + sg * (.12 + k * .03)); }
      ctx.stroke();
    }
  }
  const body = () => {
    ctx.beginPath(); ctx.moveTo(.44, 0); ctx.bezierCurveTo(.44, -.36, -.26, -.34, -.44, -.06);
    ctx.lineTo(-.5, 0); ctx.lineTo(-.44, .06); ctx.bezierCurveTo(-.26, .34, .44, .36, .44, 0); ctx.closePath();
  };
  body();
  ctx.fillStyle = bodyGrad(0, 0, .45, '#fbf1d8', '#d8c090', '#8a7040', .45 + .12 * (1 - df)); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(150,110,50,.3)'; ctx.beginPath(); ctx.ellipse(-.05, 0, .28, .12, 0, 0, 7); ctx.fill();
  for (let k = 0; k < 7; k++) {
    const dx = (hash(k, 1, 341) - .5) * .5, dy = (hash(k, 2, 341) - .5) * .22, r = .02 + hash(k, 3, 341) * .03;
    ctx.fillStyle = bodyGrad(dx, dy, r, PAL.LIPID_LIGHT, PAL.LIPID_BASE, PAL.LIPID_CENTRE, .85); ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill();
  }
  ctx.restore();
  body(); ctx.strokeStyle = rimGrad(0, 0, .45, '#fff3d6', '#c8a868'); ctx.lineWidth = lw(.012); ctx.stroke();
  ctx.strokeStyle = 'rgba(245,238,215,.6)'; ctx.lineWidth = lw(.006);
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-.47, sg * .03); ctx.quadraticCurveTo(-.7, sg * .06, -.9, sg * (.1 + Math.sin(T * 3) * .02)); ctx.stroke(); }
  halo(.33, 0, .07, '#ff5a3c', .6);
  ctx.fillStyle = '#c23a22'; ctx.beginPath(); ctx.arc(.33, 0, .03, 0, 7); ctx.fill();
  if (Lp * s > 30) glint(.15, -.18, Math.max(pxu(3), .03));
  void L;
  objOut();
}
// ---- a ciliate (Euplotes): cilia beating in a travelling wave, the mouth's membranelles, a C-shaped macronucleus ----
function ciliate(o, df) {
  const Lp = o.L;
  if (Lp * s < 4) return;
  const drift = Math.sin(T * .3 + o.x * 1e4) * Lp * .05;
  objIn(o.x + drift, o.y, o.a + Math.sin(T * .25) * .05, Lp);
  const W = .66;
  halo(0, 0, .72, PAL.CILIA, .1 + .22 * df);
  if (Lp * s > 26) {
    ctx.strokeStyle = rgba(PAL.CILIA, .45 + .2 * df); ctx.lineWidth = lw(.004);
    ctx.beginPath();
    for (let k = 0; k < 72; k++) {
      const t = k / 72 * 6.283, c = Math.cos(t), sn = Math.sin(t), lean = Math.sin(t * 6 - T * 7) * .45;
      const x0 = c * .5, y0 = sn * W / 2, nx = c / .5, ny = sn / (W / 2), nl = Math.hypot(nx, ny);
      const ux = nx / nl, uy = ny / nl, len = .07;
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + (ux - uy * lean) * len, y0 + (uy + ux * lean) * len);
    }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, .5, W / 2, 0, 0, 7);
  ctx.fillStyle = bodyGrad(0, 0, .5, '#eaf6f0', '#b9d7cc', '#6f9488', .36 + .15 * (1 - df)); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(60,90,80,.45)'; ctx.lineWidth = lw(.02); ctx.setLineDash([.012, .01]);
  ctx.beginPath(); ctx.ellipse(-.02, -W * .05, .38, W * .32, 0, Math.PI * .75, Math.PI * 1.75); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(210,235,255,.55)'; ctx.lineWidth = lw(.05); ctx.beginPath(); ctx.arc(.06, 0, .2, -2.2, 2.2); ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const dx = (hash(k, 1, 351) - .5) * .6, dy = (hash(k, 2, 351) - .5) * W * .6, r = .025 + hash(k, 3, 351) * .025, green = k % 2;
    ctx.fillStyle = bodyGrad(dx, dy, r, green ? PAL.CHLORO_LIGHT : PAL.MITO_LIGHT, green ? PAL.CHLORO_BASE : PAL.MITO_BASE, green ? PAL.CHLORO_DARK : PAL.MITO_DARK, .7);
    ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill();
  }
  const cvp = .8 + .2 * Math.sin(T * 1.3);
  ctx.strokeStyle = 'rgba(230,250,255,.55)'; ctx.lineWidth = lw(.006); ctx.beginPath(); ctx.arc(-.3, W * .15, .05 * cvp, 0, 7); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(PAL.CILIA, .7); ctx.lineWidth = lw(.014);
  for (let k = 0; k < 5; k++) { const a = Math.PI + (k - 2) * .22, c = Math.cos(a), sn = Math.sin(a); ctx.beginPath(); ctx.moveTo(c * .45, sn * W * .45); ctx.lineTo(c * .63, sn * W * .6 + Math.sin(T * 4 + k) * .02); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, 0, .5, W / 2, 0, 0, 7); ctx.strokeStyle = rimGrad(0, 0, .5, PAL.CILIA, '#6f9488'); ctx.lineWidth = lw(.01); ctx.stroke();
  if (Lp * s > 30) glint(-.2, -W * .25, Math.max(pxu(3), .035));
  objOut();
}
// ---- a dinoflagellate: armoured plates parted by the girdle, one flagellum in it, one trailing ----
function dino(o, df) {
  const Lp = o.L;
  if (Lp * s < 3) return;
  const spin = T * .9 + o.x * 1e5;
  objIn(o.x, o.y, o.a + Math.sin(spin) * .15, Lp);
  halo(0, 0, .8, PAL.MITO_BASE, .1 + .25 * df);
  if (Lp * s > 12) {
    ctx.strokeStyle = rgba(PAL.FLAGELLUM, .5); ctx.lineWidth = lw(.012); ctx.beginPath();
    for (let t = 0; t <= 1.001; t += .05) ctx.lineTo(-.45 - t * 1.1, Math.sin(t * 12 - T * 9) * .08 * t);
    ctx.stroke();
  }
  const shell = () => {
    ctx.beginPath(); ctx.moveTo(.5, 0); ctx.bezierCurveTo(.45, -.42, -.3, -.45, -.46, -.05);
    ctx.lineTo(-.5, .02); ctx.bezierCurveTo(-.3, .45, .45, .42, .5, 0); ctx.closePath();
  };
  shell();
  ctx.fillStyle = bodyGrad(0, 0, .5, '#f3c98a', '#c08a44', '#6e4a1c', .55 + .15 * (1 - df)); ctx.fill();
  ctx.save(); ctx.clip();
  if (Lp * s > 18) {
    ctx.strokeStyle = 'rgba(255,230,190,.3)'; ctx.lineWidth = lw(.01);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; ctx.beginPath(); ctx.moveTo(Math.cos(a) * .12, Math.sin(a) * .12); ctx.lineTo(Math.cos(a + .3) * .55, Math.sin(a + .3) * .55); ctx.stroke(); }
    for (let k = 0; k < 5; k++) { const dx = (hash(k, 1, 361) - .5) * .6, dy = (hash(k, 2, 361) - .5) * .5; ctx.fillStyle = 'rgba(120,80,20,.5)'; ctx.beginPath(); ctx.ellipse(dx, dy, .08, .05, k, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,60,20,.6)'; ctx.lineWidth = lw(.05); ctx.beginPath(); ctx.moveTo(-.05, -.46); ctx.quadraticCurveTo(.08, 0, -.05, .46); ctx.stroke();
  if (Lp * s > 14) {
    ctx.strokeStyle = rgba(PAL.FLAGELLUM, .6); ctx.lineWidth = lw(.008); ctx.beginPath();
    for (let t = 0; t <= 1.001; t += .04) ctx.lineTo(-.05 + .07 * (1 - 4 * (t - .5) ** 2) + Math.sin(t * 30 - T * 14) * .02, (t - .5) * .9);
    ctx.stroke();
  }
  shell(); ctx.strokeStyle = rimGrad(0, 0, .5, PAL.MITO_LIGHT, PAL.MITO_DARK); ctx.lineWidth = lw(.018); ctx.stroke();
  if (Lp * s > 16) glint(-.2, -.2, Math.max(pxu(2.5), .05));
  objOut();
}

// ---- bacteria and motes (the game's food vocabulary, at true sizes) ----
const ROD_KINDS = [
  { body: PAL.BACTERIUM_PLAIN, rim: PAL.PROTO_FILM, a: .55, halo: PAL.PROTO_FILM, ha: .22 },
  { body: PAL.MITO_BASE, rim: PAL.MITO_LIGHT, a: .78, halo: PAL.MITO_BASE, ha: .3 },
  { body: PAL.CHLORO_BASE, rim: PAL.CHLORO_LIGHT, a: .78, halo: PAL.CHLORO_LIGHT, ha: .3, bands: PAL.CHLORO_DARK },
];
function stadium(g, L, W) {
  const r = W / 2, l = L / 2 - r;
  g.beginPath(); g.moveTo(-l, -r); g.lineTo(l, -r); g.arc(l, 0, r, -Math.PI / 2, Math.PI / 2); g.lineTo(-l, r); g.arc(-l, 0, r, Math.PI / 2, Math.PI * 1.5); g.closePath();
}
// one rod in its own frame (centre 0, length along x): halo, translucent body, bands, inner edge, rim, glint
function rodArt(g, L, W, K, glow) {
  const r = W / 2;
  if (glow) { const spr = sprite('glow' + K.halo, () => glowSprite(K.halo)); const g0 = g.globalAlpha; g.globalAlpha = g0 * K.ha * glow; g.drawImage(spr, -L * .8, -W * 1.3, L * 1.6, W * 2.6); g.globalAlpha = g0; }
  stadium(g, L, W);
  const bg = g.createRadialGradient(-L * .2, -r * .5, r * .1, L * .05, r * .2, L * .6);
  bg.addColorStop(0, rgba(K.rim, K.a)); bg.addColorStop(.5, rgba(K.body, K.a)); bg.addColorStop(1, rgba(K.body, K.a * .7));
  g.fillStyle = bg; g.fill();
  if (K.bands) { g.save(); g.clip(); g.fillStyle = rgba(K.bands, .55); for (const t of [-.25, 0, .25]) g.fillRect(t * L - W * .09, -r, W * .18, W); g.restore(); stadium(g, L, W); }
  g.strokeStyle = rgba(K.body, .5); g.lineWidth = W * .12; g.save(); g.clip(); g.stroke(); g.restore();
  const rg = g.createLinearGradient(-L / 2, -r, L / 2, r);
  rg.addColorStop(0, PAL.WHITE); rg.addColorStop(.3, K.rim); rg.addColorStop(.7, K.body); rg.addColorStop(1, K.rim);
  g.strokeStyle = rg; g.lineWidth = W * .1; g.stroke();
  const gl = g.createRadialGradient(-L * .28, -r * .42, 0, -L * .28, -r * .42, W * .28);
  gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(-L * .28, -r * .42, W * .28, 0, 7); g.fill();
}
function rodSprite(k) {
  return sprite('rod' + k, () => { const c = makeCanvas(256, 160), g = c.getContext('2d'); g.translate(128, 80); rodArt(g, 150, 70, ROD_KINDS[k], 1); return c; });
}
function rod(x, y, L, W, a, k, df) {
  if (!vis(x, y, L)) return;
  const lp = L * s;
  if (lp < 1.5) return;
  if (lp < 150) {
    // baked: the sprite's 150 × 70 px rod stretched to this rod's size
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(L / 150, W / 70); ctx.drawImage(rodSprite(k), -128, -80); ctx.restore();
  } else { objIn(x, y, a, L); rodArt(ctx, 1, W / L, ROD_KINDS[k], .6 + .4 * df); objOut(); }
}
function moteSprite(kind) {
  return sprite('mote' + kind, () => {
    const N = 96, c = makeCanvas(N, N), g = c.getContext('2d'), C = N / 2, R = N * .16;
    const core = kind ? PAL.LIPID_BASE : PAL.FOOD_MOTE, edge = kind ? PAL.LIPID_CENTRE : PAL.FOOD_MOTE_EDGE, rim = kind ? PAL.LIPID_RIM : PAL.FOOD_MOTE_RIM;
    const h = g.createRadialGradient(C, C, 0, C, C, C); h.addColorStop(0, rgba(core, .5)); h.addColorStop(.3, rgba(core, .16)); h.addColorStop(1, rgba(core, 0));
    g.fillStyle = h; g.fillRect(0, 0, N, N);
    const b = g.createRadialGradient(C - R * .35, C - R * .35, R * .1, C, C, R);
    b.addColorStop(0, rim); b.addColorStop(.5, core); b.addColorStop(1, edge);
    g.fillStyle = b; g.beginPath(); kind ? g.ellipse(C, C, R * 1.2, R * .85, .5, 0, 7) : g.arc(C, C, R, 0, 7); g.fill();
    g.strokeStyle = rim; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(C - R * .4, C - R * .4, R * .22, 0, 7); g.fill();
    return c;
  });
}
function mote(x, y, r, kind) {
  if (r * s < .6 || !vis(x, y, r * 4)) return;
  const k = r / (96 * .16);
  ctx.drawImage(moteSprite(kind), x - 48 * k, y - 48 * k, 96 * k, 96 * k);
}

// ---- view-wide pattern fills, done in screen pixels (a pattern scaled to 1e-7 is dropped by the canvas) ----
// rect: [x, y, w, h] in view-centred CSS pixels (viewRect), the whole view when omitted; null draws nothing
function viewPat(name, tileWorld, alpha, rot = 0, ox = 0, oy = 0, op, rect) {
  if (rect === null) return;
  const t = tex(name);
  ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, dpr * cw / 2, dpr * ch / 2);
  const k = tileWorld * s / t.n, c = Math.cos(rot) * k, sn = Math.sin(rot) * k;
  const tp = tileWorld * s;
  t.pat.setTransform(new DOMMatrix([c, sn, -sn, c, ((ox * s) % tp), ((oy * s) % tp)]));
  if (op) ctx.globalCompositeOperation = op;
  ctx.globalAlpha *= alpha; ctx.fillStyle = t.pat;
  if (rect) ctx.fillRect(rect[0], rect[1], rect[2], rect[3]); else ctx.fillRect(-cw / 2 - 2, -ch / 2 - 2, cw + 4, ch + 4);
  ctx.restore();
}
function viewOct(name, tile0, alpha, target = 380, rot = 0, ox = 0, oy = 0, op) {
  const t = tex(name);
  octaves(tile0, t.n, 4, (w, a) => viewPat(name, w, alpha * a, rot, ox, oy, op), target);
}

// ---- the scene inside the drop ----
function drawMicro() {
  const inA = BANDS.slime.weight, df = darkfield();
  const edgeOn = z > -3.7;
  ctx.save();
  if (edgeOn) {
    // outside the drop: the blade's wet skin in the open air, a little darker
    ctx.fillStyle = `rgba(20,12,2,${.28 * inA})`;
    ctx.beginPath(); ctx.rect(-hx * 1.1, -hy * 1.1, 2.2 * hx, 2.2 * hy); ctx.moveTo(DROP.x + DROP.r, DROP.y); ctx.arc(DROP.x, DROP.y, DROP.r, 0, TAU, true); ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(DROP.x, DROP.y, DROP.r, 0, 7); ctx.clip();
  }
  const base = inA;
  // the floor: the kelp's surface cells come up as they grow past a few pixels
  // the cells come up as they pass a few pixels, and go out of focus once the view is well inside the dish
  const cellA = sstep(-2.4, -2.95, z) * sstep(-5.25, -4.8, z);
  if (cellA > 0) {
    ctx.globalAlpha = base;
    if (df < 1) viewPat('cells', CELL_TILE, cellA, BLADE_ANG);
    if (df > 0) viewPat('cellsDark', CELL_TILE, cellA * df, BLADE_ANG);
  }
  // caustic light on the floor: two sheets drifting against each other
  const cA = base * (1 - df) * sstep(-2.0, -2.5, z);
  if (cA > 0) {
    ctx.globalAlpha = 1;
    for (const [tile, vx, vy, a] of [[.42e-3, 1, .4, .13], [.27e-3, -.6, .9, .1]]) viewPat('caustic', tile, cA * a, .3, T * vx * tile * .05, T * vy * tile * .05, 'lighter');
  }
  ctx.globalAlpha = base * (1 - df); ctx.fillStyle = rgba(PAL.WATER_TINT, .08); ctx.fillRect(-hx * 1.1, -hy * 1.1, 2.2 * hx, 2.2 * hy);
  // dark field arrives: the field goes to the game's deep blue, the cell walls keep a faint glow above it
  if (df > 0) {
    ctx.globalAlpha = df * .86; ctx.fillStyle = PAL.BG_FIELD; ctx.fillRect(-hx * 1.1, -hy * 1.1, 2.2 * hx, 2.2 * hy);
    if (cellA > 0) { ctx.globalAlpha = 1; viewPat('cellsDark', CELL_TILE, cellA * df * .22, BLADE_ANG, 0, 0, 'lighter'); }
  }
  ctx.globalAlpha = base;
  drawSlime(df);
  drawFloorDiatoms(df);
  if (df < 1) { const g0 = ctx.globalAlpha; ctx.globalAlpha = g0 * (1 - df); drawDish(df); ctx.globalAlpha = g0; }
  for (const o of ORGS) {
    if (!vis(o.x, o.y, o.L * 1.2)) continue;
    ctx.globalAlpha = base;
    if (o.kind === 'nauplius') nauplius(o, df);
    else if (o.kind === 'ciliate') ciliate(o, df);
    else if (o.kind === 'dino') dino(o, df);
    else pennate(o, df);
  }
  // beyond the dish wall the field falls away darker, as past the game's wall
  if (df > 0 && POCKET_R * s > 2) { ctx.globalAlpha = df * .5; ctx.fillStyle = PAL.BG_DEEP; ctx.beginPath(); ctx.rect(-hx * 1.1, -hy * 1.1, 2.2 * hx, 2.2 * hy); ctx.moveTo(POCKET_R * 1.07, 0); ctx.arc(0, 0, POCKET_R * 1.07, 0, TAU, true); ctx.fill('evenodd'); }
  ctx.globalAlpha = base;
  drawBacteria(df);
  ctx.globalAlpha = 1;
  ctx.restore();
  // the drop's skin seen from inside, near its edge
  if (edgeOn && inA > 0) {
    ctx.strokeStyle = `rgba(235,250,255,${.7 * inA})`; ctx.lineWidth = Math.max(px(3), DROP.r * .006);
    ctx.beginPath(); ctx.arc(DROP.x, DROP.y, DROP.r, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,200,${.22 * inA})`; ctx.lineWidth = Math.max(px(14), DROP.r * .03);
    ctx.beginPath(); ctx.arc(DROP.x, DROP.y, DROP.r - Math.max(px(10), DROP.r * .02), 0, 7); ctx.stroke();
  }
}
// the slime (the biofilm's gel): soft clouds, none in the dish
function drawSlime(df) {
  if (s * 25e-6 < 3) return;
  const spr = sprite('slime', () => glowSprite('#d6e6c8', 64));
  const base = ctx.globalAlpha;
  forCells(30e-6, 81, (i, j, x, y, a, b) => {
    if (Math.hypot(x, y) < POCKET_R * 1.3) return;
    const r = 22e-6 + b * 22e-6;
    ctx.globalAlpha = base * (.1 + a * .12) * (1 - df * .78);
    ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
  }, 6000);
  ctx.globalAlpha = base;
}
function drawFloorDiatoms(df) {
  if (s * 40e-6 < 3) return;
  const base = ctx.globalAlpha;
  const inDrop = z > -3.7;
  const dot = sprite('diatomDot', () => glowSprite(PAL.DIATOM_PLASTID_LIGHT, 32));
  forCells(150e-6, 91, (i, j, x, y, a, b) => {
    if (Math.hypot(x, y) < 1.3e-4 || hash(i, j, 97) > .7) return;
    if (inDrop && Math.hypot(x - DROP.x, y - DROP.y) > DROP.r) return;
    const L = 30e-6 + a * 55e-6, ang = b * 6.283, k = hash(i, j, 95);
    // below a few pixels a diatom is a golden speck
    if (L * s < 7) { if (L * s < 2.5) return; const r = L * .4; ctx.globalAlpha = base * .45; ctx.drawImage(dot, x - r, y - r, 2 * r, 2 * r); return; }
    ctx.globalAlpha = base;
    // small and in bright field: the same few shapes every time, so a baked sprite (thousands of these at z ≈ -2)
    const kind = k < .45 ? 0 : k < .8 ? 1 : 2, Lk = L * DIATOM_SCALE[kind];
    if (df === 0 && Lk * s < DIATOM_SPRITE_PX[kind]) {
      if (Lk * s < (kind === 2 ? 4 : 3)) return;
      const spr = diatomSprite(kind), h = Lk * DIATOM_SPAN / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(spr, -h, -h, 2 * h, 2 * h); ctx.restore();
      return;
    }
    if (k < .45) cocconeis(x, y, L * .6, ang, df);
    else if (k < .8) pennate({ x, y, L, a: ang }, df);
    else licmophora(x, y, L * .8, ang, df);
  }, 4000);
  ctx.globalAlpha = base;
}
// The look of a small diatom in bright field (df = 0), below the sizes where cocconeis / pennate / licmophora add
// their striae, plastids and glints: halo, body, rim. Drawn in object units (the object's length = 1) with the rim
// as wide as a 1.1 px line on a ~10 px object; licmophora's sway is under a pixel at these sizes and is left out.
const DIATOM_SCALE = [.6, 1, .8], DIATOM_SPRITE_PX = [14, 12, 14], DIATOM_SPAN = 2.2, DIATOM_SPRITE_N = 64;
function diatomSprite(kind) {
  return sprite('diatom' + kind, () => {
    const N = DIATOM_SPRITE_N, c = makeCanvas(N, N), g = c.getContext('2d'), u = N / DIATOM_SPAN, line = 1.1 / 10;
    g.translate(N / 2, N / 2); g.scale(u, u); g.lineCap = 'round';
    const glow = (r, a) => { const spr = sprite('glow' + PAL.SILICA_BASE, () => glowSprite(PAL.SILICA_BASE)); g.globalAlpha = a; g.drawImage(spr, -r, -r, 2 * r, 2 * r); g.globalAlpha = 1; };
    if (kind === 0) {
      glow(.7, .14);
      g.beginPath(); g.ellipse(0, 0, .5, .33, 0, 0, 7);
      g.fillStyle = bodyGrad(0, 0, .5, PAL.DIATOM_PLASTID_LIGHT, '#a87a28', PAL.DIATOM_PLASTID_DARK, .65); g.fill();
      g.strokeStyle = rimGrad(0, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); g.lineWidth = Math.max(line, .02); g.stroke();
    } else if (kind === 1) {
      const W = .2, n = 28, lance = () => {
        g.beginPath();
        for (let k = 0; k <= n; k++) { const t = k / n * 2 - 1, w = W / 2 * Math.pow(1 - t * t, .62); k ? g.lineTo(t / 2, -w) : g.moveTo(t / 2, -w); }
        for (let k = n; k >= 0; k--) { const t = k / n * 2 - 1, w = W / 2 * Math.pow(1 - t * t, .62); g.lineTo(t / 2, w); }
        g.closePath();
      };
      glow(.62, .16);
      lance(); g.fillStyle = rgba(PAL.SILICA_BASE, .14); g.fill();
      g.strokeStyle = rimGrad(0, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); g.lineWidth = Math.max(line, .012); g.stroke();
    } else {
      g.strokeStyle = rgba(PAL.SILICA_BASE, .35); g.lineWidth = Math.max(line, .03); g.beginPath(); g.moveTo(0, 0); g.lineTo(-.45, 0); g.stroke();
      for (let k = 0; k < 5; k++) {
        g.save(); g.rotate((k - 2) * .22);
        g.beginPath(); g.moveTo(0, -.02); g.lineTo(1, -.09); g.quadraticCurveTo(1.04, 0, 1, .09); g.lineTo(0, .02); g.closePath();
        g.fillStyle = bodyGrad(.5, 0, .5, PAL.DIATOM_PLASTID_LIGHT, '#a87a28', PAL.DIATOM_PLASTID_DARK, .55); g.fill();
        g.strokeStyle = rimGrad(.5, 0, .5, PAL.SILICA_LIGHT, PAL.SILICA_DARK); g.lineWidth = Math.max(line, .012); g.stroke();
        g.restore();
      }
    }
    return c;
  });
}
// the dish: a 40 µm pocket of clear water in the slime, edged like the game's wall (the one hard edge)
function drawDish(df) {
  const R = POCKET_R;
  if (R * s < 2) return;
  const base = ctx.globalAlpha;
  objIn(0, 0, 0, R);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7);
  ctx.fillStyle = 'rgba(170,215,210,.1)'; ctx.globalAlpha = base * (1 - df); ctx.fill();
  ctx.fillStyle = PAL.BG_FIELD; ctx.globalAlpha = base * .85 * df; ctx.fill(); ctx.globalAlpha = base;
  const w = Math.max(.08, pxu(8));
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 1 + w);
  g.addColorStop(0, rgba(PAL.WALL_GLASS_OUTER, .8 * df + .12)); g.addColorStop(.4, rgba(PAL.WALL_GLASS_INNER, .65 * df + .08)); g.addColorStop(1, rgba(PAL.WALL_GLASS, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1 + w, 0, TAU); ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, TAU, true); ctx.fill();
  const hl = ctx.createLinearGradient(-1, -1, 1, 1);
  hl.addColorStop(0, rgba(PAL.WALL_LIGHT, 1)); hl.addColorStop(.5, rgba(PAL.WALL_LIGHT, .6)); hl.addColorStop(1, rgba(PAL.WALL_LIGHT, .38));
  ctx.globalAlpha = base * (.6 + .4 * df);
  ctx.strokeStyle = hl; ctx.lineWidth = Math.max(pxu(1.6), .006); ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.LIGHT_ACCENT, .2 * df); const sw = Math.max(pxu(7), .035); ctx.lineWidth = sw;
  ctx.beginPath(); ctx.arc(0, 0, 1 + sw / 2, Math.PI * .95, Math.PI * 1.55); ctx.stroke();
  ctx.globalAlpha = base;
  objOut();
}
// bacteria in the slime and in the dish, specks of food; each drifts a little
function drawBacteria(df) {
  if (s * 1e-6 < 1.2) return;
  const base = ctx.globalAlpha;
  forCells(3.4e-6, 101, (i, j, x, y, a, b) => {
    const d = Math.hypot(x, y), inDish = d < POCKET_R * .93;
    if (d < 2.6e-6 || (!inDish && d < POCKET_R * 1.14)) return;
    const h = hash(i, j, 107);
    if (inDish ? h > .16 : h > .3) return;
    // in the slime they are mostly plain and faint; the dish is where the food (and the colour) is
    const k = inDish ? (b < .5 ? 0 : b < .78 ? 1 : 2) : (b < .82 ? 0 : b < .93 ? 1 : 2);
    const L = 1.1e-6 + a * 1.5e-6, W = .5e-6 + hash(i, j, 105) * .25e-6;
    const ph = i * 1.7 + j * 2.3, amp = .35e-6;
    ctx.globalAlpha = base * (inDish ? 1 - df : .35 + .25 * df);
    rod(x + Math.sin(T * .35 + ph) * amp, y + Math.cos(T * .29 + ph * 1.3) * amp, L, W, hash(i, j, 106) * 6.283 + Math.sin(T * .2 + ph) * .25, k, df);
  }, 7000);
  forCells(1.5e-6, 111, (i, j, x, y, a, b) => {
    const d = Math.hypot(x, y);
    if (d < 1.6e-6 || d > POCKET_R * 3 || a > (d < POCKET_R ? .045 : .02)) return;
    ctx.globalAlpha = base * (d < POCKET_R ? 1 - df : 1);
    mote(x + Math.sin(T * .5 + i) * .12e-6, y + Math.cos(T * .43 + j) * .12e-6, .16e-6 + b * .22e-6, a < .008 ? 1 : 0);
  }, 9000);
  ctx.globalAlpha = base;
}


// ---------- one frame (was 90-render.js; the labels, scale bar and readout are the panel's, in the DOM) ----------
let frameNo = 0;
function sizeCanvas(widthPx, heightPx, ratio) {
  cw = Math.max(1, widthPx); ch = Math.max(1, heightPx);
  const W = Math.round(cw * ratio), H = Math.round(ch * ratio);
  if (dpr === ratio && cv.width === W && cv.height === H) return;
  dpr = ratio; cv.width = W; cv.height = H;
}
// Answers whether the planet shows under this canvas: the canvas is left clear for it, and the shore draws over it.
function drawFrame(f) {
  z = f.zoom; T = f.timeSeconds; BANDS = f.bands;
  sizeCanvas(f.widthPx, f.heightPx, f.devicePixelRatio);
  const W = Math.pow(10, z);
  s = cw / W; hx = cw / 2 / s; hy = ch / 2 / s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const worldA = BANDS.shore.weight;
  if (worldA > 0 && z > -1.42) buildCoast();
  // the forest only shows past the rock band: close in, the planet shows only if some of the view is that far inland
  let glOn = BANDS.planet.isActive;
  if (glOn && z < 3) {
    glOn = false;
    for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 0]]) {
      const d = coastDist(u * hx, v * hy, ZONE.band * 3 + Math.max(hx, hy));
      if (Number.isNaN(d) || d > ZONE.band - 2) { glOn = true; break; }
    }
  }
  if (glOn) ctx.clearRect(0, 0, cw, ch);
  else { ctx.fillStyle = '#02060a'; ctx.fillRect(0, 0, cw, ch); }

  if (worldA > 0) {
    ctx.save(); ctx.globalAlpha = worldA;
    worldXf();
    drawWorld(glOn);
    ctx.restore();
  }
  frameNo++;
  return glOn;
}

// The screen-sized canvases go back while no dive is open (a room is playing): each is made again at its size on the
// next draw, since every one checks its size. The tile bakes and the coastline bakes stay for the page.
function freeScreenCanvases() {
  if (cv) { cv.width = 1; cv.height = 1; dpr = 0; }
  LAYER.c = null; LAYER.g = null; LAYER.pats = {};
  for (const name of Object.keys(ZLAYER)) delete ZLAYER[name];
  for (const o of [DMASK, SHALLOW]) { o.c = null; o.g = null; o.img = null; }
  for (const c of [SEA.mc, SEA.cc]) if (c) { c.width = 1; c.height = 1; }
  SEA.frame = -1;
}

// ---------- the module's face (dive-mockup-bands.d.ts) ----------
/** One canvas for the page: a dive that closes and opens again draws on the same canvas and keeps every bake. */
export function createMockupBands(input) {
  nowMs = input.nowMs;
  if (!cv) { cv = makeCanvas(1, 1); ctx = cv.getContext('2d'); }
  if (!SALISH_RINGS) { initGeo(input.salishRings); initCoast(); }
  return {
    canvas: cv,
    draw(frame) { return drawFrame(frame); },
    pumpBakes(budgetMs) { bakeLanded = false; if (!allBaked) pump(budgetMs); return bakeLanded; },
    get isBaked() { return allBaked; },
    release() { freeScreenCanvases(); },
  };
}
