// What a form's appendages add to a reach (docs/visual-style/motion-and-legibility.md §5.1 rule 5): the quad
// (`shape-terms.ts`) and the preview lens (`cell-draw-extent.ts`) never clip the paramecium's cilia tufts (#193), the
// euglena's flagellum (#194) or the diatom's spines (#195). The amoeba's arms are bumps of the membrane itself, so the
// body bound already counts them.

import { spineDrawnReachRadii } from './diatom-spines';
import { flagellumDrawnReachRadii } from './euglena-flagellum';
import { reachWithCiliaTufts, type TuftOwner } from './paramecium-cilia';

/**
 * `reachRadii` (the halo, the hairs), or the furthest a form's appendage draws off a membrane `membraneRadii` out. The
 * owner is the cell's form and its giant species: a giant paramecium wears no tufts.
 */
export function reachWithFormAppendages(owner: TuftOwner, reachRadii: number, membraneRadii: number): number {
  return Math.max(
    reachWithCiliaTufts(owner, reachRadii, membraneRadii),
    flagellumDrawnReachRadii(owner.form, membraneRadii),
    spineDrawnReachRadii(owner.form, membraneRadii),
  );
}
