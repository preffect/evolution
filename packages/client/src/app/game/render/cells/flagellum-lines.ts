// The one line geometry of a cell (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §4): the flagellum
// tail, 2 r long behind the cell, two sine waves travelling away from it, amplitude per tier,
// doubled on sprint, two tails at tier III. `flagellumPolyline` is pure; `FlagellumLines` draws
// every tail of the frame into one Graphics.

import { RADIANS_PER_FULL_TURN, type TraitTier } from '@evolution/shared';
import { Graphics } from 'pixi.js';
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
import { degreesToRadians } from '../geometry';
import { hexToNumber } from '../colour';

export interface FlagellumSpec {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly heading: number;
  readonly tier: TraitTier;
  readonly timeSeconds: number;
  readonly isSprinting: boolean;
  /** The cosmetic phase in turns, so two cells' tails never beat in step. */
  readonly phase: number;
}

const HALF = 0.5;

/** How many tails a tier grows. */
export function flagellumTailCount(tier: TraitTier): number {
  return FLAGELLUM_TAILS_BY_TIER[tier - 1] ?? 1;
}

/** The world points of tail `tailIndex`, root on the membrane behind the cell, tip 2 r away. */
export function flagellumPolyline(spec: FlagellumSpec, tailIndex: number): { x: number; y: number }[] {
  const tails = flagellumTailCount(spec.tier);
  const spread = degreesToRadians(FLAGELLUM_TAIL_SPREAD_DEG) * (tailIndex - (tails - 1) * HALF);
  const backward = spec.heading + Math.PI + spread;
  const sideways = backward + Math.PI * HALF;
  const amplitudeScale =
    (FLAGELLUM_AMPLITUDE_BY_TIER[spec.tier - 1] ?? 1) * (spec.isSprinting ? FLAGELLUM_SPRINT_AMPLITUDE_SCALE : 1);
  const amplitude = FLAGELLUM_AMPLITUDE_RADII * amplitudeScale * spec.radius;
  const length = FLAGELLUM_LENGTH_RADII * spec.radius;
  const points: { x: number; y: number }[] = [];
  for (let segment = 0; segment <= FLAGELLUM_SEGMENTS; segment += 1) {
    const share = segment / FLAGELLUM_SEGMENTS;
    const along = spec.radius + share * length;
    const wave = Math.sin(
      RADIANS_PER_FULL_TURN * (share * FLAGELLUM_WAVES - spec.timeSeconds * FLAGELLUM_WAVE_HZ + spec.phase),
    );
    const across = wave * amplitude * share;
    points.push({
      x: spec.x + Math.cos(backward) * along + Math.cos(sideways) * across,
      y: spec.y + Math.sin(backward) * along + Math.sin(sideways) * across,
    });
  }
  return points;
}

export class FlagellumLines {
  readonly graphics = new Graphics();

  private strokePolyline(points: readonly { x: number; y: number }[]): void {
    const first = points[0];
    if (first === undefined) return;
    this.graphics.moveTo(first.x, first.y);
    for (const point of points.slice(1)) this.graphics.lineTo(point.x, point.y);
  }

  /** Redraws every tail: the outer stroke under the white core, widths in px at `zoom`. */
  update(specs: readonly FlagellumSpec[], zoom: number): void {
    this.graphics.clear();
    if (specs.length === 0) return;
    const polylines = specs.flatMap((spec) =>
      Array.from({ length: flagellumTailCount(spec.tier) }, (_unused, tail) => flagellumPolyline(spec, tail)),
    );
    for (const points of polylines) this.strokePolyline(points);
    this.graphics.stroke({
      width: FLAGELLUM_OUTER_PX / zoom,
      color: hexToNumber(FLAGELLUM),
      alpha: FLAGELLUM_OUTER_ALPHA,
      cap: 'round',
    });
    for (const points of polylines) this.strokePolyline(points);
    this.graphics.stroke({ width: FLAGELLUM_CORE_PX / zoom, color: hexToNumber(WHITE), alpha: 1, cap: 'round' });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
