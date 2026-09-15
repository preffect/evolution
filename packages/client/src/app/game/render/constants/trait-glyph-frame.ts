// The medallion every trait glyph sits in (docs/visual-style/ui-type.md §7.1): a dark-field disc lit from the
// top-left by the condenser, with a `PANEL_RIM` rim that scatters brightest at the top-left
// (visual-style/principles-and-palette.md §1). It is the glyph's stage on any HUD panel, so the glyph never
// depends on what is behind it.

import { GLYPH_ROLE, circle, path, type GlyphLayer, type GlyphRamp } from '../svg-glyph';
import { BG_DEEP, BG_FIELD, LIGHT_ACCENT, PANEL_RIM, PANEL_TOP } from './colours';
import { GLYPH_CENTRE, GLYPH_FRAME, haloLayer, paint, stroke } from './trait-glyph-layers';

/** The stage's ramp: the panel's top tone under the light, the field across the disc, the deep field at the rim. */
export const GLYPH_FIELD_RAMP: GlyphRamp = { light: PANEL_TOP, base: BG_FIELD, dark: BG_DEEP };

/** Drawn under every glyph and never tilted or dropped by a LOD. */
export const GLYPH_FRAME_LAYERS: readonly GlyphLayer[] = [
  paint(GLYPH_ROLE.body, circle(GLYPH_CENTRE, GLYPH_CENTRE, GLYPH_FRAME.radius), {
    fill: { kind: 'ramp', ramp: GLYPH_FIELD_RAMP, opacity: 1 },
    stroke: stroke(PANEL_RIM, GLYPH_FRAME.rimWidth),
  }),
  haloLayer(
    circle(GLYPH_FRAME.poolCx, GLYPH_FRAME.poolCy, GLYPH_FRAME.poolRadius),
    LIGHT_ACCENT,
    GLYPH_FRAME.poolOpacity,
  ),
  paint(GLYPH_ROLE.glint, path(GLYPH_FRAME.rimLightPath), {
    stroke: stroke(LIGHT_ACCENT, GLYPH_FRAME.rimWidth, GLYPH_FRAME.rimLightOpacity),
  }),
];
