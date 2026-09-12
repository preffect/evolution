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

/** `texelFetch(uInstances, ivec2(texel, vInstance), 0).<channel>` for one instance field. */
export function instanceRead(field: CellInstanceScalar): string {
  const [texel, channel] = instanceFieldLocation(field);
  return `texelFetch(uInstances, ivec2(${texel}, vInstance), 0).${CHANNEL_SWIZZLE[channel] ?? 'x'}`;
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
  danger: 'uDanger',
} as const;

/** The uniform group the mesh's frame values and colours live in. */
export const CELL_UNIFORM_GROUP = 'cellUniforms';

/** `uPass` values: the body pass under the organelle sprites and the membrane pass over them. */
export const CELL_PASS = { body: 0, membrane: 1 } as const;
