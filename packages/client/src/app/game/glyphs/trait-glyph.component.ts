// One trait's glyph (docs/visual-style/ui-type.md §7.1) as inline SVG: the medallion frame and the trait's layers,
// drawn by `GlyphHost`'s shared template and view. The trait is all this file adds — `<app-trait-glyph traitId>`,
// and the `TRAIT_GLYPHS` row it names. Everything else (the `lod` and `still` inputs, the box, the idle amplitudes,
// the gradient ids) is `glyph-host.ts`'s, shared with `<app-subject-glyph>`.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TraitId } from '@evolution/shared';
import type { GlyphDrawing } from '../render/svg-glyph';
import { GlyphHost } from './glyph-host';
import { GlyphLayersComponent } from './glyph-layers.component';
import { TRAIT_GLYPHS } from './trait-glyphs';

@Component({
  selector: 'app-trait-glyph',
  standalone: true,
  imports: [GlyphLayersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style]': 'motionVariables', '[attr.data-trait-id]': 'traitId()' },
  styleUrl: './glyph.component.css',
  template: `<svg appGlyphLayers [view]="view()" [still]="still()" [lod]="lod()"></svg>`,
})
export class TraitGlyphComponent extends GlyphHost {
  readonly traitId = input.required<TraitId>();

  protected override drawing(): GlyphDrawing {
    return TRAIT_GLYPHS[this.traitId()];
  }
}
