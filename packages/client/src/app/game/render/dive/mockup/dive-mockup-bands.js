// The opening dive's slime as the mockup draws it (ticket #797, epic #795): inside the drop, round the dish, on one
// Canvas 2D canvas. Everything above it is the game's own since tickets #800–#802 (the planet, the coast and shore,
// the kelp and the drop, all on the dive's Pixi canvas): this canvas draws only while the slime does, over the Pixi
// canvas while the drop still shows there and under it once the game's dish does. `dive-macro-band.ts` lays them.
//
// **This file is the mockup's code, not the game's.** It is the design artifact
// (https://claude.ai/artifact/A674H91iLRxEa4MTzCRPhu, src/00-core.js … 72-scene.js) made into one module: its page
// globals became module state set by `createMockupBands`, its timers became the dive's frame loop, and the parts the
// game draws itself (the dish wall, the bacteria in the dish, the light, you) hand over to the game's renderer. It
// is plain JavaScript on purpose and sits outside eslint, prettier, jscpd and coverage (.prettierignore, .jscpd.json,
// angular.json): ticket #803 moves the slime onto the game's GPU renderer and deletes this file, so it is never
// brought up to docs/CODE-STANDARDS.md. Do not add to it. docs/rendering/opening-dive.md is the contract. Which
// ticket deleted what:
//   ticket #801 (done), the coast and shore: moved to `shore/`
//   ticket #802 (done), the kelp and drop: moved to `kelp/`, with the planet's forest test (`shore/shore-forest-test.ts`)
//   ticket #803, the slime: inside the drop (the kelp's cells, slime, diatoms, ciliates, the mockup's own pocket)
//
// Units: world metres around the focus (x east, y south); z is log10 of the view's width in metres; T is seconds.

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
  if (!BAKES[name]) return placeholder();
  if (!WANT.includes(name)) WANT.push(name);
  return placeholder();
}
// the order the dive needs them in
const BAKE_ORDER = ['cells', 'cellsDark'];
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

// ---------- sprites ----------
// soft round glow (white; tinted by drawing into a colour via 'source-in' copies)
function glowSprite(hex, N = 64) {
  const c = makeCanvas(N, N), g = c.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, rgba(hex, 1)); gr.addColorStop(.35, rgba(hex, .45)); gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr; g.fillRect(0, 0, N, N); return c;
}
const SPR = {};
function sprite(name, make) { return SPR[name] || (SPR[name] = make()); }


// ---------- inside the drop, the slime and the mockup's pocket (z -1.95 → the dish; ticket #803) ----------
// The drop (`DROP`) and blade 0's direction (`BLADE_ANG`) the slime draws round; the kelp band's own are
// `constants/dive-kelp-drop.ts` and `kelp/kelp-ribbons.ts` (ticket #802).
const DROP = { x: .0014, y: .0009, r: .0025 };
const BLADE_ANG = Math.atan2(-.2, -.45);
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
// rect: [x, y, w, h] in view-centred CSS pixels, the whole view when omitted; null draws nothing
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
function sizeCanvas(widthPx, heightPx, ratio) {
  cw = Math.max(1, widthPx); ch = Math.max(1, heightPx);
  const W = Math.round(cw * ratio), H = Math.round(ch * ratio);
  if (dpr === ratio && cv.width === W && cv.height === H) return;
  dpr = ratio; cv.width = W; cv.height = H;
}
// The slime over the drop (the Pixi canvas under this one draws it, so this one is left clear round the slime) or,
// once the drop has gone, over the dark.
function drawFrame(f) {
  z = f.zoom; T = f.timeSeconds; BANDS = f.bands;
  sizeCanvas(f.widthPx, f.heightPx, f.devicePixelRatio);
  const W = Math.pow(10, z);
  s = cw / W; hx = cw / 2 / s; hy = ch / 2 / s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (BANDS.drop.isActive) ctx.clearRect(0, 0, cw, ch);
  else { ctx.fillStyle = '#02060a'; ctx.fillRect(0, 0, cw, ch); }
  if (BANDS.slime.isActive) {
    ctx.save();
    worldXf();
    drawMicro();
    ctx.restore();
  }
}

// The screen-sized canvas goes back while no dive is open (a room is playing): it is made again at its size on the
// next draw. The tile bakes stay for the page.
function freeScreenCanvases() {
  if (cv) { cv.width = 1; cv.height = 1; dpr = 0; }
}

// ---------- the module's face (dive-mockup-bands.d.ts) ----------
/** One canvas for the page: a dive that closes and opens again draws on the same canvas and keeps every bake. */
export function createMockupBands(input) {
  nowMs = input.nowMs;
  if (!cv) { cv = makeCanvas(1, 1); ctx = cv.getContext('2d'); }
  return {
    canvas: cv,
    draw(frame) { drawFrame(frame); },
    pumpBakes(budgetMs) { bakeLanded = false; if (!allBaked) pump(budgetMs); return bakeLanded; },
    get isBaked() { return allBaked; },
    release() { freeScreenCanvases(); },
  };
}
