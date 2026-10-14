import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GIANT_SPECIES_ORDER, type GiantSpecies } from '@evolution/shared';
import { giantFormTraitId } from '../giants/giant-forms';
import { GLYPH_LOD, type GlyphLod } from '../glyphs/glyph-view';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import {
  CILIA,
  ENVELOPE,
  SILICA_BASE,
  SILICA_DARK,
  SILICA_LIGHT,
  VAC_BASE,
  VAC_RIM,
} from '../render/constants/colours';
import { GIANT_PALETTE_TABLE } from '../render/constants/giants';
import { EncyclopediaGlyphComponent } from './encyclopedia-glyph.component';
import type { EntryId } from './model/entry-id';

/** The colours the three form glyphs paint their body, fringe and nucleus in, which a giant's own palette replaces. */
const FORM_BODY_COLOURS = [VAC_BASE, VAC_RIM, SILICA_BASE, SILICA_LIGHT, SILICA_DARK, ENVELOPE, CILIA];
const LODS: readonly GlyphLod[] = [GLYPH_LOD.list, GLYPH_LOD.card];

function giantEntryId(species: GiantSpecies): EntryId {
  return `giant:${species}` as EntryId;
}

function mountEntry(entryId: EntryId, lod: GlyphLod): HTMLElement {
  const fixture = TestBed.createComponent(EncyclopediaGlyphComponent);
  fixture.componentRef.setInput('entryId', entryId);
  fixture.componentRef.setInput('lod', lod);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function mountTrait(species: GiantSpecies, lod: GlyphLod): HTMLElement {
  const fixture = TestBed.createComponent(TraitGlyphComponent);
  fixture.componentRef.setInput('traitId', giantFormTraitId(species));
  fixture.componentRef.setInput('lod', lod);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** Every colour the drawing paints: the solid fills and strokes, and the stops of its gradients. */
function paintedColours(root: HTMLElement): Set<string> {
  const paints = [...root.querySelectorAll('path')].flatMap((element) => [
    element.getAttribute('fill'),
    element.getAttribute('stroke'),
  ]);
  const stops = [...root.querySelectorAll('stop')].map((stop) => stop.getAttribute('stop-color'));
  return new Set([...paints, ...stops].filter((colour): colour is string => colour !== null && colour.startsWith('#')));
}

function pathData(root: HTMLElement): string[] {
  return [...root.querySelectorAll('path')].map((element) => element.getAttribute('d') ?? '');
}

describe('EncyclopediaGlyphComponent: a giant’s medallion (docs/ui/encyclopedia.md §11.3)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EncyclopediaGlyphComponent, TraitGlyphComponent] });
  });

  for (const species of GIANT_SPECIES_ORDER) {
    for (const lod of LODS) {
      it(`paints the ${species} at the ${lod} LOD in its own palette, not the form glyph’s colours`, () => {
        const colours = paintedColours(mountEntry(giantEntryId(species), lod));
        const palette = GIANT_PALETTE_TABLE[species];
        expect(colours).toContain(palette.base);
        expect(colours).toContain(palette.rim);
        expect(colours).toContain(palette.cytoDark);
        expect(FORM_BODY_COLOURS.filter((colour) => colours.has(colour))).toEqual([]);
      });

      it(`keeps the ${species}’s form glyph shape at the ${lod} LOD`, () => {
        expect(pathData(mountEntry(giantEntryId(species), lod))).toEqual(pathData(mountTrait(species, lod)));
      });
    }
  }

  it('draws a trait entry in the trait glyph’s own colours', () => {
    const colours = paintedColours(mountEntry('trait:amoeba_pseudopods' as EntryId, GLYPH_LOD.list));
    expect(colours).toContain(VAC_BASE);
  });
});
