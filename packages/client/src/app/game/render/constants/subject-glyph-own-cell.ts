// The player's own cell as a subject glyph draws it (docs/visual-style/ui-type.md §7.2): the body the concepts compare
// and the HUD indicators are drawn on, in the first seat's palette.

import type { GlyphLayer, GlyphMotion } from '../svg-glyph';
import { SUBJECT_RAMP, SUBJECT_STROKE, roundBodyLayers } from './subject-glyph-motifs';
import { stroke } from './trait-glyph-layers';

/** Under this radius the own cell's rim is drawn fine, so a small bead is not all rim. */
const OWN_CELL_FINE_RIM_RADIUS = 10;

/** The own cell as a lit bead of `radius` at the centre point. */
export function ownCellLayers(
  centreX: number,
  centreY: number,
  radius: number,
  motion?: GlyphMotion,
): readonly GlyphLayer[] {
  return roundBodyLayers({
    cx: centreX,
    cy: centreY,
    radius,
    ramp: SUBJECT_RAMP.player,
    rim: stroke(
      SUBJECT_RAMP.player.light,
      radius > OWN_CELL_FINE_RIM_RADIUS ? SUBJECT_STROKE.rim : SUBJECT_STROKE.fine,
    ),
    ...(motion === undefined ? {} : { motion }),
  });
}
