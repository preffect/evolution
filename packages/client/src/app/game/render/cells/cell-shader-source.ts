// The GLSL helpers every cell shader file shares: a float literal that is always a float, the
// instance-texture columns (one table with `cell-instance.ts`, pinned by its spec) and the names
// of the uniforms the layer sets.

import { BUMP_TEXEL_START, instanceFieldLocation, type CellInstance } from './cell-instance';

/** A number as a GLSL float literal (`3` → `3.0`, `1e-9` stays). */
export function glslFloat(value: number): string {
  const text = String(value);
  return text.includes('.') || text.includes('e') || text.includes('n') ? text : `${text}.0`;
}

/** `texelFetch(uInstances, ivec2(texel, vInstance), 0).<channel>` for one instance field. */
export function instanceRead(field: keyof CellInstance): string {
  const [texel, channel] = instanceFieldLocation(field);
  const swizzle = ['x', 'y', 'z', 'w'][channel] ?? 'x';
  return `texelFetch(uInstances, ivec2(${texel}, vInstance), 0).${swizzle}`;
}

export const BUMP_TEXEL_START_GLSL = String(BUMP_TEXEL_START);

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
  cilia: 'uCilia',
  cellWall: 'uCellWall',
  cellWallLight: 'uCellWallLight',
  ribosome: 'uRibosome',
  cytoskeleton: 'uCytoskeleton',
  danger: 'uDanger',
  chloroLight: 'uChloroLight',
  toxinGlow: 'uToxinGlow',
} as const;

/** `uPass` values: the body pass under the organelle sprites and the membrane pass over them. */
export const CELL_PASS = { body: 0, membrane: 1 } as const;
