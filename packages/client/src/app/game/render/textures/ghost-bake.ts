// The ladder ghosts (docs/ui/hud.md §3.1.2, docs/rendering/own-cell-indicators.md §10): the dashed silhouette of what the next
// rung draws — the nucleoid loop, the nuclear envelope with its pores, the form's slipper — and of the
// endosymbiont a counter unlocks — the mitochondrion's bean with cristae, the chloroplast's pointed
// lens with granules. Each is `LADDER_GHOST_PX` long with its long axis along x, the way the orbit
// lays it tangent, built back to front: halo, a wash lit from the top-left, a faint continuous trace
// so the outline reads between dashes, the dashes, the signature detail, a glint. CSS px throughout.

import { RADIANS_PER_FULL_TURN, type ValueOf } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  GHOST_ASPECT,
  GHOST_BAKE,
  GHOST_CRISTAE,
  GHOST_GRANULES,
  GHOST_LENS_PATH,
  GHOST_LOOP,
  GHOST_LOOP_THREAD_PATH,
  GHOST_PORES,
  GHOST_SLIPPER_GROOVE_PATH,
  GHOST_SLIPPER_PATH,
  LADDER_GHOST_PX,
  WHITE,
  type IndicatorRamp,
  type SharePath,
} from '../constants';
import { HALF } from '../geometry';
import { LIGHT_DIRECTION_RADIANS } from '../light-direction';
import { tracePolyline } from './soft-paint';
import {
  createPxCanvas,
  fillDisc,
  fillHalo,
  paintGlint,
  type BakeCanvasFactory,
  type BakeContext2D,
  type PxBakedSprite,
} from './texture-bake';

export const GHOST_SHAPE = {
  bean: 'bean',
  lens: 'lens',
  loop: 'loop',
  envelope: 'envelope',
  slipper: 'slipper',
} as const;
export type GhostShape = ValueOf<typeof GHOST_SHAPE>;

/** A silhouette's half-extents in CSS px, centred on the origin. */
interface GhostFrame {
  readonly halfLength: number;
  readonly halfHeight: number;
}

interface Silhouette {
  /** Lays the outline down after `beginPath`. */
  readonly trace: (context: BakeContext2D, frame: GhostFrame) => void;
  /** The signature feature in the ramp's light colour. */
  readonly paintDetail: (context: BakeContext2D, frame: GhostFrame, ramp: IndicatorRamp) => void;
}

/** Lays a share path down at `frame`'s scale (after `beginPath`). */
export function traceSharePath(context: BakeContext2D, path: SharePath, frame: GhostFrame): void {
  const { halfLength: x, halfHeight: y } = frame;
  context.moveTo(path.start[0] * x, path.start[1] * y);
  for (const [control1X, control1Y, control2X, control2Y, endX, endY] of path.segments) {
    context.bezierCurveTo(control1X * x, control1Y * y, control2X * x, control2Y * y, endX * x, endY * y);
  }
}

/** A detail stroke: thin, round-capped, in the ramp's light colour. */
function strokeDetail(context: BakeContext2D, ramp: IndicatorRamp, trace: () => void): void {
  context.strokeStyle = hexWithAlpha(ramp.light, GHOST_BAKE.detailAlpha);
  context.lineWidth = GHOST_BAKE.detailPx;
  context.lineCap = 'round';
  context.beginPath();
  trace();
  context.stroke();
}

/** `count` positions evenly across `spreadShare` of the half-length, centred. */
function spreadAlong(count: number, spreadShare: number, frame: GhostFrame): number[] {
  return Array.from(
    { length: count },
    (_entry, index) => (index / (count - 1) - HALF) * spreadShare * frame.halfLength,
  );
}

function paintCristae(context: BakeContext2D, frame: GhostFrame, ramp: IndicatorRamp): void {
  const reach = GHOST_CRISTAE.heightShare * frame.halfHeight;
  strokeDetail(context, ramp, () => {
    for (const x of spreadAlong(GHOST_CRISTAE.count, GHOST_CRISTAE.spreadShare, frame)) {
      context.moveTo(x, -reach);
      context.quadraticCurveTo(x + GHOST_CRISTAE.bendShare * reach, 0, x, reach);
    }
  });
}

function paintGranules(context: BakeContext2D, frame: GhostFrame, ramp: IndicatorRamp): void {
  for (const x of spreadAlong(GHOST_GRANULES.count, GHOST_GRANULES.spreadShare, frame)) {
    fillDisc(
      context,
      { x, y: 0, radius: GHOST_GRANULES.radiusPx },
      { colour: ramp.light, alpha: GHOST_BAKE.detailAlpha },
    );
  }
}

function paintPores(context: BakeContext2D, frame: GhostFrame, ramp: IndicatorRamp): void {
  for (let pore = 0; pore < GHOST_PORES.count; pore += 1) {
    const angle = LIGHT_DIRECTION_RADIANS + (pore / GHOST_PORES.count) * RADIANS_PER_FULL_TURN;
    const centre = { x: Math.cos(angle) * frame.halfLength, y: Math.sin(angle) * frame.halfHeight };
    const glow = { ...centre, radius: GHOST_PORES.radiusPx * GHOST_PORES.glowReach };
    fillHalo(context, glow, { colour: ramp.light, alpha: GHOST_PORES.glowAlpha });
    fillDisc(
      context,
      { ...centre, radius: GHOST_PORES.radiusPx },
      { colour: ramp.light, alpha: GHOST_BAKE.detailAlpha },
    );
  }
}

