// The opening dive's numbers (docs/rendering/opening-dive.md, ticket #797): the log-zoom range, the play timing, the
// band table, the readout and the scripted dish scene. Every value is the mockup's
// (https://claude.ai/artifact/A674H91iLRxEa4MTzCRPhu): its source names the same number at the place this comment
// says. The words (phases, ladder, labels) are `dive-script.ts`.

import { DISH_RADIUS } from '@evolution/shared';
import { HALF } from '../geometry';
import { ORGANELLE_ATLAS_MAX_DPR } from './organelles';

// ===== The log-zoom camera =====

/** The zoom is log10 of the view's width in metres: the dive starts here, 25,000 km across (`Z_TOP`). */
export const DIVE_ZOOM_TOP = 7.4;
/**
 * Where the scrub ends: 2.5 µm across, your cell filling most of the view. The mockup went on to −6.2, inside your
 * cell; the game's cell keeps its detail only to here, where it is drawn at about the organelle atlas's resolution
 * (`DIVE_BAKE_DEVICE_PIXEL_RATIO`), and beyond it the textures would be magnified several times.
 */
export const DIVE_ZOOM_BOTTOM = -5.6;
/** The base of the zoom's logarithm: one zoom step is one power of ten. */
export const DIVE_ZOOM_BASE = 10;
/** The slider's resolution in zoom steps (`step="0.01"`). */
export const DIVE_SLIDER_STEP = 0.01;

/** The focus every band draws around: the rocky point where Victoria will be (`CENTER`, degrees). */
export const DIVE_FOCUS_DEGREES = { longitude: -123.357, latitude: 48.4006 } as const;
/** The planet's radius in metres (`R_EARTH`). */
export const EARTH_RADIUS_M = 6.371e6;

/**
 * The opening turn of the planet (`render()`'s `tRot`): over Eurasia at the top, turned to the focus by
 * `DIVE_GLOBE_TURN_START_ZOOM − DIVE_GLOBE_TURN_SPAN_ZOOM`, smoothstepped.
 */
export const DIVE_GLOBE_START_DEGREES = { longitude: 82, latitude: 38 } as const;
export const DIVE_GLOBE_TURN_START_ZOOM = 7.3;
export const DIVE_GLOBE_TURN_SPAN_ZOOM = 0.55;
/**
 * The planet's idle turn while the dive waits in orbit (ticket #805: the readout says "The planet turns…"), the same
 * way as the opening turn: it starts at `degreesPerSecond` and eases toward `maxDegrees`, so a long wait never turns
 * it past the focus. The opening turn takes up whatever it reached.
 */
export const DIVE_GLOBE_IDLE_SPIN = { degreesPerSecond: 3, maxDegrees: 90 } as const;
/** The baked planet comes up over the flat fallback globe over this long, instead of in one frame (ticket #805). */
export const DIVE_GLOBE_CROSSFADE_MS = 300;

// ===== Playing a phase's opening =====

/** The still moment at the top before the fall (`hold`). */
export const DIVE_PLAY_HOLD_MS = 700;
/** One power of ten takes this long on the way down (`dur = (Z_TOP − stop) × 900`). */
export const DIVE_MS_PER_ZOOM_STEP = 900;
/**
 * How a play slows toward a floor it must not pass (a band still baking what lies there, `DiveControls.tick`): the gap
 * to the floor shrinks by e^(−Δt / `timeConstantMs`) a frame, so the fall eases in rather than stopping dead, never
 * closer than `minGapZoom`, and whatever the frame rate it is as near the floor as it may be.
 */
export const DIVE_FLOOR_EASE = { timeConstantMs: 120, minGapZoom: 1e-4 } as const;
/** Halvings the ease's inverse takes: 2^−40 of the fall, far under a pixel. */
export const DIVE_EASE_INVERSE_STEPS = 40;
/** The lobby plays phase 1's opening on its own this long after it first draws, unless motion is reduced. */
export const DIVE_AUTOPLAY_DELAY_MS = 900;

// ===== The bands (dive-bands.ts) =====

/**
 * A band's window in zoom: it fades in from `fadeFromZoom` (weight 0) to `fadeToZoom` (weight 1) on the way down,
 * and stops drawing at or below `cutAtZoom`. `null` fade: always at full weight; `null` cut: no zoom cut (a band
 * with a camera cut, the slime and the dish, says so in `dive-bands.ts`).
 */
export interface DiveBandWindow {
  readonly fadeFromZoom: number | null;
  readonly fadeToZoom: number | null;
  readonly cutAtZoom: number | null;
}

