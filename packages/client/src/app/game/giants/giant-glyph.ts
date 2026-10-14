// A giant cell's medallion (docs/ui/encyclopedia.md §11.3, ticket #846): its form's trait glyph, shape for shape, in
// the giant's own palette (`GIANT_PALETTE_TABLE`, the one the dish and the encyclopedia preview draw it in), so the
// list row and the tile match the giant the preview shows. Pure: a recoloured copy of the trait glyph's layers.

import type { GiantSpecies } from '@evolution/shared';
import { TRAIT_GLYPHS } from '../glyphs/trait-glyphs';
import { GIANT_GLYPH_SHADE_BY_COLOUR, GIANT_PALETTE_TABLE } from '../render/constants/giants';
import type { GlyphDrawing, GlyphFill, GlyphLayer, GlyphRamp, GlyphStroke } from '../render/svg-glyph';
import { giantFormTraitId } from './giant-forms';

type Recolour = (colour: string) => string;

function recolourFill(fill: GlyphFill, recolour: Recolour): GlyphFill {
  if (fill.kind !== 'ramp') return { ...fill, colour: recolour(fill.colour) };
  const ramp: GlyphRamp = {
    light: recolour(fill.ramp.light),
    base: recolour(fill.ramp.base),
    dark: recolour(fill.ramp.dark),
  };
  return { ...fill, ramp };
}

function recolourStroke(stroke: GlyphStroke, recolour: Recolour): GlyphStroke {
  return { ...stroke, colour: recolour(stroke.colour) };
}

function recolourLayer(layer: GlyphLayer, recolour: Recolour): GlyphLayer {
  return {
    ...layer,
    ...(layer.fill === undefined ? {} : { fill: recolourFill(layer.fill, recolour) }),
    ...(layer.stroke === undefined ? {} : { stroke: recolourStroke(layer.stroke, recolour) }),
  };
}

/** `species`' medallion: its form's trait glyph with the form's body colours swapped for the species' shades. */
export function giantGlyph(species: GiantSpecies): GlyphDrawing {
  const form = TRAIT_GLYPHS[giantFormTraitId(species)];
  const palette = GIANT_PALETTE_TABLE[species];
  const recolour: Recolour = (colour) => {
    const shade = GIANT_GLYPH_SHADE_BY_COLOUR[colour];
    return shade === undefined ? colour : palette[shade];
  };
  return { tiltDeg: form.tiltDeg, layers: form.layers.map((layer) => recolourLayer(layer, recolour)) };
}