function traceLoop(context: BakeContext2D, frame: GhostFrame): void {
  const peak = 1 + GHOST_LOOP.wobbleShare;
  tracePolyline(context, GHOST_LOOP.steps, (share) => {
    const angle = share * RADIANS_PER_FULL_TURN;
    const wobble = (1 + GHOST_LOOP.wobbleShare * Math.sin(angle * GHOST_LOOP.lobes)) / peak;
    return { x: Math.cos(angle) * frame.halfLength * wobble, y: Math.sin(angle) * frame.halfHeight * wobble };
  });
  context.closePath();
}

const SILHOUETTES: Readonly<Record<GhostShape, Silhouette>> = {
  [GHOST_SHAPE.bean]: {
    trace: (context, frame) => context.ellipse(0, 0, frame.halfLength, frame.halfHeight, 0, 0, RADIANS_PER_FULL_TURN),
    paintDetail: paintCristae,
  },
  [GHOST_SHAPE.lens]: {
    trace: (context, frame) => traceSharePath(context, GHOST_LENS_PATH, frame),
    paintDetail: paintGranules,
  },
  [GHOST_SHAPE.loop]: {
    trace: traceLoop,
    paintDetail: (context, frame, ramp) =>
      strokeDetail(context, ramp, () => traceSharePath(context, GHOST_LOOP_THREAD_PATH, frame)),
  },
  [GHOST_SHAPE.envelope]: {
    trace: (context, frame) => context.arc(0, 0, frame.halfLength, 0, RADIANS_PER_FULL_TURN),
    paintDetail: paintPores,
  },
  [GHOST_SHAPE.slipper]: {
    trace: (context, frame) => traceSharePath(context, GHOST_SLIPPER_PATH, frame),
    paintDetail: (context, frame, ramp) =>
      strokeDetail(context, ramp, () => traceSharePath(context, GHOST_SLIPPER_GROOVE_PATH, frame)),
  },
};

/** The body's volume: the silhouette filled light toward the top-left, fading to clear at the far corner. */
function paintWash(context: BakeContext2D, silhouette: Silhouette, frame: GhostFrame, ramp: IndicatorRamp): void {
  const gradient = context.createLinearGradient(
    -frame.halfLength,
    -frame.halfHeight,
    frame.halfLength,
    frame.halfHeight,
  );
  gradient.addColorStop(0, hexWithAlpha(ramp.light, GHOST_BAKE.washAlpha));
  gradient.addColorStop(1, hexWithAlpha(ramp.dark, 0));
  context.fillStyle = gradient;
  context.beginPath();
  silhouette.trace(context, frame);
  context.fill();
}

/** The outline twice: a faint solid trace, then the dashes over it. */
function strokeOutline(context: BakeContext2D, silhouette: Silhouette, frame: GhostFrame, ramp: IndicatorRamp): void {
  context.lineWidth = GHOST_BAKE.strokePx;
  context.lineCap = 'butt';
  for (const pass of [
    { alpha: GHOST_BAKE.traceAlpha, dash: [] },
    { alpha: GHOST_BAKE.dashAlpha, dash: [GHOST_BAKE.dashPx, GHOST_BAKE.dashGapPx] },
  ]) {
    context.setLineDash(pass.dash);
    context.strokeStyle = hexWithAlpha(ramp.tone, pass.alpha);
    context.beginPath();
    silhouette.trace(context, frame);
    context.stroke();
  }
  context.setLineDash([]);
}

/** The ghost's half-extents: `LADDER_GHOST_PX` long, its shape's aspect high. */
export function ghostFrameOf(shape: GhostShape): GhostFrame {
  const halfLength = LADDER_GHOST_PX * HALF;
  return { halfLength, halfHeight: halfLength * GHOST_ASPECT[shape] };
}

/** One ghost on a square canvas that holds its halo, centred, long axis along x. */
export function bakeGhost(
  factory: BakeCanvasFactory,
  scale: number,
  shape: GhostShape,
  ramp: IndicatorRamp,
): PxBakedSprite {
  const sidePx = LADDER_GHOST_PX * GHOST_BAKE.haloReach;
  const sprite = createPxCanvas(factory, sidePx, sidePx, scale);
  const { context } = sprite.canvas;
  const frame = ghostFrameOf(shape);
  const silhouette = SILHOUETTES[shape];
  context.save();
  context.translate(sprite.widthPx * HALF, sprite.heightPx * HALF);
  fillHalo(context, { x: 0, y: 0, radius: sidePx * HALF }, { colour: ramp.tone, alpha: GHOST_BAKE.haloAlpha });
  paintWash(context, silhouette, frame, ramp);
  strokeOutline(context, silhouette, frame, ramp);
  silhouette.paintDetail(context, frame, ramp);
  paintGlint(context, { x: 0, y: 0, radius: frame.halfHeight }, { colour: WHITE, alpha: GHOST_BAKE.glintAlpha });
  context.restore();
  return sprite;
}
