// Measuring the two framing bands of docs/architecture/encyclopedia.md §12.7 for a preview scene — test-only, and
// in its own file because `preview-framing.spec.ts` is at its line limit.
//
// **Nothing here is taken from `cells/cell-draw-extent.ts`, and that is the point.** A scene frames its lens from
// that module's bound; this measures what the renderer would actually draw — the membrane from the real
// `buildShapeTerms` over the clips the real `MotionClipPlayer` is playing, the tail from the real
// `flagellumPolyline` over the same terms, the effect sprites from the real `effectPlacements`. Asking the bound
// for the tail, as this did before PR #486's review, made the fill guard unfailable on exactly the rows where the
// tail binds: the same defect class the PR exists to remove, one level up.

import {
  COSMETIC_SUB_STREAM,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIP,
  MOTION_CLIPS,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  maxSpeedForMass,
  type CellView,
  type MotionClipId,
  type RandomSource,
} from '@evolution/shared';
import { REST_CLIP_INPUT, clipDeformation, sampleClipTracks } from '../app/game/render/cells/cell-clips';
import { cellClipStarts } from '../app/game/render/cells/cell-effects';
import { summariseCellTraits, type CellTraitSummary } from '../app/game/render/cells/cell-traits';
import {
  FLAGELLUM_TRAIT,
  flagellumPolyline,
  flagellumTailCount,
  type FlagellumSpec,
} from '../app/game/render/cells/flagellum-lines';
import { evaluateProfile } from '../app/game/render/cells/radial-profile';
import { buildShapeTerms, headingOf, type ShapeTerms } from '../app/game/render/cells/shape-terms';
import { CILIA_OUTER_RADII, NOISE_STRIP_ROWS, PREVIEW_SEED } from '../app/game/render/constants';
import { effectPlacements, type EffectSource } from '../app/game/render/effects/effect-sprites';
import { MotionClipPlayer } from '../app/game/render/effects/motion-clip-player';
import { buildNoiseStrip } from '../app/game/render/noise/noise-strip';
import { previewSceneFor, type PreviewScene } from '../app/game/render/preview/preview-scene';
import type { PreviewSpec } from '../app/game/render/preview/preview-spec';

const BALANCE = DEFAULT_BALANCE;

interface CellDraw {
  readonly phase: number;
  readonly stripRow: number;
}

/**
 * The cosmetic phase and strip row `CellRenderState` would draw this cell with, in its order.
 *
 * **Cached by cell id, and it caches only what that key is valid for.** Both draws come from
 * `createSeededRandom(PREVIEW_SEED).fork(cosmetic).fork(cell:<id>)`, whose sole variable is the id — and those
 * two string-hashing forks were the cost that put the bands spec on vitest's RPC timeout. The trait summary is
 * deliberately not in here: it is pure in the cell's stage and traits, not its identity, and every cell-family
 * preview shares one id, so caching it under the id handed every spec the first one's traits.
 */
const cellDraws = new Map<string, CellDraw>();

function cellDrawOf(cell: CellView): CellDraw {
  const cached = cellDraws.get(cell.id);
  if (cached !== undefined) return cached;
  const cosmetic: RandomSource = createSeededRandom(PREVIEW_SEED)
    .fork(RANDOM_STREAM.cosmetic)
    .fork(`${COSMETIC_SUB_STREAM.cell}:${cell.id}`);
  const built: CellDraw = { phase: cosmetic.nextFloat(), stripRow: cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1) };
  cellDraws.set(cell.id, built);
  return built;
}

const PREVIEW_STRIP = buildNoiseStrip(createSeededRandom(PREVIEW_SEED).fork(RANDOM_STREAM.cosmetic));

/** A player nothing was ever started on: the resting cell, for callers that measure a scene without effects. */
const RESTING_PLAYER = new MotionClipPlayer();

/** The eat clip's bumps need an angle; the subject eats what arrives at its own centre, so it is this one. */
const AIMED_AT_THE_CENTRE = 0;

export interface CellExtentsWu {
  /** The membrane at its widest: `maxRadii` with the halo taken back out. */
  readonly bodyWu: number;
  /** The widest anything is drawn: the halo, the flagellum's tip past the membrane, the cilia, or an effect sprite. */
  readonly drawnWu: number;
}

/**
 * The extents the renderer would build for `cell` this tick, with the clips it is actually playing.
 *
 * **The clips are not decoration here.** An action scene's `eat` pulses the membrane to 1.09 of its radius and
 * wraps it 0.14 further; a `level_up` draws ripples past three radii, which is several times the cell. Measuring
 * these frames against the resting deformation — as this file did while no scene emitted effects — would report a
 * resting cell and pass a lens that clips the burst. `player` is the renderer's own `MotionClipPlayer`, fed the
 * scene's own effects, so what is measured is what would be drawn.
 */
