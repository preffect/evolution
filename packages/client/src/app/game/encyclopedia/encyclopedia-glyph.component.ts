// The glyph medallion a list row and a landing tile lead with (docs/ui/encyclopedia.md §11.3): a trait's glyph
// (#312) or, for every other subject, that subject's (#391). Both draw their own disc and rim, so neither is wrapped
// in a `ui-medallion` — the kit's medallion is for a mark that has no disc of its own (§10.2).
//
// One component rather than the choice in three templates: the list, the landing and, later, the entry page all ask
// the same question of an entry id, and `glyphSubjectOf` answers it once.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GLYPH_LOD, type GlyphLod } from '../glyphs/glyph-view';
import { SubjectGlyphComponent } from '../glyphs/subject-glyph.component';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import { GLYPH_SUBJECT, glyphSubjectOf } from './format/glyph-subject';
import type { EntryId } from './model/entry-id';

@Component({
  selector: 'app-encyclopedia-glyph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SubjectGlyphComponent, TraitGlyphComponent],
  template: `
    @if (subject(); as drawn) {
      @if (drawn.kind === traitKind) {
        <app-trait-glyph class="glyph" [traitId]="drawn.traitId" [lod]="lod()" still />
      } @else {
        <app-subject-glyph class="glyph" [entryId]="drawn.entryId" [lod]="lod()" still />
      }
    }
  `,
  styles: [
    `
      :host,
      .glyph {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class EncyclopediaGlyphComponent {
  readonly entryId = input.required<EntryId>();
  /** `list` beside one line of text, `card` on a tile; the same word both glyph components take. */
  readonly lod = input<GlyphLod>(GLYPH_LOD.list);

  protected readonly traitKind = GLYPH_SUBJECT.trait;
  protected readonly subject = computed(() => glyphSubjectOf(this.entryId()));
}
