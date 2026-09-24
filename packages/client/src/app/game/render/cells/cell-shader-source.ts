// The GLSL helpers every cell shader file shares: a float literal that is always a float, the
// instance-texture reads (one table with `cell-instance.ts`, pinned by the shader spec), the
// names of the uniforms the mesh sets and the two pass ids.

import { instanceFieldLocation, type CellInstanceScalar } from './cell-instance';

const CHANNEL_SWIZZLE = ['x', 'y', 'z', 'w'] as const;

/** A number as a GLSL float literal (`3` → `3.0`; `0.5`, `1e-9` stay as they are). */
export function glslFloat(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

/** `texelFetch(uInstances, ivec2(texel, vInstance), 0)`: one whole instance texel. */
export function instanceTexelFetch(texel: number): string {
  return `texelFetch(uInstances, ivec2(${texel}, vInstance), 0)`;
}

/** The local a shader holds instance texel `texel` in, fetched once (`instanceTexelLocals`). */
export function instanceTexelLocal(texel: number): string {
  return `instanceTexel${texel}`;
}

/**
 * One instance field as a channel of its texel's local (`instanceTexel4.w`). A shader declares the locals with
 * `instanceTexelLocals` and then reads every field through them, so each texel is fetched once however many of its
 * fields the stage uses (ticket #302: a fetch per field made the fragment stage read the same texel up to four times).
 */
export function instanceRead(field: CellInstanceScalar): string {
  const [texel, channel] = instanceFieldLocation(field);
  return `${instanceTexelLocal(texel)}.${CHANNEL_SWIZZLE[channel] ?? 'x'}`;
}

/** `vec4 instanceTexel<i> = texelFetch(…);` once for each texel `fields` live in, in texel order. */
export function instanceTexelLocals(fields: readonly CellInstanceScalar[]): string {
  const texels = [...new Set(fields.map((field) => instanceFieldLocation(field)[0]))].sort(
    (left, right) => left - right,
  );
  return texels.map((texel) => `vec4 ${instanceTexelLocal(texel)} = ${instanceTexelFetch(texel)};`).join('\n  ');
}

export const CELL_UNIFORM = {
  instances: 'uInstances',
  strip: 'uStrip',
  tile: 'uTile',
  palette: 'uPalette',
  timeSeconds: 'uTimeSeconds',
  zoom: 'uZoom',
  pass: 'uPass',
  white: 'uWhite',
  outline: 'uOutline',
  chloroLight: 'uChloroLight',
  toxinGlow: 'uToxinGlow',
  ribosome: 'uRibosome',
  cytoskeleton: 'uCytoskeleton',
  cellWall: 'uCellWall',
  cellWallLight: 'uCellWallLight',
  cilia: 'uCilia',
  ectoplasm: 'uEctoplasm',
  danger: 'uDanger',
  gain: 'uGain',
  sallow: 'uSallow',
} as const;

/** The uniform group the mesh's frame values and colours live in. */
export const CELL_UNIFORM_GROUP = 'cellUniforms';

/** `uPass` values: the body pass under the organelle sprites and the membrane pass over them. */
export const CELL_PASS = { body: 0, membrane: 1 } as const;