export function cellExtents(
  cell: CellView,
  timeSeconds: number,
  player: MotionClipPlayer = RESTING_PLAYER,
): CellExtentsWu {
  const nowMs = timeSeconds * MILLISECONDS_PER_SECOND;
  const speedRatio = Math.min(
    1,
    Math.hypot(cell.velocityX, cell.velocityY) / maxSpeedForMass(cell.mass, BALANCE.growth),
  );
  const { phase, stripRow } = cellDrawOf(cell);
  const traits = summariseCellTraits(cell);
  const tracks = player.sample(nowMs);
  const terms = buildShapeTerms({
    view: cell,
    traits,
    timeSeconds,
    speedRatio,
    heading: headingOf(cell, speedRatio, 0),
    phase,
    stripRow,
    strip: PREVIEW_STRIP,
    // The eat bumps aim at the mote, which every action scene puts at the subject's own centre.
    deformation: clipDeformation({ ...REST_CLIP_INPUT, tracks, moteAngle: AIMED_AT_THE_CENTRE }),
  });
  const bodyRadii = terms.maxRadii / terms.haloOuterRadii;
  return {
    bodyWu: bodyRadii * cell.radius,
    // **Nothing here is taken from `cell-draw-extent.ts`.** The membrane is the reach the renderer built this
    // tick, the tail is the real `flagellumPolyline` over the same terms, and the sprites are what
    // `effectPlacements` would place — so this file measures the drawing and the scene frames from the bound, and
    // the two can disagree. Asking the bound for the tail, as this did, made the fill guard unfailable on exactly
    // the rows where the tail binds (PR #486 review).
    drawnWu: Math.max(
      terms.maxRadii * cell.radius,
      ciliaReachWu(traits, bodyRadii, cell),
      tailTipWu(cell, terms, timeSeconds, phase),
      effectSpriteExtentWu(cell, player, nowMs),
    ),
  };
}

/** The hairs reach `CILIA_OUTER_RADII − 1` past the membrane (`cell-shader-tells.ts`'s `CILIA_REACH`). */
function ciliaReachWu(traits: CellTraitSummary, bodyRadii: number, cell: CellView): number {
  if (traits.ciliaCount <= 0) return 0;
  return (bodyRadii + (CILIA_OUTER_RADII - 1)) * cell.radius;
}

/**
 * The furthest point of the cell's actual tails, in wu — `flagellumPolyline` over the frame's own terms, rooted
 * where `cell-layer.ts`'s `flagellumSpec` roots it: on the membrane **at the rear**, which the speed stretch
 * tapers. That taper is the whole point of measuring rather than bounding: the bound roots the tail at the cell's
 * *widest* membrane instead, which is a good deal further out than its rear.
 */
export function tailTipWu(cell: CellView, terms: ShapeTerms, timeSeconds: number, phase: number): number {
  const tier = summariseCellTraits(cell).tierOf(FLAGELLUM_TRAIT);
  if (tier === 0) return 0;
  // Exactly the record `cell-layer.ts`'s `flagellumSpec` builds, off this frame's own terms and cosmetic phase.
  const spec: FlagellumSpec = {
    x: cell.x,
    y: cell.y,
    radius: cell.radius * terms.pulse,
    rootRadius: evaluateProfile(terms, terms.heading + Math.PI).r,
    heading: terms.heading,
    tier,
    timeSeconds,
    isSprinting: terms.isSprinting,
    phase,
  };
  let furthest = 0;
  for (let tail = 0; tail < flagellumTailCount(tier); tail += 1) {
    for (const point of flagellumPolyline(spec, tail)) {
      furthest = Math.max(furthest, Math.hypot(point.x - cell.x, point.y - cell.y));
    }
  }
  return furthest;
}

/** The furthest any sprite of the cell's running clips reaches from its centre, in wu; 0 when none plays. */
function effectSpriteExtentWu(cell: CellView, player: MotionClipPlayer, nowMs: number): number {
  const source: EffectSource = { x: cell.x, y: cell.y, radius: cell.radius, colour: '#ffffff', target: null };
  let furthest = 0;
  for (const clipId of Object.values<MotionClipId>(MOTION_CLIP)) {
    const progress = player.progressOf(clipId, nowMs);
    if (progress === null) continue;
    const tracks = sampleClipTracks(MOTION_CLIPS[clipId], progress * MOTION_CLIPS[clipId].duration);
    for (const placement of effectPlacements(clipId, source, tracks, progress)) {
      const centreDistance = Math.hypot(placement.x - cell.x, placement.y - cell.y);
      furthest = Math.max(furthest, centreDistance + Math.hypot(placement.widthWu, placement.heightWu) / 2);
    }
  }
  return furthest;
}

