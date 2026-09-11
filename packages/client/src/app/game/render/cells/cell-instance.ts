// One cell's per-instance data and its packing into the instance texture (docs/RENDERING.md §2.3):
// twenty RGBA float texels per instance, read by both shader stages with `texelFetch`, so the
// layout is one table here and one matching set of column constants in the GLSL. The bump slots
// are the last six texels (eight bumps × amplitude, centre, sigma).

import { MAX_SHAPE_BUMPS } from '../constants';
import type { ShapeBump } from './radial-profile';

export const CELL_INSTANCE_TEXELS = 20;
const TEXEL_FLOATS = 4;
export const CELL_INSTANCE_FLOATS = CELL_INSTANCE_TEXELS * TEXEL_FLOATS;
/** The first bump texel; the bumps fill the rest of the row. */
export const BUMP_TEXEL_START = 14;
const BUMP_FLOATS = 3;

export interface CellInstance {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly quadExtentRadii: number;
  readonly heading: number;
  readonly speedRatio: number;
  readonly paletteIndex: number;
  readonly lodBlend: number;
  readonly ciliaCount: number;
  readonly wallScale: number;
  readonly speckleDensity: number;
  readonly filamentCount: number;
  readonly breathing: number;
  readonly wobbleAmplitude: number;
  readonly wobbleMode: number;
  readonly wobblePhase: number;
  readonly axialAlong: number;
  readonly axialAcross: number;
  readonly pulse: number;
  readonly tintMix: number;
  readonly nucleusOffsetX: number;
  readonly nucleusOffsetY: number;
  readonly haloKind: number;
  readonly beadCount: number;
  readonly isOwn: boolean;
  readonly warningRingPx: number;
  readonly selfRingFill: number;
  readonly alpha: number;
  readonly stripRow: number;
  readonly stripPhase: number;
  readonly rimBrightness: number;
  readonly passBAlpha: number;
  readonly isFarDot: boolean;
  readonly isProtocell: boolean;
  readonly ciliaBeatHz: number;
  readonly haloRadiiScale: number;
  /** The strip's lobes scale (halved with `cytoskeleton`) and jitter amplitude; 0 when the strip is off. */
  readonly lobesScale: number;
  readonly jitterAmplitude: number;
  /** 0 → 1 as an absorbed ghost's rim breaks into dashes. */
  readonly rimDash: number;
  readonly bumps: readonly ShapeBump[];
}

/** The scalar texels in order; each entry is one texel's four channels. */
const SCALAR_TEXELS: readonly (readonly (keyof CellInstance)[])[] = [
  ['x', 'y', 'radius', 'quadExtentRadii'],
  ['heading', 'speedRatio', 'paletteIndex', 'lodBlend'],
  ['ciliaCount', 'wallScale', 'speckleDensity', 'filamentCount'],
  ['breathing', 'wobbleAmplitude', 'wobbleMode', 'wobblePhase'],
  ['axialAlong', 'axialAcross', 'pulse', 'tintMix'],
  ['nucleusOffsetX', 'nucleusOffsetY', 'haloKind', 'beadCount'],
  ['isOwn', 'warningRingPx', 'selfRingFill', 'alpha'],
  ['stripRow', 'stripPhase', 'rimBrightness', 'passBAlpha'],
  ['isFarDot', 'isProtocell', 'ciliaBeatHz', 'haloRadiiScale'],
  ['lobesScale', 'jitterAmplitude', 'rimDash', 'rimDash'],
];

function scalar(value: CellInstance[keyof CellInstance]): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return typeof value === 'number' ? value : 0;
}

/** Writes `instance` into row `row` of `target` (a `CELL_INSTANCE_FLOATS`-wide float buffer). */
export function packCellInstance(target: Float32Array, row: number, instance: CellInstance): void {
  const base = row * CELL_INSTANCE_FLOATS;
  SCALAR_TEXELS.forEach((texel, texelIndex) => {
    texel.forEach((field, channel) => {
      target[base + texelIndex * TEXEL_FLOATS + channel] = scalar(instance[field]);
    });
  });
  for (let slot = 0; slot < MAX_SHAPE_BUMPS; slot += 1) {
    const bump = instance.bumps[slot];
    const offset = base + BUMP_TEXEL_START * TEXEL_FLOATS + slot * BUMP_FLOATS;
    target[offset] = bump?.amplitude ?? 0;
    target[offset + 1] = bump?.centre ?? 0;
    target[offset + BUMP_FLOATS - 1] = bump?.sigma ?? 1;
  }
}

/** The channel of `field` as `[texel, channel]`, so a test can pin the GLSL column constants. */
export function instanceFieldLocation(field: keyof CellInstance): readonly [number, number] {
  for (let texel = 0; texel < SCALAR_TEXELS.length; texel += 1) {
    const channel = SCALAR_TEXELS[texel]?.indexOf(field) ?? -1;
    if (channel >= 0) return [texel, channel];
  }
  return [BUMP_TEXEL_START, 0];
}

export function createInstanceBuffer(capacity: number): Float32Array {
  return new Float32Array(capacity * CELL_INSTANCE_FLOATS);
}
