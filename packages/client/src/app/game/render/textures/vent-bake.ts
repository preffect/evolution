// The thermal vent sprite (sheet 02 vent table, docs/RENDERING.md §6 "the vent sprite"): baked on
// its own canvas at `VENT_SPRITE_PX_PER_WU` and drawn by the dish layer over the field at the vent
// zone, so its hairlines survive every zoom. Back to front in the fissure's rotated frame: heat
// pool, hot column, seam bed, crust shadow, the two basalt plates with their rims, the branching
// cracks, the molten seam (glow, hot line, white core) and its glints; then vent-risers-bake.ts adds
// the refraction arcs, the bubbles and, in the world frame, the plume. The seam's wave phase, the
// cracks, bubbles and plume are placed from the cosmetic `vent` sub-stream; the shimmer filter over
// this sprite is deferred (RENDERING §6, the one filter).

import { COSMETIC_SUB_STREAM, RADIANS_PER_FULL_TURN, lerp, type RandomSource } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  VENT_CRACKS,
  VENT_CRUST,
  VENT_CRUST_GLOW_LINE,
  VENT_CRUST_PLATE,
  VENT_CRUST_RIM,
  VENT_CRUST_RIM_LINE,
  VENT_CRUST_SHADOW,
  VENT_FISSURE_ROTATION_DEG,
  VENT_HEAT_POOL,
  VENT_HOT_COLUMN,
  VENT_PLUME,
  VENT_SEAM,
  VENT_SEAM_BED,
  VENT_SEAM_CORE,
  VENT_SEAM_GLINTS,
  VENT_SEAM_GLOW,
  VENT_SEAM_HOT,
  VENT_SEAM_HOT_LINE,
  VENT_SPRITE_PADDING_WU,
  VENT_SPRITE_PX_PER_WU,
  WHITE,
  ZONE_VENT,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF, degreesToRadians } from '../geometry';
import { fillFeatheredEllipse, strokeSoft, tracePolyline } from './soft-paint';
import { fillDisc, type BakeCanvas, type BakeCanvasFactory, type BakeContext2D } from './texture-bake';
import { paintVentPlume, paintVentRisers, ventRisersReachWu } from './vent-risers-bake';

export interface VentSprite {
  readonly canvas: BakeCanvas;
  /** The world extent the sprite covers: a square of this half-size, centred on the vent. */
  readonly halfExtentWu: number;
}

const SIDES = [-1, 1] as const;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI * HALF;

interface FeatheredEllipse {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly alpha: number;
  readonly blurWu: number;
  readonly x?: number;
  readonly y?: number;
}

function paintSoftEllipse(context: BakeContext2D, shape: FeatheredEllipse, colour: string): void {
  fillFeatheredEllipse(
    context,
    { x: shape.x ?? 0, y: shape.y ?? 0, radiusX: shape.radiusX, radiusY: shape.radiusY, rotation: 0 },
    { colour, alpha: shape.alpha },
    shape.blurWu,
  );
}

/** A point on a plate's wavy seam-side edge, `share` from 0 (left) to 1 (right), for the lower plate. */
function plateEdgePoint(share: number): { x: number; y: number } {
  const { halfLengthWu, gapWu, waves, waveAmplitudeWu } = VENT_CRUST_PLATE;
  return {
    x: lerp(-halfLengthWu, halfLengthWu, share),
    y: gapWu + waveAmplitudeWu * Math.sin(waves * RADIANS_PER_FULL_TURN * share),
  };
}

function tracePlateEdge(context: BakeContext2D, from: number, until: number): void {
  tracePolyline(context, VENT_CRUST_PLATE.edgeSteps, (share) => plateEdgePoint(lerp(from, until, share)));
}

/** One basalt plate, drawn as the lower one; the upper is the same under a vertical flip. */
function paintCrustPlate(context: BakeContext2D, side: (typeof SIDES)[number]): void {
  const plate = VENT_CRUST_PLATE;
  context.save();
  context.scale(1, side);
  context.beginPath();
  tracePlateEdge(context, 0, 1);
  context.ellipse(0, plate.gapWu, plate.halfLengthWu, plate.thicknessWu, 0, 0, HALF_TURN);
  context.closePath();
  context.fillStyle = hexWithAlpha(VENT_CRUST, plate.alpha);
  context.fill();
  strokeSoft(context, (path) => tracePlateEdge(path, 0, 1), {
    colour: VENT_CRUST_RIM,
    alpha: VENT_CRUST_RIM_LINE.alpha,
    widthPx: VENT_CRUST_RIM_LINE.widthWu,
    featherPx: plate.blurWu,
  });
  const glow = VENT_CRUST_GLOW_LINE;
  for (let segment = 0; segment < glow.segments; segment += 1) {
    const centre = (segment + HALF) / glow.segments;
    strokeSoft(
      context,
      (path) => tracePlateEdge(path, centre - glow.segmentShare * HALF, centre + glow.segmentShare * HALF),
      {
        colour: VENT_PLUME,
        alpha: glow.alpha,
        widthPx: glow.widthWu,
        featherPx: 0,
      },
    );
  }
  context.restore();
}

