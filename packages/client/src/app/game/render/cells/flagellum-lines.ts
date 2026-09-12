// The one line geometry of a cell (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §4): the flagellum
// tail, 2 r long behind the cell, two sine waves travelling away from it, amplitude per tier,
// doubled on sprint, two tails at tier III. `flagellumPolyline` is pure; `FlagellumLines` draws
// every tail of the frame into one Graphics, under the body so the root is buried in the membrane.

import { RADIANS_PER_FULL_TURN, type TraitTier } from '@evolution/shared';
import { Graphics } from 'pixi.js';
import { hexToNumber } from '../colour';
import {
  FLAGELLUM,
  FLAGELLUM_AMPLITUDE_BY_TIER,
  FLAGELLUM_AMPLITUDE_RADII,
  FLAGELLUM_CORE_PX,
  FLAGELLUM_LENGTH_RADII,
  FLAGELLUM_OUTER_ALPHA,
  FLAGELLUM_OUTER_PX,
  FLAGELLUM_SEGMENTS,
  FLAGELLUM_SPRINT_AMPLITUDE_SCALE,
  FLAGELLUM_TAILS_BY_TIER,
  FLAGELLUM_TAIL_SPREAD_DEG,
  FLAGELLUM_WAVES,
  FLAGELLUM_WAVE_HZ,
  WHITE,
} from '../constants';
import { HALF, degreesToRadians } from '../geometry';

export interface FlagellumSpec {
  readonly x: number;
  readonly y: number;
  /** The drawn radius (`r × pulse`): the tail roots on the membrane. */
  readonly radius: number;
  readonly heading: number;
  readonly tier: TraitTier;
  readonly timeSeconds: number;
  readonly isSprinting: boolean;
  /** The cosmetic phase in turns, so two cells' tails never beat in step. */
  readonly phase: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

const ONE_TAIL = 1;
const FULL_AMPLITUDE = 1;
const TAIL_SPREAD = degreesToRadians(FLAGELLUM_TAIL_SPREAD_DEG);
const QUARTER_TURN = Math.PI * HALF;

/** How many tails a tier grows. */
export function flagellumTailCount(tier: TraitTier): number {
  return FLAGELLUM_TAILS_BY_TIER[tier - 1] ?? ONE_TAIL;
}

/** The wave's peak in wu: `FLAGELLUM_AMPLITUDE_RADII × r`, × 1 / 1.5 / 2 per tier, × 2 on sprint. */
function amplitudeWu(spec: FlagellumSpec): number {
  const tierScale = FLAGELLUM_AMPLITUDE_BY_TIER[spec.tier - 1] ?? FULL_AMPLITUDE;
  const sprintScale = spec.isSprinting ? FLAGELLUM_SPRINT_AMPLITUDE_SCALE : FULL_AMPLITUDE;
  return FLAGELLUM_AMPLITUDE_RADII * tierScale * sprintScale * spec.radius;
}

/** The world points of tail `tailIndex`: root on the membrane behind the cell, tip 2 r further, the wave growing toward the tip. */
export function flagellumPolyline(spec: FlagellumSpec, tailIndex: number): WorldPoint[] {
  const tails = flagellumTailCount(spec.tier);
  const backward = spec.heading + Math.PI + TAIL_SPREAD * (tailIndex - (tails - 1) * HALF);
  const sideways = backward + QUARTER_TURN;
  const amplitude = amplitudeWu(spec);
  const length = FLAGELLUM_LENGTH_RADII * spec.radius;
  return Array.from({ length: FLAGELLUM_SEGMENTS + 1 }, (_unused, segment) => {
    const share = segment / FLAGELLUM_SEGMENTS;
    const along = spec.radius + share * length;
    const wave = Math.sin(
      RADIANS_PER_FULL_TURN * (share * FLAGELLUM_WAVES - spec.timeSeconds * FLAGELLUM_WAVE_HZ + spec.phase),
    );
    const across = wave * amplitude * share;
    return {
      x: spec.x + Math.cos(backward) * along + Math.cos(sideways) * across,
      y: spec.y + Math.sin(backward) * along + Math.sin(sideways) * across,
    };
  });
}

interface TailStroke {
  readonly widthPx: number;
  readonly colour: string;
  readonly alpha: number;
}

/** The outer glow stroke under the white core (VISUAL-STYLE §4 `FLAGELLUM` 3 px white core). */
const OUTER_STROKE: TailStroke = { widthPx: FLAGELLUM_OUTER_PX, colour: FLAGELLUM, alpha: FLAGELLUM_OUTER_ALPHA };
const CORE_STROKE: TailStroke = { widthPx: FLAGELLUM_CORE_PX, colour: WHITE, alpha: 1 };

export class FlagellumLines {
  readonly graphics = new Graphics();

  private strokePolylines(polylines: readonly (readonly WorldPoint[])[], stroke: TailStroke, zoom: number): void {
    for (const points of polylines) {
      const [first, ...rest] = points;
      if (first === undefined) continue;
      this.graphics.moveTo(first.x, first.y);
      for (const point of rest) this.graphics.lineTo(point.x, point.y);
    }
    this.graphics.stroke({
      width: stroke.widthPx / zoom,
      color: hexToNumber(stroke.colour),
      alpha: stroke.alpha,
      cap: 'round',
    });
  }

  /** Redraws every tail: the outer stroke under the white core, widths in px at `zoom`. */
  update(specs: readonly FlagellumSpec[], zoom: number): number {
    this.graphics.clear();
    const polylines = specs.flatMap((spec) =>
      Array.from({ length: flagellumTailCount(spec.tier) }, (_unused, tail) => flagellumPolyline(spec, tail)),
    );
    if (polylines.length === 0) return 0;
    this.strokePolylines(polylines, OUTER_STROKE, zoom);
    this.strokePolylines(polylines, CORE_STROKE, zoom);
    return polylines.length;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
