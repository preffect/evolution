// The one renderer of an `EncyclopediaIcon` (docs/ui/encyclopedia.md §11.3): the rail's category marks and the
// header's Back and Close, from the tables in `encyclopedia-icons.ts`. Decorative — the control around it carries the
// name — and painted in `currentColor`, so a selected rail item's icon takes the accent along with its label. The
// caller sizes the box in CSS; nothing here knows how big it is drawn.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ENCYCLOPEDIA_ICON_STROKE, type EncyclopediaIcon } from './encyclopedia-icons';

@Component({
  selector: 'app-encyclopedia-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="icon" [attr.viewBox]="icon().viewBox" [attr.stroke-width]="stroke" aria-hidden="true" focusable="false">
      @for (path of icon().paths; track $index) {
        <svg:path [class.filled]="path.isFilled" [attr.d]="path.d" [attr.stroke-dasharray]="path.dashArray" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .icon {
        display: block;
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .filled {
        fill: currentcolor;
        stroke: none;
      }
    `,
  ],
})
export class EncyclopediaIconComponent {
  readonly icon = input.required<EncyclopediaIcon>();

  protected readonly stroke = ENCYCLOPEDIA_ICON_STROKE;
}
