// The glyph medallion a list row and a landing tile lead with (docs/ui/encyclopedia.md §11.3): a trait's glyph
// (#312), a giant cell's (its form's glyph in its own palette, #846) or, for every other subject, that subject's
// (#391). All three draw their own disc and rim, so none is wrapped in a `ui-medallion` — the kit's medallion is for
// a mark that has no disc of its own (§10.2).
//
// One component rather than the choice in three templates: the list, the landing and, later, the entry page all ask
// the same question of an entry id, and `glyphSubjectOf` answers it once.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GiantGlyphComponent } from '../giants/giant-glyph.component';
import { GLYPH_LOD, type GlyphLod } from '../glyphs/glyph-view';
import { SubjectGlyphComponent } from '../glyphs/subject-glyph.component';
import { TraitGlyphComponent } from '../glyphs/trait-glyph.component';
import { GLYPH_SUBJECT, glyphSubjectOf } from './format/glyph-subject';
import type { EntryId } from './model/entry-id';

@Component({
  selector: 'app-encyclopedia-glyph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GiantGlyphComponent, SubjectGlyphComponent, TraitGlyphComponent],
  template: `
    @let drawn = subject();
    @switch (drawn.kind) {
      @case (glyphSubject.trait) {
        <app-trait-glyph class="glyph" [traitId]="drawn.traitId" [lod]="lod()" still />
      }
      @case (glyphSubject.giant) {
        <app-giant-glyph class="glyph" [species]="drawn.species" [lod]="lod()" still />
      }
      @default {
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

  protected readonly glyphSubject = GLYPH_SUBJECT;
  protected readonly subject = computed(() => glyphSubjectOf(this.entryId()));
}
