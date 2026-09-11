// The three depth layers (sheet 02 draw order 4–7, docs/VISUAL-STYLE.md §1, §5): far sharp
// motes, near blurred discs and bokeh, each a seeded field that drifts 2–4 wu/s and tiles over
// a 1080p window at zoom 1, wrapping with the camera so the field never runs out. Pure
// placement; the dish layer applies it to particles.

import { COSMETIC_SUB_STREAM, RADIANS_PER_FULL_TURN, lerp, type RandomSource } from '@evolution/shared';
import {
  DEPTH_BOKEH,
  DEPTH_FAR_TINTS,
  DEPTH_NEAR,
  LIGHT_ACCENT,
  ZONE_GEL,
  DEPTH_DRIFT_WU_PER_SECOND_MAX,
  DEPTH_DRIFT_WU_PER_SECOND_MIN,
  DEPTH_FAR,
  DEPTH_FIELD_WU,
  DEPTH_NEAR_PARTICLES,
  DEPTH_PARALLAX,
} from '../constants';
import { HALF } from '../geometry';
import type { WorldPoint } from '../camera';

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
  /** One of the layer's `DEPTH_TINTS`, drawn from the seeded stream. */
  readonly tint: string;
}

export const DEPTH_LAYER = { far: 'far', near: 'near', bokeh: 'bokeh' } as const;
export type DepthLayerKey = (typeof DEPTH_LAYER)[keyof typeof DEPTH_LAYER];

export const DEPTH_LAYER_SPECS: Readonly<Record<DepthLayerKey, DepthLayerSpec>> = {
  [DEPTH_LAYER.far]: DEPTH_FAR,
  [DEPTH_LAYER.near]: DEPTH_NEAR_PARTICLES,
  [DEPTH_LAYER.bokeh]: DEPTH_BOKEH,
};

/** The tints each layer draws from (sheet 02): the far motes vary, the near discs are one, the bokeh two. */
/** A layer's tints: never empty, so a drawn index always lands and the first is the typed fallback. */
type DepthTintList = readonly [string, ...string[]];
export const DEPTH_TINTS: Readonly<Record<DepthLayerKey, DepthTintList>> = {
  [DEPTH_LAYER.far]: DEPTH_FAR_TINTS,
  [DEPTH_LAYER.near]: [DEPTH_NEAR],
  [DEPTH_LAYER.bokeh]: [ZONE_GEL, LIGHT_ACCENT],
};

export function depthParticleSpecs(layer: DepthLayerKey, cosmetic: RandomSource): DepthParticleSpec[] {
  const spec = DEPTH_LAYER_SPECS[layer];
  const random = cosmetic.fork(`${COSMETIC_SUB_STREAM.depth}:${layer}`);
  const tints = DEPTH_TINTS[layer];
  return Array.from({ length: spec.count }, () => ({
    x: random.nextFloat() * DEPTH_FIELD_WU.width,
    y: random.nextFloat() * DEPTH_FIELD_WU.height,
    radiusWu: lerp(spec.radiusMin, spec.radiusMax, random.nextFloat()),
    alpha: lerp(spec.alphaMin, spec.alphaMax, random.nextFloat()),
    driftAngle: random.nextFloat() * RADIANS_PER_FULL_TURN,
    driftWuPerSecond: lerp(DEPTH_DRIFT_WU_PER_SECOND_MIN, DEPTH_DRIFT_WU_PER_SECOND_MAX, random.nextFloat()),
    tint: tints[random.nextInt(0, tints.length - 1)] ?? tints[0],
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
  camera: WorldPoint,
): WorldPoint {
  const parallax = DEPTH_PARALLAX[layer];
  const driftX = Math.cos(particle.driftAngle) * particle.driftWuPerSecond * timeSeconds;
  const driftY = Math.sin(particle.driftAngle) * particle.driftWuPerSecond * timeSeconds;
  const shiftX = camera.x * (1 - parallax);
  const shiftY = camera.y * (1 - parallax);
  const localX = wrap(particle.x + driftX + shiftX - camera.x + DEPTH_FIELD_WU.width * HALF, DEPTH_FIELD_WU.width);
  const localY = wrap(particle.y + driftY + shiftY - camera.y + DEPTH_FIELD_WU.height * HALF, DEPTH_FIELD_WU.height);
  return { x: camera.x + localX - DEPTH_FIELD_WU.width * HALF, y: camera.y + localY - DEPTH_FIELD_WU.height * HALF };
}
