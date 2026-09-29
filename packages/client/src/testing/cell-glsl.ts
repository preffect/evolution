// The cell shader specs read the GLSL as a string (`cell-shader-*.spec.ts`): what a string can prove is pinned —
// the baked numbers, the gates, the colours and the order in a pass — one function at a time.

import { CELL_FRAGMENT_SOURCE } from '../app/game/render/cells/cell-shader';

/** The source of the fragment-stage GLSL function whose signature starts `signature`, to its closing brace. */
export function glslFunction(signature: string): string {
  const start = CELL_FRAGMENT_SOURCE.indexOf(signature);
  if (start < 0) throw new Error(`${signature} is not in the fragment source`);
  return CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
}
