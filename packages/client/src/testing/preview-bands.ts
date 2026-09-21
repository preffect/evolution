// Measuring the two framing bands of docs/architecture/encyclopedia.md §12.7 for a preview scene — test-only, and
// here rather than beside the spec because two spec files read it and because `preview-framing.spec.ts` is at its
// line limit.
//
// **What it measures is what the renderer would draw, not what the scene says.** The membrane comes from the real
// `buildShapeTerms` over the real cosmetic fork; the clips come from the real `MotionClipPlayer`, fed the scene's
// own effects; the effect sprites come from the real `effectPlacements`. Only the appendages are taken from
// `cells/cell-draw-extent.ts` — the module a scene frames its lens by — so that the measurement stays independent
// of the bound it is checking, while neither side keeps a private copy of how long a flagellum is.

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
import { appendageReachRadii } from '../app/game/render/cells/cell-draw-extent';
import { cellClipStarts } from '../app/game/render/cells/cell-effects';
import { summariseCellTraits } from '../app/game/render/cells/cell-traits';
import { buildShapeTerms, headingOf } from '../app/game/render/cells/shape-terms';
import { NOISE_STRIP_ROWS, PREVIEW_SEED } from '../app/game/render/constants';
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
 * `createSeededRandom(PREVIEW_SEED).fork(cosmetic).fork(cell:<id>)`, whose sole variable is the id, so the id is
 * the whole key — and those two string-hashing forks were the cost that put the bands spec on vitest's RPC
 * timeout.
 *
 * The trait summary is deliberately **not** in here. It is pure in the cell's stage and traits, not its identity,
 * and every `cell`-family preview shares one id, so caching it under the id handed every spec the first one's
 * traits: all eleven collapsed to two measurements, split by motion alone.
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

interface CellExtentsWu {
  /** The membrane at its widest: `maxRadii` with the halo taken back out. */
  readonly bodyWu: number;
  /** The widest anything is drawn: the halo, the flagellum's tip, the cilia, or an effect sprite. */
  readonly drawnWu: number;
}

/**
 * The extents the renderer would build for `cell` this tick, with the clips it is actually playing.
 *
 * **The clips are not decoration here.** An action scene's `eat` pulses the membrane to 1.09 of its radius and
 * wraps it 0.14 further; a `level_up` draws ripples past three radii, which is several times the cell. Measuring
 * these frames against `REST_DEFORMATION` — as this file did while no scene emitted effects — would report a
 * resting cell and pass a lens that clips the burst. `player` is the renderer's own `MotionClipPlayer`, fed the
 * scene's own effects, so what is measured is what would be drawn.
 */
function cellExtents(cell: CellView, timeSeconds: number, player: MotionClipPlayer): CellExtentsWu {
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
    // The membrane and the effect sprites are **measured** — what the renderer built this tick, and what
    // `effectPlacements` would place around it — and only the appendages come from `cell-draw-extent.ts`, the
    // module the scene frames by. Taking the whole extent from there would leave this file checking a bound
    // against itself; taking the tail's length from a local copy would leave the two free to drift apart.
    drawnWu: Math.max(
      terms.maxRadii * cell.radius,
      appendageReachRadii(traits, bodyRadii, terms.isSprinting) * cell.radius,
      effectSpriteExtentWu(cell, player, nowMs),
    ),
  };
}

/** The eat clip's bumps need an angle; the subject eats what arrives at its own centre, so it is this one. */
const AIMED_AT_THE_CENTRE = 0;

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
 * other half of that: several tests want the same walk for the same specs, and walking twice was twice the cost.
 */
export function worstBandsOf(spec: PreviewSpec): WorstBands {
  const cached = worstBandsBySpec.get(spec);
  if (cached !== undefined) return cached;
  const walked = walkWorstBands(spec);
  worstBandsBySpec.set(spec, walked);
  return walked;
}

export function reportBand(band: WorstBand): string {
  return `${band.what} reached ${band.fraction.toFixed(3)} of the lens radius at tick ${band.atTick}`;
}
