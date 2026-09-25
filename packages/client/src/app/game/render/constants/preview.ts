// The encyclopedia preview's own numbers (docs/architecture/encyclopedia.md §12.7, docs/CODE-STANDARDS.md §2): the
// fixture seed and gel patch, the framing each scene family is authored at, the lens band, the canvas bounds
// and the two budgets. **Framing only.** Every timing a scene plays at comes from the live balance
// (`engulfPhaseSpanSeconds`, `BACTERIUM_DRIFT_SPEED`, the sprint spans), never from this page, so a balance patch
// retimes a preview as it plays. `render/` imports nothing from `encyclopedia/` or the UI kit (§12.8), so nothing
// here is computed from `ENCYCLOPEDIA_LENS_DIAMETER_PX` or the kit's scale maximum; #373 pins their product
// against `PREVIEW_CANVAS_MAX_PX` from the encyclopedia side.

import {
  DISH_RADIUS,
  SHALLOWS_WIDTH,
  VENT_RADIUS,
  ZONE_ID,
  type GelPatchView,
  type OwnedTrait,
  type TraitTier,
  type ZoneId,
} from '@evolution/shared';
import { HALF } from '../geometry';

/** The one seed every preview texture bundle is baked from, so a seeded screenshot is reproducible. */
export const PREVIEW_SEED = 907;

/**
 * The DPR ceiling the preview renders and bakes at. A 3× display shows the canvas upscaled 1.5× rather than
 * baking 3× atlases for a lens that is a fraction of the screen (§12.7).
 */
export const PREVIEW_MAX_DEVICE_PIXEL_RATIO = 2;

/**
 * Each canvas side is clamped to this many **device** pixels; at the cap the GPU buffers are about 10 MiB (§12.7).
 *
 * 900 is not a round number picked for room: it is exactly `ENCYCLOPEDIA_LENS_DIAMETER_PX` 300 × `UI_SCALE_MAX` 1.5
 * × `PREVIEW_MAX_DEVICE_PIXEL_RATIO` 2, the product #373 pins from the encyclopedia side. There is **no headroom**,
 * so raising any of those three without raising this one makes the lens clamp silently (§12.7).
 */
export const PREVIEW_CANVAS_MAX_PX = 900;

/**
 * Every subject **body** lies inside this fraction of the lens radius; its **appendages** (a flagellum, cilia,
 * pseudopods) may reach into the band between here and the rim, and nothing drawn reaches past the rim (§12.7).
 */
export const PREVIEW_LENS_SAFE_RADIUS_FRACTION = 0.8;

/** The rim: the lens radius itself, the fraction nothing drawn may pass (§12.7). */
export const PREVIEW_LENS_RIM_RADIUS_FRACTION = 1;

/**
 * How far inside its band a scene frames its subject. The two bands above are **limits**, not targets: a subject
 * framed to exactly its limit has its outline sitting in the vignette or on the crop. One margin serves both, so
 * the two fill fractions below cannot drift past the bands they belong to.
 */
export const PREVIEW_LENS_FILL_MARGIN = 0.05;

/** `openedToFirstFrameMs` p95 over 20 opens, the cold first open reported apart (§12.7's cost table). */
export const PREVIEW_OPEN_BUDGET_MS = 300;
/** The preview frame's own CPU work outside its submit, p95, warm-up frames excluded (§12.7's cost table, #502). */
export const PREVIEW_FRAME_BUDGET_MS = 1;

/**
 * The `level` a preview cell carries when nothing on the lens draws one — which is every scene in ticket #363,
 * since the own-cell indicators stand down under `NO_HUD_INPUTS`. A scene that needs a real level sets one.
 */
export const PREVIEW_UNUSED_LEVEL = 0;

/** A scene with no motion of its own still loops, so the effect look-back has a period to clamp to. */
export const PREVIEW_STILL_PERIOD_SECONDS = 6;

// ===== The cell family =====

/** The mass a single-cell preview is drawn at: its radius is `radiusForMass(this, balance.growth)`. */
export const PREVIEW_CELL_MASS = 100;

/**
 * A cell scene's lens is **derived, not tuned**: `cell-scene.ts` frames it from the subject's own drawn extent
 * (`cells/cell-draw-extent.ts`) so that whichever of the two bands binds is filled to here.
 *
 * It replaced a single `PREVIEW_CELL_VIEW_RADII` of 4.4 (ticket #364). That one number had to keep a tier-III
 * flagellate's whole tail inside the rim, and a tail is `FLAGELLUM_LENGTH_RADII` 2 plus its wave — about 2.5 radii
 * of mostly empty lens that a bare protocell, which has no tail at all, was framed for anyway. It left a
 * protocell's body at 0.26 of the lens radius against a 0.8 band, so the reader saw a speck in an eyepiece on
 * every trait and stage page. No single constant serves both: at 4.4 a swimming flagellate's tail already reaches
 * 0.97 of the rim, so there was nothing to give back.
 */