/** The planet, the map and the forest on the GL layer (`glOn = z > 1.35`). */
export const DIVE_PLANET_WINDOW: DiveBandWindow = { fadeFromZoom: null, fadeToZoom: null, cutAtZoom: 1.35 };
/** The coast in metres and the shore over the globe (`worldA = sstep(4.85, 4.4)`, `drawShore` while `z > -1.42`). */
export const DIVE_SHORE_WINDOW: DiveBandWindow = { fadeFromZoom: 4.85, fadeToZoom: 4.4, cutAtZoom: -1.42 };
/** The boulder and the stranded bull kelp (`drawFocal`: `sstep(2.4, 2.1)`, while `z > -1.42`). */
export const DIVE_KELP_WINDOW: DiveBandWindow = { fadeFromZoom: 2.4, fadeToZoom: 2.1, cutAtZoom: -1.42 };
/** The blade's beads of spray and the drop (`drawBeads`: `sstep(.35, .05)`; the blade close-up while `z > -2.96`). */
export const DIVE_DROP_WINDOW: DiveBandWindow = { fadeFromZoom: 0.35, fadeToZoom: 0.05, cutAtZoom: -2.96 };
/** Inside the drop: the kelp's cells, the slime, the diatoms and the ciliates (`inA = sstep(-1.95, -2.35)`). */
export const DIVE_SLIME_WINDOW: DiveBandWindow = { fadeFromZoom: -1.95, fadeToZoom: -2.35, cutAtZoom: null };
/** The dish in the game's own renderer: the dark field arrives (`darkfield = sstep(-3.7, -4.22)`). */
export const DIVE_DISH_WINDOW: DiveBandWindow = { fadeFromZoom: -3.7, fadeToZoom: -4.22, cutAtZoom: null };
/** The game's dish is drawn only once it is this many CSS px across in radius (`drawDish`: `R * s < 2`). */
export const DIVE_DISH_MIN_RADIUS_PX = 2;

// ===== The dish scene (the micro end, dive-micro-scene.ts) =====

/** The dish is a pocket of clear water this wide in the slime (`POCKET_R` × 2). */
export const DIVE_DISH_DIAMETER_M = 40e-6;
/** Metres per world unit: the game's dish (`DISH_RADIUS` wu) is the pocket. */
export const DIVE_METRES_PER_WU = (DIVE_DISH_DIAMETER_M * HALF) / DISH_RADIUS;
/** You, across (`YOU.L`): the scene's own cell is drawn at this size, so its mass is derived from it. */
export const DIVE_OWN_CELL_DIAMETER_M = 1.6e-6;
/** The seed the dive's texture bundle and its scene are drawn from, so a screenshot is reproducible. */
export const DIVE_SEED = 795;
/** The seat the scene's cell sits in: the first, Cyan (the mockup's `YOU_BASE`). */
export const DIVE_OWN_AVATAR_INDEX = 0;
/** Bacteria in the dish (`drawBacteria`'s in-dish density over the 40 µm pocket), drawn as wild cells. */
export const DIVE_BACTERIA_COUNT = 18;
/**
 * A bacterium's width: a wild cell this wide, its mass derived. The mockup's rods run 1.1–2.6 µm; the dish's stop
 * at your size, so none is big enough to engulf you and none wears the game's warning ring in the opening.
 */
export const DIVE_BACTERIUM_DIAMETER_M = { smallest: 1.1e-6, largest: 1.6e-6 } as const;
/** Specks of food in the dish (`drawBacteria`'s motes inside the pocket). */
export const DIVE_MOTE_COUNT = 24;
/** The fraction of the dish radius the scene scatters its food across, clear of the wall. */
export const DIVE_FOOD_SPREAD_FRACTION = 0.9;
/** The clear disc round your cell, in its radii, where no food is scattered. */
export const DIVE_OWN_CELL_CLEARANCE_RADII = 2;
/** How far a bacterium drifts round its place (`amp = .35e-6` m), and how long one round takes. */
export const DIVE_BACTERIUM_DRIFT_M = 0.35e-6;
export const DIVE_BACTERIUM_DRIFT_PERIOD_SECONDS = 18;

// ===== The readout, the scale bar and the labels =====

/** The scale bar covers at most this fraction of the view's width (`drawScaleBar`). */
export const DIVE_SCALE_BAR_VIEW_FRACTION = 0.18;
/** The bar's length is the largest of these × a power of ten that fits. */
export const DIVE_SCALE_BAR_MANTISSAS = [5, 2, 1] as const;
/** A label fades in and out over this much zoom at each end of its range (`labelAlpha`'s `e`). */
export const DIVE_LABEL_FADE_ZOOM = 0.18;
/** The place names on the planet fade out below `fromZoom + spanZoom` (`geoA`). */
export const DIVE_GEO_LABEL_FADE = { fromZoom: 3.9, spanZoom: 0.5 } as const;
/** A place name further than this from the view's centre (radians on the sphere) is on the far side. */
export const DIVE_GEO_LABEL_MAX_ARC_RADIANS = 1.4;
/** A label's text sits this far right of and above its dot (`drawLabel`). */
export const DIVE_LABEL_OFFSET_PX = 10;
/** A label is skipped when its dot is further than this outside the view. */
export const DIVE_LABEL_CULL_PX = { x: 50, y: 20 } as const;
/** The label keeps this far inside the view's left and right edges, and its baseline this far from the top. */
export const DIVE_LABEL_EDGE_PX = { side: 8, top: 16 } as const;
/** The text's width per character, for flipping a label left of its dot at the right edge (14 px caps). */
export const DIVE_LABEL_CHARACTER_WIDTH_PX = 8.5;
/** The room a label needs past its text at the view's right edge before it flips left (`w + 12`). */
export const DIVE_LABEL_PADDING_PX = 12;