/** Two segments from a seeded root on the seam, bending away, the second fading. */
function paintCrack(context: BakeContext2D, random: RandomSource, phase: number): void {
  const cracks = VENT_CRACKS;
  const side = random.pick(SIDES);
  const root = seamPoint(
    (random.nextFloat() * DIAMETER_PER_RADIUS - 1) * cracks.rootShare * VENT_SEAM.halfLengthWu,
    phase,
  );
  const alpha = lerp(cracks.alphaMin, cracks.alphaMax, random.nextFloat());
  const widthPx = lerp(cracks.widthWuMin, cracks.widthWuMax, random.nextFloat());
  let heading = side * QUARTER_TURN;
  let from = root;
  const alphas = [alpha, alpha * cracks.fadeShare];
  for (const segmentAlpha of alphas) {
    heading += (random.nextFloat() - HALF) * cracks.spreadTurns * RADIANS_PER_FULL_TURN;
    const length = lerp(cracks.segmentWuMin, cracks.segmentWuMax, random.nextFloat());
    const end = { x: from.x + Math.cos(heading) * length, y: from.y + Math.sin(heading) * length };
    const start = from;
    strokeSoft(
      context,
      (path) => {
        path.moveTo(start.x, start.y);
        path.lineTo(end.x, end.y);
      },
      { colour: VENT_PLUME, alpha: segmentAlpha, widthPx, featherPx: 0 },
    );
    from = end;
  }
}

/** The seam's spine: a wave along the fissure at a seeded phase, `x` in wu. */
function seamPoint(x: number, phase: number): { x: number; y: number } {
  const turns = (x / VENT_SEAM.halfLengthWu) * VENT_SEAM.waves * HALF;
  return { x, y: VENT_SEAM.amplitudeWu * Math.sin(turns * RADIANS_PER_FULL_TURN + phase) };
}

function traceSeam(context: BakeContext2D, halfLength: number, phase: number): void {
  tracePolyline(context, VENT_SEAM.steps, (share) => seamPoint(lerp(-halfLength, halfLength, share), phase));
}

/** Glow, hot line and white core over the same spine, then the two glints on its hottest points. */
function paintSeam(context: BakeContext2D, phase: number): void {
  const full = (path: BakeContext2D) => traceSeam(path, VENT_SEAM.halfLengthWu, phase);
  const core = (path: BakeContext2D) => traceSeam(path, VENT_SEAM.coreHalfLengthWu, phase);
  const glow = VENT_SEAM_GLOW;
  strokeSoft(context, full, { colour: ZONE_VENT, alpha: glow.alpha, widthPx: glow.widthWu, featherPx: glow.blurWu });
  const hot = VENT_SEAM_HOT_LINE;
  strokeSoft(context, full, { colour: VENT_SEAM_HOT, alpha: hot.alpha, widthPx: hot.widthWu, featherPx: hot.blurWu });
  strokeSoft(context, core, {
    colour: WHITE,
    alpha: VENT_SEAM_CORE.alpha,
    widthPx: VENT_SEAM_CORE.widthWu,
    featherPx: 0,
  });
  for (const glint of VENT_SEAM_GLINTS) {
    const point = seamPoint(glint.share * VENT_SEAM.halfLengthWu, phase);
    fillDisc(context, { x: point.x, y: point.y, radius: glint.radiusWu }, { colour: WHITE, alpha: glint.alpha });
  }
}

/** The sheet's table in the rotated frame: pool, column, bed, shadow, plates, cracks, seam, glints. */
function paintFissure(context: BakeContext2D, random: RandomSource): void {
  paintSoftEllipse(context, VENT_HEAT_POOL, ZONE_VENT);
  paintSoftEllipse(context, VENT_HOT_COLUMN, VENT_PLUME);
  paintSoftEllipse(context, VENT_SEAM_BED, VENT_PLUME);
  paintSoftEllipse(context, VENT_CRUST_SHADOW, VENT_CRUST);
  for (const side of SIDES) paintCrustPlate(context, side);
  const phase = random.nextFloat() * RADIANS_PER_FULL_TURN;
  for (let crack = 0; crack < VENT_CRACKS.count; crack += 1) paintCrack(context, random, phase);
  paintSeam(context, phase);
}

/** How far the sprite reaches from the vent centre: the widest soft shape or the plume, plus the padding. */
export function ventSpriteHalfExtentWu(): number {
  const pool = VENT_HEAT_POOL.radiusX + VENT_HEAT_POOL.blurWu;
  const column = Math.abs(VENT_HOT_COLUMN.y) + VENT_HOT_COLUMN.radiusY + VENT_HOT_COLUMN.blurWu;
  return Math.max(pool, column, ventRisersReachWu()) + VENT_SPRITE_PADDING_WU;
}

/** The vent at `VENT_SPRITE_PX_PER_WU`, centred on its canvas; every layer is drawn in wu under one scale. */
export function bakeVentSprite(factory: BakeCanvasFactory, cosmetic: RandomSource): VentSprite {
  const halfExtentWu = ventSpriteHalfExtentWu();
  const sizePx = Math.ceil(halfExtentWu * DIAMETER_PER_RADIUS * VENT_SPRITE_PX_PER_WU);
  const canvas = factory.create(sizePx, sizePx);
  const { context } = canvas;
  const random = cosmetic.fork(COSMETIC_SUB_STREAM.vent);
  context.save();
  context.translate(sizePx * HALF, sizePx * HALF);
  context.scale(VENT_SPRITE_PX_PER_WU, VENT_SPRITE_PX_PER_WU);
  context.save();
  context.rotate(degreesToRadians(VENT_FISSURE_ROTATION_DEG));
  paintFissure(context, random);
  paintVentRisers(context, random);
  context.restore();
  paintVentPlume(context, random);
  context.restore();
  return { canvas, halfExtentWu };
}
