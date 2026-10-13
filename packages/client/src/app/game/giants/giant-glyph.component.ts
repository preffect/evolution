// A giant cell's medallion as inline SVG (docs/ui/encyclopedia.md §11.3, ticket #846): the sibling of
// `<app-trait-glyph>` that draws the giant's form glyph in the giant's own palette (`giant-glyph.ts`). Like the other
// two, it adds only what it names; the frame, the view, the template and the `lod` and `still` inputs are
// `glyph-host.ts`'s. It tags itself with the species and the form it wears.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GiantSpecies } from '@evolution/shared';
import { GlyphHost } from '../glyphs/glyph-host';
import { GlyphLayersComponent } from '../glyphs/glyph-layers.component';
import type { GlyphDrawing } from '../render/svg-glyph';
import { giantFormTraitId } from './giant-forms';
import { giantGlyph } from './giant-glyph';

@Component({
  selector: 'app-giant-glyph',
  standalone: true,
  imports: [GlyphLayersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style]': 'motionVariables',
    '[attr.data-giant-species]': 'species()',
    '[attr.data-trait-id]': 'formTraitId()',
  },
  styleUrl: '../glyphs/glyph.component.css',
  template: `<svg appGlyphLayers [view]="view()" [still]="still()" [lod]="lod()"></svg>`,
})
export class GiantGlyphComponent extends GlyphHost {
  readonly species = input.required<GiantSpecies>();

  protected readonly formTraitId = computed(() => giantFormTraitId(this.species()));

  protected override drawing(): GlyphDrawing {
    return giantGlyph(this.species());
  }
}