export const PREVIEW_CELL_BODY_FILL_FRACTION = PREVIEW_LENS_SAFE_RADIUS_FRACTION - PREVIEW_LENS_FILL_MARGIN;
export const PREVIEW_CELL_DRAWN_FILL_FRACTION = PREVIEW_LENS_RIM_RADIUS_FRACTION - PREVIEW_LENS_FILL_MARGIN;

/**
 * How far from the lens centre a swimming subject circles, in its own radii — and therefore, since the cell walks
 * that circle at its **own top speed**, how long a lap takes: `2πR / CELL_BASE_SPEED`. Widening the orbit is the
 * only way to slow it that keeps the stretch, the flagellum wave and the cilia beat reading the speed ratio the
 * simulation would have given it.
 *
 * **1.2 is the human's decision on ticket #488, option B**, taken over 0.4 knowing its cost. At 0.4 the lap took
 * 0.683 s — about 1.5 orbits a second — which was an invisible jiggle while the lens was 4.4 radii wide and
 * became a fast circuit once ticket #364's framing fix nearly doubled the subject. At 1.2 the lap took 2.05 s at
 * mass 100's old curve speed (1.37 s at the flat `CELL_BASE_SPEED` since ticket #677), and the lens grows to hold the wider circle, so a protocell's body fills about 0.37 of the lens rather than
 * 0.75. Tempo bought with size, deliberately: do not "recover" the size by narrowing this again.
 */
export const PREVIEW_SWIM_RADIUS_RADII = 1.2;

/**
 * The share of its own top speed a swimming subject circles at. The human asked for a lap four times slower
 * (2026-09-23): 0.25 made the 2.05 s lap about 8.2 s (5.5 s since ticket #677 lifted mass 100 to the flat top
 * speed) without widening the orbit (which would shrink the cell),
 * and the stretch, tail wave and cilia beat read that cruising speed rather than a sped-up full-speed swim.
 */
export const PREVIEW_SWIM_SPEED_FRACTION = 0.25;

// ===== The action family (#364) =====

/** Mid-ladder: every trait the action subject owns sits at tier II. */
const PREVIEW_ACTION_SUBJECT_TIER: TraitTier = 2;

/**
 * The cell the `eat`, `sprint` and `level_up` scenes act with. These entries are about the **action**, so the
 * subject is one fixed cell across all three rather than the entry's own traits: a reader comparing `eat` with
 * `sprint` should see the same creature doing two different things. It owns a flagellum so the speed stretch and
 * the tail read as motion, and a nucleoid and ribosomes so the body is not a bare protocell.
 */
export const PREVIEW_ACTION_SUBJECT_TRAITS: readonly OwnedTrait[] = [
  { traitId: 'nucleoid', tier: PREVIEW_ACTION_SUBJECT_TIER },
  { traitId: 'simple_flagellum', tier: PREVIEW_ACTION_SUBJECT_TIER },
  { traitId: 'ribosomes', tier: PREVIEW_ACTION_SUBJECT_TIER },
];

/**
 * The level the action subject wears where its own-cell record draws (the `sprint` scene's ring and ladder). A
 * real mid-ladder number rather than `PREVIEW_UNUSED_LEVEL`, which would put a level-zero pip on the orbit.
 */
export const PREVIEW_ACTION_SUBJECT_LEVEL = 3;

/** The still beat between one loop of an action and the next, so a reader sees the action begin. */
export const PREVIEW_ACTION_REST_SECONDS = 0.9;

/** Where the mote the `eat` scene swallows starts, in the subject's radii, and the angle it comes in on. */
export const PREVIEW_EAT_APPROACH_RADII = 2.6;
export const PREVIEW_EAT_APPROACH_TURNS = 0.07;
/**
 * How long the mote takes to drift in from there; the eat fires when it arrives. **A whole number of ticks**
 * (1.1 / `TICK_INTERVAL_S` is exactly 66): the mote is removed by the same tick the eat is emitted at, and the
 * two compare a loop time against this number, so a value that is not a whole tick would let them disagree by a
 * frame (ticket #505). The two-cell scenes quantise their timeline to ticks instead (`engulf-pair.ts`).
 */
export const PREVIEW_EAT_APPROACH_SECONDS = 1.1;
/** The mass and DNA the scene's `eat` effect reports — the floater reads them, nothing else does. */
export const PREVIEW_EAT_MASS_GAINED = 4;
export const PREVIEW_EAT_DNA_GAINED = 2;

