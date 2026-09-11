// One cell's per-instance data and its packing into the instance texture (docs/RENDERING.md
// §2.3): RGBA float texels per instance, read by both shader stages with `texelFetch`, so the
// layout is one table here and the GLSL reads it through `instanceRead` (cell-shader-source.ts).
// The scalar texels come first, then the bump slots (eight bumps × amplitude, centre, sigma).

import { MAX_SHAPE_BUMPS } from '../constants';
import { ZERO_BUMP, type ShapeBump } from './radial-profile';

export interface CellInstance {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** The quad's half-size in radii (§2), read by the vertex stage only. */
  readonly quadExtentRadii: number;
  readonly heading: number;
  readonly speedRatio: number;
  readonly paletteIndex: number;
  readonly lodBlend: number;
  readonly breathing: number;
  readonly wobbleAmplitude: number;
  readonly wobbleMode: number;
  readonly wobblePhase: number;
  readonly axialAlong: number;
  readonly axialAcross: number;
  readonly pulse: number;
  /** Sprint brightens the rim light (VISUAL-STYLE §5). */
  readonly rimBrightness: number;
  /** The mapped nucleus slot, fractions of `r`, cell frame. */
  readonly nucleusOffsetX: number;
  readonly nucleusOffsetY: number;
  readonly haloKind: number;
  /** Seat-mark beads on the outline; 0 when the LOD drops the tells. */
  readonly beadCount: number;
  readonly isOwn: boolean;
  readonly isFarDot: boolean;
  readonly isProtocell: boolean;
  readonly alpha: number;
  readonly stripRow: number;
  /** Turns. */
  readonly stripPhase: number;
  /** The strip's lobes scale and jitter amplitude; 0 when the strip is off. */
  readonly lobesScale: number;
  readonly jitterAmplitude: number;
  readonly bumps: readonly ShapeBump[];
}

export type CellInstanceScalar = Exclude<keyof CellInstance, 'bumps'>;

/** The scalar texels in order; each entry is one texel's channels (x, y, z, w). */
const SCALAR_TEXELS: readonly (readonly CellInstanceScalar[])[] = [
  ['x', 'y', 'radius', 'quadExtentRadii'],
  ['heading', 'speedRatio', 'paletteIndex', 'lodBlend'],
  ['breathing', 'wobbleAmplitude', 'wobbleMode', 'wobblePhase'],
  ['axialAlong', 'axialAcross', 'pulse', 'rimBrightness'],
  ['nucleusOffsetX', 'nucleusOffsetY', 'haloKind', 'beadCount'],
  ['isOwn', 'isFarDot', 'isProtocell', 'alpha'],
  ['stripRow', 'stripPhase', 'lobesScale', 'jitterAmplitude'],
];

/** One RGBA texel holds four floats; a bump slot is its three channels in this order. */
export const TEXEL_FLOATS = 4;
export const BUMP_CHANNELS: readonly (keyof ShapeBump)[] = ['amplitude', 'centre', 'sigma'];
export const BUMP_FLOATS = BUMP_CHANNELS.length;
/** The first bump texel; the bumps fill the rest of the row. */
export const BUMP_TEXEL_START = SCALAR_TEXELS.length;
const BUMP_TEXELS = Math.ceil((MAX_SHAPE_BUMPS * BUMP_FLOATS) / TEXEL_FLOATS);
export const CELL_INSTANCE_TEXELS = BUMP_TEXEL_START + BUMP_TEXELS;
export const CELL_INSTANCE_FLOATS = CELL_INSTANCE_TEXELS * TEXEL_FLOATS;

function scalar(value: CellInstance[CellInstanceScalar]): number {
  return typeof value === 'boolean' ? (value ? 1 : 0) : value;
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
    const bump = instance.bumps[slot] ?? ZERO_BUMP;
    const offset = base + BUMP_TEXEL_START * TEXEL_FLOATS + slot * BUMP_FLOATS;
    BUMP_CHANNELS.forEach((channel, index) => {
      target[offset + index] = bump[channel];
    });
  }
}

/** The channel of `field` as `[texel, channel]`: the GLSL column the shader source reads it from. */
export function instanceFieldLocation(field: CellInstanceScalar): readonly [number, number] {
  for (let texel = 0; texel < SCALAR_TEXELS.length; texel += 1) {
    const channel = SCALAR_TEXELS[texel]?.indexOf(field) ?? -1;
    if (channel >= 0) return [texel, channel];
  }
  throw new Error(`${field} has no texel in the cell instance layout.`);
}

/** Every scalar field, in texel order. */
export function instanceScalarFields(): CellInstanceScalar[] {
  return SCALAR_TEXELS.flatMap((texel) => [...texel]);
}

export function createInstanceBuffer(capacity: number): Float32Array {
  return new Float32Array(capacity * CELL_INSTANCE_FLOATS);
}
