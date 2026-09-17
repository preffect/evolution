// One encyclopedia subject's glyph (docs/visual-style/ui-type.md §7.2) as inline SVG: the sibling of
// `<app-trait-glyph>` for every subject that is no trait. It adds only the entry it names and the `SUBJECT_GLYPHS`
// row that names it; the frame, the view builder, the template, the stylesheet and the `lod` and `still` inputs are
// `glyph-host.ts`'s, shared with the trait glyph, so a list row that mixes the two draws one kind of thing.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { GlyphDrawing, SubjectEntryId } from '../render/svg-glyph';
import { GlyphHost } from './glyph-host';
import { GlyphLayersComponent } from './glyph-layers.component';
import { SUBJECT_GLYPHS } from './subject-glyphs';

@Component({
  selector: 'app-subject-glyph',
  standalone: true,
  imports: [GlyphLayersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style]': 'motionVariables', '[attr.data-entry-id]': 'entryId()' },
  styleUrl: './glyph.component.css',
  template: `<svg appGlyphLayers [view]="view()" [still]="still()" [lod]="lod()"></svg>`,
})
export class SubjectGlyphComponent extends GlyphHost {
  readonly entryId = input.required<SubjectEntryId>();

  protected override drawing(): GlyphDrawing {
    return SUBJECT_GLYPHS[this.entryId()];
  }
}
