// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GIANT_SPECIES_ORDER } from '@evolution/shared';
import { TRAIT_GLYPHS } from '../glyphs/trait-glyphs';
import { GIANT_GLYPH_SHADE_BY_COLOUR, GIANT_PALETTE_TABLE } from '../render/constants/giants';
import type { GlyphDrawing, GlyphLayer } from '../render/svg-glyph';
import { giantFormTraitId } from './giant-forms';
import { giantGlyph } from './giant-glyph';

/** A layer's colours in a fixed order: its fill (or ramp's light, base, dark), then its stroke. */
function layerColours(layer: GlyphLayer): string[] {
  const fill = layer.fill;
  const fillColours =
    fill === undefined ? [] : fill.kind === 'ramp' ? [fill.ramp.light, fill.ramp.base, fill.ramp.dark] : [fill.colour];
  return [...fillColours, ...(layer.stroke === undefined ? [] : [layer.stroke.colour])];
}

function drawingColours(drawing: GlyphDrawing): string[] {
  return drawing.layers.flatMap(layerColours);
}

/** The layers with their colours taken out: what must be identical between a giant and its form. */
function uncoloured(drawing: GlyphDrawing): unknown[] {
  return drawing.layers.map((layer) => ({
    ...layer,
    fill: layer.fill === undefined ? undefined : { kind: layer.fill.kind, opacity: layer.fill.opacity },
    stroke: layer.stroke === undefined ? undefined : { ...layer.stroke, colour: undefined },
  }));
}

describe('giantGlyph (docs/ui/encyclopedia.md §11.3)', () => {
  for (const species of GIANT_SPECIES_ORDER) {
    const form = TRAIT_GLYPHS[giantFormTraitId(species)];
    const palette = GIANT_PALETTE_TABLE[species];

    it(`draws the ${species} as its form glyph, layer for layer, at the same tilt`, () => {
      const glyph = giantGlyph(species);
      expect(glyph.tiltDeg).toBe(form.tiltDeg);
      expect(uncoloured(glyph)).toEqual(uncoloured(form));
    });

    it(`paints each of the ${species}' form colours in the species shade the table names, and keeps the rest`, () => {
      const expected = drawingColours(form).map((colour) => {
        const shade = GIANT_GLYPH_SHADE_BY_COLOUR[colour];
        return shade === undefined ? colour : palette[shade];
      });
      expect(drawingColours(giantGlyph(species))).toEqual(expected);
    });

    it(`leaves none of the form's body colours on the ${species}`, () => {
      const colours = new Set(drawingColours(giantGlyph(species)));
      const stale = Object.keys(GIANT_GLYPH_SHADE_BY_COLOUR).filter(
        (colour) => colours.has(colour) && !Object.values(palette).includes(colour),
      );
      expect(stale).toEqual([]);
      expect(colours).toContain(palette.base);
      expect(colours).toContain(palette.rim);
    });
  }

  it('names only colours one of the giants’ forms actually paints', () => {
    const formColours = new Set(
      GIANT_SPECIES_ORDER.flatMap((species) => drawingColours(TRAIT_GLYPHS[giantFormTraitId(species)])),
    );
    expect(Object.keys(GIANT_GLYPH_SHADE_BY_COLOUR).filter((colour) => !formColours.has(colour))).toEqual([]);
  });
});
