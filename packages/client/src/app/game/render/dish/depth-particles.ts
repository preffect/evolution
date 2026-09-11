// The three depth layers (sheet 02 draw order 4–7, docs/VISUAL-STYLE.md §1, §5): far sharp
// motes, near blurred discs and bokeh, each a seeded field that drifts 2–4 wu/s and tiles over
// a 1080p window at zoom 1, wrapping with the camera so the field never runs out. Pure
// placement; the dish layer applies it to particles.

import { RADIANS_PER_FULL_TURN, type RandomSource } from '@evolution/shared';
import {
  DEPTH_BOKEH,
  DEPTH_DRIFT_WU_PER_SECOND_MAX,
  DEPTH_DRIFT_WU_PER_SECOND_MIN,
  DEPTH_FAR,
  DEPTH_FIELD_WU,
  DEPTH_NEAR_PARTICLES,
  DEPTH_PARALLAX,
} from '../constants';
import { lerp } from '../geometry';

export interface DepthLayerSpec {
  readonly count: number;
  readonly radiusMin: number;
  readonly radiusMax: number;
  readonly alphaMin: number;
  readonly alphaMax: number;
}

export interface DepthParticleSpec {
  /** Rest position inside the field window (wu). */
  readonly x: number;
  readonly y: number;
  readonly radiusWu: number;
  readonly alpha: number;
  readonly driftAngle: number;
  readonly driftWuPerSecond: number;
  readonly tintIndex: number;
}

export const DEPTH_LAYER = { far: 'far', near: 'near', bokeh: 'bokeh' } as const;
export type DepthLayerKey = (typeof DEPTH_LAYER)[keyof typeof DEPTH_LAYER];

export const DEPTH_LAYER_SPECS: Readonly<Record<DepthLayerKey, DepthLayerSpec>> = {
  [DEPTH_LAYER.far]: DEPTH_FAR,
  [DEPTH_LAYER.near]: DEPTH_NEAR_PARTICLES,
  [DEPTH_LAYER.bokeh]: DEPTH_BOKEH,
};

export const DEPTH_STREAM_LABEL = 'depth';
const TINT_COUNT = 4;
const HALF = 0.5;

export function depthParticleSpecs(layer: DepthLayerKey, cosmetic: RandomSource): DepthParticleSpec[] {
  const spec = DEPTH_LAYER_SPECS[layer];
  const random = cosmetic.fork(`${DEPTH_STREAM_LABEL}:${layer}`);
  return Array.from({ length: spec.count }, () => ({
    x: random.nextFloat() * DEPTH_FIELD_WU.width,
    y: random.nextFloat() * DEPTH_FIELD_WU.height,
    radiusWu: lerp(spec.radiusMin, spec.radiusMax, random.nextFloat()),
    alpha: lerp(spec.alphaMin, spec.alphaMax, random.nextFloat()),
    driftAngle: random.nextFloat() * RADIANS_PER_FULL_TURN,
    driftWuPerSecond: lerp(DEPTH_DRIFT_WU_PER_SECOND_MIN, DEPTH_DRIFT_WU_PER_SECOND_MAX, random.nextFloat()),
    tintIndex: random.nextInt(0, TINT_COUNT - 1),
  }));
}

function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}

/**
 * Where a particle sits this frame: drifted, moved by the camera at its layer's parallax, and
 * wrapped into the window around the camera centre so the field follows the view.
 */
export function depthParticlePosition(
  particle: DepthParticleSpec,
  layer: DepthLayerKey,
  timeSeconds: number,
  camera: { x: number; y: number },
): { x: number; y: number } {
  const parallax = DEPTH_PARALLAX[layer];
  const driftX = Math.cos(particle.driftAngle) * particle.driftWuPerSecond * timeSeconds;
  const driftY = Math.sin(particle.driftAngle) * particle.driftWuPerSecond * timeSeconds;
  const shiftX = camera.x * (1 - parallax);
  const shiftY = camera.y * (1 - parallax);
  const localX = wrap(particle.x + driftX + shiftX - camera.x + DEPTH_FIELD_WU.width * HALF, DEPTH_FIELD_WU.width);
  const localY = wrap(particle.y + driftY + shiftY - camera.y + DEPTH_FIELD_WU.height * HALF, DEPTH_FIELD_WU.height);
  return { x: camera.x + localX - DEPTH_FIELD_WU.width * HALF, y: camera.y + localY - DEPTH_FIELD_WU.height * HALF };
}