/** The level the `level_up` scene climbs to; the only preview that draws a real one. */
export const PREVIEW_LEVEL_UP_LEVEL = 4;

// ===== The two-cell action family: `engulf` and `escape` (#364, PR 3) =====

/** The partner's traits sit at tier I: a plain body, so the pair's lens is set by the two bodies and nothing else. */
const PREVIEW_ENGULF_PARTNER_TIER: TraitTier = 1;

/**
 * The cell across from the subject in `engulf` (its prey) and `escape` (its predator). The subject stays the
 * action subject above, so a reader sees the same creature engulf and be engulfed; the partner has no tail, since
 * a second flagellum would bind the lens for a body that is not the point, and it wears the second palette so
 * the two read apart at a glance.
 */
export const PREVIEW_ENGULF_PARTNER_TRAITS: readonly OwnedTrait[] = [
  { traitId: 'nucleoid', tier: PREVIEW_ENGULF_PARTNER_TIER },
  { traitId: 'ribosomes', tier: PREVIEW_ENGULF_PARTNER_TIER },
];

/** The partner comes in on this heading from the subject, and the escaping prey flees the other way along it. */
export const PREVIEW_ENGULF_APPROACH_TURNS = 0.6;

/** The clear water between the two membranes where the partner starts, in subject radii. */
export const PREVIEW_ENGULF_START_GAP_RADII = 0.3;

/**
 * How far a held prey sinks toward its predator's centre by the seal, as a fraction of the contact reach it was
 * caught at: 1 would hold it where the membrane first covered it. Progress-driven, like the arms, so a decaying
 * escape plays it backwards.
 */
export const PREVIEW_ENGULF_SINK_FRACTION = 0.6;

/**
 * How far through the wrap band the escaping prey starts its sprint. Late enough that the arms have closed and
 * the escape arc has visibly drained, early enough that the decay back to the cover band is what releases it.
 */
export const PREVIEW_ESCAPE_SPRINT_AT_WRAP_SHARE = 0.5;

// ===== The food and DNA-fragment families =====

/** Motes in a food cluster: inside the ≤ 40 the §12.7 cost table budgets the preview frame at. */
export const PREVIEW_FOOD_COUNT = 24;
/** The disc the cluster is seeded in (wu). */
export const PREVIEW_FOOD_CLUSTER_RADIUS_WU = 52;
/** The lens's world radius for a food cluster (wu). */
export const PREVIEW_FOOD_VIEW_RADIUS_WU = 88;
/** The circle each bacterium drifts around (wu); it travels it at the balance's `BACTERIUM_DRIFT_SPEED`. */
export const PREVIEW_FOOD_DRIFT_RADIUS_WU = 14;

export const PREVIEW_FRAGMENT_COUNT = 7;
export const PREVIEW_FRAGMENT_CLUSTER_RADIUS_WU = 30;
export const PREVIEW_FRAGMENT_VIEW_RADIUS_WU = 56;

// ===== The zone family =====

/** The lens's world radius for a zone scene (wu): a patch of dish, wide enough for the zone's own texture to read. */
export const PREVIEW_ZONE_VIEW_RADIUS_WU = 420;

/**
 * The one gel patch the preview bundle's dish field is baked with, so the `viscous_gel` zone scene has a patch to
 * park on. It sits in the open broth, clear of the vent and the shallows, and `preview-scene.spec.ts` pins that
 * `zoneAt` reads each zone target as its own zone.
 */
export const PREVIEW_GEL_PATCH: GelPatchView = { x: 0, y: 1400, radius: 320 };
export const PREVIEW_GEL_PATCHES: readonly GelPatchView[] = [PREVIEW_GEL_PATCH];

/** Where the camera parks for each zone: a point that `zoneAt` reads as that zone (`simulation/zones.ts`). */
export const PREVIEW_ZONE_CENTRE_WU: Readonly<Record<ZoneId, { readonly x: number; readonly y: number }>> = {
  [ZONE_ID.warmVent]: { x: 0, y: 0 },
  [ZONE_ID.sunlitShallows]: { x: 0, y: DISH_RADIUS - SHALLOWS_WIDTH * HALF },
  [ZONE_ID.viscousGel]: { x: PREVIEW_GEL_PATCH.x, y: PREVIEW_GEL_PATCH.y },
  // Between the vent's rim and the gel patch, on the far side of the dish centre from the patch.
  [ZONE_ID.openBroth]: { x: 0, y: -(VENT_RADIUS + PREVIEW_ZONE_VIEW_RADIUS_WU) },
};
