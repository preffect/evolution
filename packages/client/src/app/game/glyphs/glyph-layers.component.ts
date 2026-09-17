// The one renderer a glyph view turns into (docs/visual-style/ui-type.md §7.1): the gradients as defs, then every
// layer as one `<svg:path>` inside a group carrying its transform. It is an SVG group, not a host element, so a trait
// glyph and a subject glyph each keep their own `<svg>` (and their own data attributes) while sharing this — the
// drawing is written once, and a change to how a layer paints reaches both.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GLYPH_BOX } from '../render/constants/trait-glyph-layers';
import type { GlyphLod, GlyphView } from './glyph-view';

@Component({
  selector: 'svg[appGlyphLayers]',
  standalone: true,
  styleUrl: './glyph-layers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'glyph',
    'aria-hidden': 'true',
    focusable: 'false',
    '[attr.viewBox]': 'viewBox',
    '[attr.data-lod]': 'lod()',
    '[attr.data-still]': 'still()',
  },
  template: `
    <svg:defs>
      <svg:clipPath [attr.id]="view().clip.id">
        <svg:circle [attr.cx]="view().clip.cx" [attr.cy]="view().clip.cy" [attr.r]="view().clip.radius" />
      </svg:clipPath>
      @for (gradient of view().gradients; track gradient.id) {
        <svg:radialGradient
          [attr.id]="gradient.id"
          [attr.cx]="gradient.fx"
          [attr.cy]="gradient.fy"
          [attr.fx]="gradient.fx"
          [attr.fy]="gradient.fy"
          [attr.r]="gradient.radius"
        >
          @for (stop of gradient.stops; track $index) {
            <svg:stop [attr.offset]="stop.offset" [attr.stop-color]="stop.colour" [attr.stop-opacity]="stop.opacity" />
          }
        </svg:radialGradient>
      }
    </svg:defs>
    @for (layer of view().layers; track $index) {
      <svg:g [attr.clip-path]="layer.clipPath">
        <svg:g [attr.transform]="layer.transform">
          <svg:path
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
            [attr.stroke-linecap]="layer.lineCap"
            stroke-linejoin="round"
          />
        </svg:g>
      </svg:g>
    }
  `,
})
export class GlyphLayersComponent {
  readonly view = input.required<GlyphView>();
  /** `still`: no idle loop (list rows, where many glyphs sit together); the drawing is otherwise the same. */
  readonly still = input.required<boolean>();
  /** Carried so a test and the CSS can see which size the drawing was built for; the view is already at that LOD. */
  readonly lod = input.required<GlyphLod>();

  protected readonly viewBox = `0 0 ${GLYPH_BOX} ${GLYPH_BOX}`;
}
