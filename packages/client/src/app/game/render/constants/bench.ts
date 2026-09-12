// The frame budget and the fixed-seed bench scene (docs/RENDERING.md §6, §7): the per-stage p95
// budgets, the draw-call ceiling, the bench load and the route's defaults. Every budget here is a
// row of the §7 tables; `bench/render-budget-ledger.spec.ts` pins the two against each other.
// Units: ms unless the suffix says frames, ticks, wu or px.

import {
  DNA_FRAGMENT_CAP_BASE,
  DNA_FRAGMENT_CAP_PER_PLAYER,
  FOOD_CAP_BASE,
  FOOD_CAP_PER_PLAYER,
  FOOD_KIND,
  MAX_PLAYERS_PER_GAME,
  P95_QUANTILE,
  type FoodKind,
  type RenderStageName,
} from '@evolution/shared';

// ---- the frame budget (docs/RENDERING.md §7) ----
/** The whole frame, p95, at 1080p and `devicePixelRatio` 1. */
export const RENDER_FRAME_BUDGET_P95_MS = 12;
/** p95 per `renderStagesMs` key. */
export const RENDER_STAGE_BUDGET_MS: Readonly<Record<RenderStageName, number>> = {
  net: 1.0,
  cells: 1.2,
  organelles: 1.0,
  food: 0.6,
  effects: 0.3,
  camera: 0.1,
  submit: 1.0,
};
export const RENDER_GPU_BUDGET_MS = 4.0;
/**
 * What is left of a frame outside the timed brackets (the HUD, the dish placement, the browser),
 * measured per frame as `frame − Σ its top-level brackets` and reported at p95 (docs/RENDERING.md §7).
 */
export const RENDER_HUD_BUDGET_MS = 1.0;
/**
 * A GPU sample is kept only when it is at most this many times the wall clock between the two submits it
 * brackets: in steady state a frame's GPU time cannot exceed its frame period, and the factor is the slack
 * for pipelining and for the query's own resolution (docs/RENDERING.md §7, `gpuMs`).
 */
export const RENDER_GPU_SAMPLE_MAX_FRAME_RATIO = 2;
/**
 * The shortest window a p95 is estimable in: with fewer samples than `1 / (1 − quantile)` the nearest rank is
 * the maximum, so a shorter window reports no p95 judgement at all (docs/RENDERING.md §7).
 */
export const RENDER_P95_MIN_SAMPLE_FRAMES = Math.ceil(1 / (1 - P95_QUANTILE));
/** GL draw calls per frame at the bench load (docs/RENDERING.md §6). */
export const RENDER_MAX_DRAW_CALLS = 17;

// ---- the report's rolling window ----
/** Frames each rolling p95 covers: five seconds at 60 fps. */
export const RENDER_SAMPLE_CAPACITY_FRAMES = 300;
/** A live session rebuilds its report this often (one second at 60 fps). */
export const RENDER_REPORT_EVERY_FRAMES = 60;

// ---- the bench scene (docs/RENDERING.md §7) ----
export const RENDER_BENCH_SEED = 42;
export const RENDER_BENCH_CELL_COUNT = 100;
/** The baseline's motes: the food cap at the player cap (ECOLOGY §3), the bench draws the same. */
export const RENDER_BENCH_MOTE_COUNT = FOOD_CAP_BASE + MAX_PLAYERS_PER_GAME * FOOD_CAP_PER_PLAYER;
export const RENDER_BENCH_FRAGMENT_COUNT = DNA_FRAGMENT_CAP_BASE + MAX_PLAYERS_PER_GAME * DNA_FRAGMENT_CAP_PER_PLAYER;
/** The route's canvas: 1080p, the budget's viewport. */
export const RENDER_BENCH_VIEWPORT_PX = { width: 1920, height: 1080 } as const;
/** `/?bench=<seed>&tick=<n>&zoom=<z>` defaults: two seconds in, at 1 px per wu. */
export const RENDER_BENCH_DEFAULT_TICK = 120;
export const RENDER_BENCH_DEFAULT_ZOOM = 1;
/** Frames rendered before the report's window opens, then the frames the report covers. */
export const RENDER_BENCH_WARMUP_FRAMES = 30;
export const RENDER_BENCH_REPORT_FRAMES = 240;
/** Cells orbit the dish centre on circles of these radii (wu) and periods (s). */
export const RENDER_BENCH_ORBIT_RADIUS_WU = { min: 40, max: 900 } as const;
export const RENDER_BENCH_ORBIT_SECONDS = { min: 20, max: 90 } as const;
/** Cell masses, log-uniform, from a fresh protocell to a late-round giant. */
export const RENDER_BENCH_MASS = { min: 20, max: 2000 } as const;
/** Algae : bacterium : detritus shares of the bench dish (the eukaryote-era mix, ECOLOGY §3). */
export const RENDER_BENCH_MOTE_KIND_SHARES: Readonly<Record<FoodKind, number>> = {
  [FOOD_KIND.algae]: 0.6,
  [FOOD_KIND.bacterium]: 0.3,
  [FOOD_KIND.detritus]: 0.1,
};
/** Motes and fragments are scattered inside this radius (wu) of the dish centre. */
export const RENDER_BENCH_MOTE_SPREAD_WU = 1000;
/** Predator / prey pairs mid-engulf, so the wrap frames and the ghost path are exercised. */
export const RENDER_BENCH_ENGULF_PAIRS = 3;
/** Cells absorbed and respawned on the absorb cadence (a ghost per victim). */
export const RENDER_BENCH_VICTIM_COUNT = 4;
/** Eat effects per snapshot, and the level-up and absorb cadences in ticks (the victims are present at the default tick). */
export const RENDER_BENCH_EATS_PER_SNAPSHOT = 4;
export const RENDER_BENCH_LEVEL_UP_EVERY_TICKS = 90;
/** Ticks an engulf takes to walk the whole wrap strip, so every frame of it shows. */
export const RENDER_BENCH_ENGULF_CYCLE_TICKS = 90;
export const RENDER_BENCH_ABSORB_EVERY_TICKS = 300;