/** The readout's length units, largest first (`fmtLen`): a length is written in the first unit it reaches. */
export const DIVE_LENGTH_UNITS: readonly { readonly metres: number; readonly symbol: string }[] = [
  { metres: 1e3, symbol: 'km' },
  { metres: 1, symbol: 'm' },
  { metres: 1e-2, symbol: 'cm' },
  { metres: 1e-3, symbol: 'mm' },
  { metres: 1e-6, symbol: 'µm' },
  { metres: 1e-9, symbol: 'nm' },
];
/** A length this close under a unit still reads in it (1 km, not 999 m, for 0.9995 km). */
export const DIVE_LENGTH_UNIT_TOLERANCE = 0.999;
/** At and above this many units a length is a whole number with thousands separators. */
export const DIVE_LENGTH_GROUPED_FROM = 100;
/** At and above this many units a length is a whole number; below it, one decimal (dropped when it is 0). */
export const DIVE_LENGTH_WHOLE_FROM = 10;
/** The readout's powers of ten run from the dive's bottom to its top (`LADDER`'s rows). */
export const DIVE_LADDER_POWER_RANGE = { lowest: -6, highest: 7 } as const;
/**
 * The label's backing box round its text: this much on each side, its top this far above the text's baseline, and
 * its height (the panel's `.label`).
 */
export const DIVE_LABEL_BOX = { sidePx: 4, ascentPx: 13, heightPx: 18 } as const;
/** Two labels that would overlap stack: the lower one moves down to this far under the other's box. */
export const DIVE_LABEL_STACK_GAP_PX = 2;
/**
 * Two labels on one line closer than this side by side read as one ("EURASIA PACIFIC OCEAN"), so they stack too. It
 * also covers an estimated width's error before the panel has measured the boxes (ticket #805).
 */
export const DIVE_LABEL_SIDE_GAP_PX = 8;
/**
 * The readout's corner of the stage until the panel has measured its box (ticket #805): its longest line runs to
 * about 408 px on the 1280 stage. A label whose box would sit in it moves down below it, so no label prints over the
 * field of view. The width never passes the stage's.
 */
export const DIVE_READOUT_KEEP_OUT_PX = { right: 408, bottom: 120 } as const;
/** A label keeps this far clear of the readout's measured box, past its edge. */
export const DIVE_READOUT_CLEARANCE_PX = 4;
/** A label flipped left of its dot ends this much further from it than the offset (`X − 10 − w − 8`). */
export const DIVE_LABEL_FLIP_GAP_PX = 8;
/** The share of the dish's specks that are detritus (the mockup's lipid specks); the rest are algae. */
export const DIVE_DETRITUS_SHARE = 0.2;

// ===== The session (dive-session.ts) =====

/**
 * The ratio the dive's texture bundle bakes at, whatever the screen's: the organelle atlas's highest, so your cell
 * keeps its detail at the dive's bottom, where it is far larger on screen than any cell in play.
 */
export const DIVE_BAKE_DEVICE_PIXEL_RATIO = ORGANELLE_ATLAS_MAX_DPR;
/** The dive renders at most at this device pixel ratio when still (`DPR_STEPS[0]`)… */
export const DIVE_MAX_DEVICE_PIXEL_RATIO = 2;
/** …and its upper bands' canvas at this one while the dive moves, where the motion hides it (`DIVE_DPR`). */
export const DIVE_MOVING_DEVICE_PIXEL_RATIO = 1.5;
/**
 * The upper bands' texture bakes run in slices of this long, one every `DIVE_BAKE_INTERVAL_MS`, until every tile is
 * made (`pump`'s 8 ms slice on a 10 ms timer), starting `DIVE_BAKE_START_DELAY_MS` after the dive opens.
 */
export const DIVE_BAKE_BUDGET_MS = 8;
export const DIVE_BAKE_INTERVAL_MS = 10;
export const DIVE_BAKE_START_DELAY_MS = 60;
/** The evidence probe's frame step (`probeFrames`): one display frame at 60 Hz. */
export const DIVE_PROBE_FRAME_MS = 1000 / 60;
/** The dive's Pixi canvas, named apart from a room's `game-canvas` so a smoke waiting for that never finds this. */
export const DIVE_CANVAS_TEST_ID = 'dive-canvas';
/** The coastlines, loaded with the dive and never in the game bundle (Natural Earth, rings of [lon, lat]). */
export const DIVE_WORLD_RINGS_URL = 'assets/dive/world-rings.json';
export const DIVE_SALISH_RINGS_URL = 'assets/dive/salish-rings.json';
