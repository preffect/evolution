// What a form's appendages add to a reach (docs/visual-style/motion-and-legibility.md §5.1 rule 5): the quad
// (`shape-terms.ts`) and the preview lens (`cell-draw-extent.ts`) never clip the paramecium's cilia tufts (#193) or the
// euglena's flagellum (#194). The amoeba's arms are bumps of the membrane itself, so the body bound already counts them.

import { flagellumDrawnReachRadii } from './euglena-flagellum';
import type { FormDefinition } from './form-profiles';
import { reachWithCiliaTufts } from './paramecium-cilia';

/** `reachRadii` (the halo, the hairs), or the furthest a form's appendage draws off a membrane `membraneRadii` out. */
export function reachWithFormAppendages(form: FormDefinition, reachRadii: number, membraneRadii: number): number {
  return Math.max(reachWithCiliaTufts(form, reachRadii, membraneRadii), flagellumDrawnReachRadii(form, membraneRadii));
}
