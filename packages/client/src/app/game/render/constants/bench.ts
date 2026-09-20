// The frame budget and the fixed-seed bench scene (docs/rendering/budget.md §6, §7): the per-stage p95
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
  MILLISECONDS_PER_SECOND,
  P95_QUANTILE,
  type FoodKind,
  type RenderStageName,
} from '@evolution/shared';
import { FLOATER_LIFETIME_MS } from './legibility-cues';

// ---- the frame budget (docs/rendering/budget.md §7) ----
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
 * measured per frame as `frame − Σ its top-level brackets` and reported at p95 (docs/rendering/budget.md §7).
 */
export const RENDER_HUD_BUDGET_MS = 1.0;
/**
 * A GPU sample is kept only when it is at most this many times the wall clock between the two submits it
 * brackets: in steady state a frame's GPU time cannot exceed its frame period, and the factor is the slack
 * for pipelining and for the query's own resolution (docs/rendering/budget.md §7, `gpuMs`).
 */
export const RENDER_GPU_SAMPLE_MAX_FRAME_RATIO = 2;
/**
 * The shortest window a p95 is estimable in: with fewer than `1 / (1 − quantile)` samples the estimate is drawn
 * from the top one or two of them alone, whatever the estimator, so a shorter window reports no p95 judgement at
 * all (docs/rendering/budget.md §7).
 */
export const RENDER_P95_MIN_SAMPLE_FRAMES = Math.ceil(1 / (1 - P95_QUANTILE));
/** GL draw calls per frame at the bench load (docs/rendering/budget.md §6). */
export const RENDER_MAX_DRAW_CALLS = 17;
/** The effects stage's calls (§6): the glow-atlas sprite batch, the own-cell arc mesh, the `BitmapText`. */
export const RENDER_EFFECTS_DRAW_CALLS = 3;
/** Calls the §6 table leaves under the cap at the bench load with debug off. */
export const RENDER_DRAW_CALL_HEADROOM = 1;

// ---- the report's rolling window ----
/** Frames each rolling p95 covers: five seconds at 60 fps. */
export const RENDER_SAMPLE_CAPACITY_FRAMES = 300;
/** A live session rebuilds its report this often (one second at 60 fps). */
export const RENDER_REPORT_EVERY_FRAMES = 60;

// ---- the bench scene (docs/rendering/budget.md §7) ----
export const RENDER_BENCH_SEED = 42;
export const RENDER_BENCH_CELL_COUNT = 100;
/** The baseline's motes: the food cap at the player cap (ecology/food-and-spawn.md §3), the bench draws the same. */
export const RENDER_BENCH_MOTE_COUNT = FOOD_CAP_BASE + MAX_PLAYERS_PER_GAME * FOOD_CAP_PER_PLAYER;
export const RENDER_BENCH_FRAGMENT_COUNT = DNA_FRAGMENT_CAP_BASE + MAX_PLAYERS_PER_GAME * DNA_FRAGMENT_CAP_PER_PLAYER;
/** The route's canvas: 1080p, the budget's viewport. */
export const RENDER_BENCH_VIEWPORT_PX = { width: 1920, height: 1080 } as const;
/** `?bench&sheet=indicators`, the own-cell indicator contact sheet (#294): its layout in px and what it shows. */
export const INDICATOR_SHEET = {
  marginPx: 48,
  itemGapPx: 20,
  rowGapPx: 28,
  /** The palette whose rim colour tints the rung ghosts (Cyan, seat 0). */
  rimPaletteIndex: 0,
  labelTexts: ['AMOEBOID CAN ENGULF YOU', 'SPRINT TO ESCAPE', 'SEALED'],
  numeralTexts: ['1', '4', '9', '12'],
  /**
   * The arc panel (the arc primitive's evidence): the DNA ring at five fills on the cells whose floored ring is 17 px
   * (spawn) and 44.9 px (max mass), each on a patch of body; an orbit at 32 px whose backings merge around the
   * envelope ghost with both counters unlocked; the escape arc on a max-mass cell's 126 px orbit.
   */
  arcs: {
    capacity: 48,
    leftPx: 110,
    topPx: 380,
    dnaPitchPx: 160,
    dnaFills: [0, 0.25, 0.5, 0.75, 1],
    dnaCellRadiiPx: [24, 102],
    dnaBodyPadPx: 10,
    /** A 32 px orbit whose backings merge around the envelope ghost; a 24 px prokaryote whose two stay apart. */
    orbitSamples: [
      { cellRadiusPx: 32, centre: { x: 1000, y: 430 }, hasRungGhost: true },
      { cellRadiusPx: 24, centre: { x: 1000, y: 610 }, hasRungGhost: false },
    ],
    escapeCellRadiusPx: 102,
    escapeCentre: { x: 1450, y: 540 },
    escapeFill: 0.4,
  },
} as const;
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
/** Algae : bacterium : detritus shares of the bench dish (the eukaryote-era mix, ecology/food-and-spawn.md §3). */
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
/** The frame rate the §7 budgets are stated at, and the rate a cadence written in ms becomes frames at. */
export const RENDER_BENCH_FRAMES_PER_SECOND = 60;

/**
 * `?bench&cues=1` (#385): the own cell's legibility cues at their worst case (docs/ui/hud.md §3.1.5, `bench-cues.ts`).
 * The eat, the engulf payout and the sprint land on the first three frames of every `floaterCycleFrames`, so all
 * `FLOATER_MAX_VISIBLE` floaters are up for the rest of the cycle: since #443 a cause is on screen at most once, so
 * the worst case is one floater of each — FOOD and DNA from the eat, ENGULF, SPRINT — born together and leaving
 * together rather than a repeat of one cause, which now merges and draws nothing more. The rates are the audit's
 * worked example (mass 312 in the vent with Mitochondrion I, touching Toxin Vacuole I), so three tags show.
 */
export const RENDER_BENCH_CUES = {
  /**
   * A whole `FLOATER_LIFETIME_MS` in frames, so the cycle's four floaters retire just before the next cycle's steps
   * replace them. Derived, never a literal: retuning the lifetime (which §3.1.6 states as a taste call, so it will be
   * retuned) must move this with it, or the next cycle's eat would merge into a FOOD floater still on screen and the
   * bench would quietly measure fewer than `FLOATER_MAX_VISIBLE`. Rounded **up**, since a cycle shorter than the
   * lifetime is that same merge, while a longer one costs at most a frame of the four being three.
   * `bench-cues.spec.ts` drives a real `FloaterStack` over two cycles and pins what the cycle holds.
   */
  floaterCycleFrames: Math.ceil((FLOATER_LIFETIME_MS * RENDER_BENCH_FRAMES_PER_SECOND) / MILLISECONDS_PER_SECOND),
  ratesPerSecond: { toxin: -9.36, decay: -0.5, vent: -0.25 },
  decayTraitShare: -0.15,
  eatMassGained: 3,
  eatDnaGained: 5,
  engulfMassGained: 60,
  sprintSpent: 16,
} as const;
