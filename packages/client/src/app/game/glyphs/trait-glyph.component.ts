// One trait's glyph (docs/visual-style/ui-type.md §7.1) as inline SVG: the medallion frame and the trait's layers,
// filling its host, so the caller sizes it in CSS (`TRAIT_GLYPH_CARD_PX` on a card or tile, `TRAIT_GLYPH_LIST_PX` in
// a list with `lod="list"`). `still` drops the idle loop, for lists where many glyphs sit together. Decorative: the
// text beside it names the trait. Each drawing gets its own gradient ids, since ids are global to the document and a
// card row draws several glyphs at once.

import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import type { TraitId } from '@evolution/shared';
import { GLYPH_BOX } from '../render/constants/trait-glyph-layers';
import { TRAIT_GLYPH_LOD, traitGlyphView, type TraitGlyphLod } from './trait-glyph-view';
import { TRAIT_GLYPHS } from './trait-glyphs';

@Component({
  selector: 'app-trait-glyph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './trait-glyph.component.css',
  template: `
    <svg
      class="glyph"
      [attr.viewBox]="viewBox"
      [attr.data-trait-id]="traitId()"
      [attr.data-lod]="lod()"
      [attr.data-still]="still()"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        @for (gradient of view().gradients; track gradient.id) {
          <radialGradient
            [attr.id]="gradient.id"
            [attr.cx]="gradient.fx"
            [attr.cy]="gradient.fy"
            [attr.fx]="gradient.fx"
            [attr.fy]="gradient.fy"
            [attr.r]="gradient.radius"
          >
            @for (stop of gradient.stops; track $index) {
              <stop [attr.offset]="stop.offset" [attr.stop-color]="stop.colour" [attr.stop-opacity]="stop.opacity" />
            }
          </radialGradient>
        }
      </defs>
      @for (layer of view().layers; track $index) {
        <g [attr.transform]="layer.transform">
          <path
            [attr.d]="layer.d"
            [attr.class]="still() ? null : layer.motionClass"
            [attr.fill]="layer.fill"
            [attr.fill-opacity]="layer.fillOpacity"
            [attr.stroke]="layer.stroke"
            [attr.stroke-width]="layer.strokeWidth"
            [attr.stroke-opacity]="layer.strokeOpacity"
            [attr.stroke-dasharray]="layer.dash"
            [style.animation-duration]="layer.animationDuration"
            [style.transform-origin]="layer.transformOrigin"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>
      }
    </svg>
  `,
})
export class TraitGlyphComponent {
  private static drawingsStarted = 0;

  readonly traitId = input.required<TraitId>();
  /** `card` at medallion size; `list` at one line of text, where the interior detail drops. */
  readonly lod = input<TraitGlyphLod>(TRAIT_GLYPH_LOD.card);
  /** `still`: no idle loop (list rows, where many glyphs sit together); the drawing is otherwise the same. */
  readonly still = input(false, { transform: booleanAttribute });

  protected readonly viewBox = `0 0 ${GLYPH_BOX} ${GLYPH_BOX}`;
  private readonly idPrefix = TraitGlyphComponent.nextIdPrefix();
  protected readonly view = computed(() => traitGlyphView(TRAIT_GLYPHS[this.traitId()], this.lod(), this.idPrefix));

  private static nextIdPrefix(): string {
    TraitGlyphComponent.drawingsStarted += 1;
    return `trait-glyph-${TraitGlyphComponent.drawingsStarted}`;
  }
}
