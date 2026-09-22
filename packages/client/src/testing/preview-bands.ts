// Measuring the two framing bands of docs/architecture/encyclopedia.md §12.7 for a preview scene — test-only, out of
// `preview-framing.spec.ts` for its line limit. **Nothing here is taken from `cells/cell-draw-extent.ts`, and that
// is the point.** A scene frames its lens from that module's bound; this measures what the renderer draws, with the
// renderer's own pieces — `buildShapeTerms` over the clips `MotionClipPlayer` plays and the engulf terms
// `engulfClipInput` reads off the views (both turned into the deformation by `cells/cell-clips.ts`), the tail from
// `flagellumPolyline`, the sprites from `effects/effect-sprites.ts`'s `effectPlacements`; only the walk and the
// bookkeeping are this file's. Asking the bound for the tail, as this did before PR #486's review, made the fill
// guard unfailable on exactly the rows where the tail binds.

import {
  COSMETIC_SUB_STREAM,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIP,
  MOTION_CLIPS,
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  maxSpeedForMass,
  type CellView,
  type MotionClipId,
  type RandomSource,
} from '@evolution/shared';
import {
  REST_CLIP_INPUT,
  clipDeformation,
  sampleClipTracks,
  type ClipTrackValues,
} from '../app/game/render/cells/cell-clips';
import { cellClipStarts } from '../app/game/render/cells/cell-effects';
import { engulfClipInput, type CellViewsById } from '../app/game/render/effects/cell-clip-tracker';
import { summariseCellTraits, type CellTraitSummary } from '../app/game/render/cells/cell-traits';
import {
  FLAGELLUM_TRAIT,
  flagellumPolyline,
  flagellumTailCount,
  type FlagellumSpec,
} from '../app/game/render/cells/flagellum-lines';
import { evaluateProfile } from '../app/game/render/cells/radial-profile';
import { buildShapeTerms, headingOf, type ShapeTerms } from '../app/game/render/cells/shape-terms';
import {
  CILIA_OUTER_RADII,
  NOISE_STRIP_ROWS,
  PREVIEW_EAT_APPROACH_TURNS,
  PREVIEW_SEED,
} from '../app/game/render/constants';
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
 * The cosmetic phase and strip row `CellRenderState` would draw this cell with, in its order. **Cached by cell id,
 * and only what that key is valid for**: both draws come from `fork(cosmetic).fork(cell:<id>)`, whose sole variable
 * is the id (the two string-hashing forks put the bands spec on vitest's RPC timeout). The trait summary is not in
 * here — it is pure in the stage and traits, not the identity, and every cell-family preview shares one id.
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
/** A cell with no others on the lens: it can be engulfing nobody. */
const ALONE: CellViewsById = new Map();

/**
 * The eat clip's bumps need an angle: the `eat` scene's mote arrives on `PREVIEW_EAT_APPROACH_TURNS` and its
 * effect sits on the membrane there, which is where `cellClipStarts` aims the clip in play.
 */
const AIMED_AT_THE_APPROACH = PREVIEW_EAT_APPROACH_TURNS * RADIANS_PER_FULL_TURN;

export interface CellExtentsWu {
  /** The membrane at its widest: `maxRadii` with the halo taken back out. */
  readonly bodyWu: number;
  /** The widest anything is drawn: the halo, the flagellum's tip past the membrane, the cilia, or an effect sprite. */
  readonly drawnWu: number;
}

/**
 * The extents the renderer would build for `cell` this tick, with the clips it is actually playing. **The clips
 * are not decoration here**: an `eat` pulses the membrane to 1.09 and wraps it 0.14 further, a `level_up` draws
 * ripples past three radii, an engulf's arms reach 0.62 further. Measured against the resting deformation — as this
 * did while no scene emitted effects — every one would read as a resting cell and pass a lens that clips it.
 */
export function cellExtents(
  cell: CellView,
  timeSeconds: number,
  player: MotionClipPlayer = RESTING_PLAYER,
  cellsById: CellViewsById = ALONE,
): CellExtentsWu {
  const nowMs = timeSeconds * MILLISECONDS_PER_SECOND;
  const speed = Math.hypot(cell.velocityX, cell.velocityY);
  const speedRatio = Math.min(1, speed / maxSpeedForMass(cell.mass, BALANCE.growth));
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
    deformation: drawnDeformation(cell, tracks, cellsById),
  });
  const bodyRadii = terms.maxRadii / terms.haloOuterRadii;
  return {
    bodyWu: bodyRadii * cell.radius,
    // The renderer's own reach, tail and sprites (the file comment): the drawing, never the bound the scene framed by.
    drawnWu: Math.max(
      terms.maxRadii * cell.radius,
      ciliaReachWu(traits, bodyRadii, cell),
      tailTipWu(cell, terms, timeSeconds, phase),
      effectSpriteExtentWu(cell, player, nowMs),
    ),
  };
}

/**
 * The eat bumps aim at the mote, which the `eat` scene brings in along its approach line; the engulf arms aim at
 * the prey the view names, read exactly as the clip tracker reads them — from the frame's own cells.
 */
function drawnDeformation(cell: CellView, tracks: ClipTrackValues, cellsById: CellViewsById) {
  return clipDeformation({
    ...REST_CLIP_INPUT,
    tracks,
    moteAngle: AIMED_AT_THE_APPROACH,
    ...engulfClipInput(cell, cellsById),
  });
}

/** The hairs reach `CILIA_OUTER_RADII − 1` past the membrane (`cell-shader-tells.ts`'s `CILIA_REACH`). */
function ciliaReachWu(traits: CellTraitSummary, bodyRadii: number, cell: CellView): number {
  if (traits.ciliaCount <= 0) return 0;
  return (bodyRadii + (CILIA_OUTER_RADII - 1)) * cell.radius;
}

/**
 * The furthest point of the cell's actual tails, in wu — `flagellumPolyline` over the frame's own terms, rooted as
 * `cell-layer.ts`'s `flagellumSpec` roots it: on the membrane **at the rear**, which the speed stretch tapers and
 * the bound (rooted at the *widest* membrane) does not — the whole point of measuring rather than bounding.
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
 * `(previousTick, tick]`, so walking every tick against itself — `frameAt(tick, tick)`, as this did while no scene
 * emitted anything — collects no effects at all, and the action scenes would be measured with no clip ever
 * started: a guard that passes because it looked at nothing. Each cell keeps its own `MotionClipPlayer`, as the
 * cell layer does, so a clip runs for its own duration and is pruned by the player's own rule.
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
    const cellsById: CellViewsById = new Map(frame.cells.map((cell) => [cell.id, cell]));
    for (const cell of frame.cells) {
      const extents = cellExtents(cell, tick * TICK_INTERVAL_S, playerFor(cell.id), cellsById);
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
 * The worst body and worst drawn reach over **every tick of one loop**, as fractions of the lens radius. Two
 * assertions per scene rather than two per body per tick is not a coverage cut — every tick is measured — it is what
 * keeps the bands spec off vitest's RPC timeout (~50 000 `expect`s tipped over 5 s under load); the memo is the
 * other half, since several tests want the same walk for the same specs.
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