function distanceFrom(target: { readonly x: number; readonly y: number }, point: { x: number; y: number }): number {
  return Math.hypot(point.x - target.x, point.y - target.y);
}

/** Every tick of one loop, at whole ticks, plus the loop's last fractional tick. */
function loopTicks(scene: PreviewScene): number[] {
  const period = scene.periodTicks(BALANCE);
  return [...Array.from({ length: Math.ceil(period) }, (_unused, tick) => tick), period];
}

export interface WorstBand {
  /** The largest fraction of the lens radius anything reached, and the tick it reached it at. */
  readonly fraction: number;
  readonly atTick: number;
  readonly what: string;
}

export interface WorstBands {
  readonly body: WorstBand;
  readonly drawn: WorstBand;
}

const NOTHING_DRAWN: WorstBand = { fraction: 0, atTick: 0, what: 'nothing drawn' };

function worse(current: WorstBand, fraction: number, atTick: number, what: string): WorstBand {
  return fraction > current.fraction ? { fraction, atTick, what } : current;
}

/**
 * The walk is **sequential, and that is load-bearing.** A scene emits the effects whose tick falls in
 * `(previousTick, tick]`, so walking every tick against itself — `frameAt(tick, tick)`, which is what this did
 * while no scene emitted anything — asks for an empty span every time and collects no effects at all. The action
 * scenes would then be measured with no clip ever started, which is the shape of a guard that passes because it
 * looked at nothing.
 *
 * Each cell keeps its own `MotionClipPlayer`, as the cell layer does, so a clip started at its effect's tick runs
 * for its own duration and is pruned by the player's own rule rather than by an assumption made here.
 */
function walkWorstBands(spec: PreviewSpec): WorstBands {
  const scene = previewSceneFor(spec);
  const { target, viewRadiusWu } = scene.framing(BALANCE);
  const players = new Map<string, MotionClipPlayer>();
  const playerFor = (cellId: string): MotionClipPlayer => {
    const existing = players.get(cellId);
    if (existing !== undefined) return existing;
    const created = new MotionClipPlayer();
    players.set(cellId, created);
    return created;
  };
  let body = NOTHING_DRAWN;
  let drawn = NOTHING_DRAWN;
  let previousTick = 0;
  for (const tick of loopTicks(scene)) {
    const frame = scene.frameAt(tick, previousTick, BALANCE);
    previousTick = tick;
    for (const start of cellClipStarts(frame.effects, () => undefined)) {
      playerFor(start.cellId).play(MOTION_CLIPS[start.clipId], tick * TICK_INTERVAL_S * MILLISECONDS_PER_SECOND);
    }
    for (const cell of frame.cells) {
      const extents = cellExtents(cell, tick * TICK_INTERVAL_S, playerFor(cell.id));
      const centre = distanceFrom(target, cell);
      body = worse(body, (centre + extents.bodyWu) / viewRadiusWu, tick, `the body of ${cell.id}`);
      drawn = worse(drawn, (centre + extents.drawnWu) / viewRadiusWu, tick, `the drawn extent of ${cell.id}`);
    }
    for (const mote of frame.motes) {
      drawn = worse(drawn, distanceFrom(target, mote) / viewRadiusWu, tick, `the mote ${mote.id}`);
    }
    for (const fragment of frame.fragments) {
      drawn = worse(drawn, distanceFrom(target, fragment) / viewRadiusWu, tick, `the fragment ${fragment.id}`);
    }
  }
  return { body, drawn };
}

/** Keyed on the spec's identity, which is safe because `SUBJECT_SPECS` holds one stable object per subject. */
const worstBandsBySpec = new Map<PreviewSpec, WorstBands>();

/**
 * The worst body and worst drawn reach over **every tick of one loop**, as fractions of the lens radius.
 *
 * The walk is plain arithmetic and the assertions are two per scene rather than two per body per tick. That is
 * not a coverage cut — every tick is still measured — it is what keeps the bands spec off vitest's RPC timeout:
 * at one `expect` per body per tick it ran ~50 000 assertions and tipped over 5 s under load. The memo is the
 * other half: several tests want the same walk for the same specs, and walking twice was twice the cost.
 */
export function worstBandsOf(spec: PreviewSpec): WorstBands {
  const cached = worstBandsBySpec.get(spec);
  if (cached !== undefined) return cached;
  const walked = walkWorstBands(spec);
  worstBandsBySpec.set(spec, walked);
  return walked;
}

export { PREVIEW_STRIP, cellDrawOf };

export function reportBand(band: WorstBand): string {
  return `${band.what} reached ${band.fraction.toFixed(3)} of the lens radius at tick ${band.atTick}`;
}
