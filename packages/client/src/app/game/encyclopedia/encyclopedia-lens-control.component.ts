// The lens control (docs/ui/encyclopedia.md §11.4): centred under the lens, `UI_SPACE_M_PX` below it. For a trait it
// is the tier switch — one segment per `tier_n` section, labelled with the tier's numeral — and selecting one shows
// that tier's preview in the lens above.
//
// Every segment is a real `<button>` on the kit's own quiet compact variant, so it is a Tab stop with the kit's
// focus ring and Enter and Space press it. The switch is a `role="group"` rather than a roving radio group: there
// are three of them, they sit outside both roving columns (§11.5), and an arrow key inside the detail column
// belongs to the scroll area.
//
// The action scenes' `Replay` (§11.4) is **not** here yet: the action pages that show those scenes landed with #362,
// and the control is ticket #577.

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TraitTier } from '@evolution/shared';
import { UI_BUTTON_SIZE, UI_BUTTON_VARIANT, UiButtonComponent } from '../../ui-kit/ui-button.component';
import type { EncyclopediaTierSegment } from './format/entry-view';
import { encyclopediaTierTestId } from './test-ids';

/** What a screen reader meets: the group's name, and each segment's, since a numeral alone says nothing. */
const TIER_SWITCH_LABEL = 'Tier';

@Component({
  selector: 'app-encyclopedia-lens-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent],
  styleUrl: './encyclopedia-lens-control.component.css',
  template: `
    <div class="switch" role="group" [attr.aria-label]="switchLabel">
      @for (segment of segments(); track segment.tier) {
        <button
          type="button"
          uiButton
          [variant]="variant"
          [size]="size"
          [attr.aria-label]="switchLabel + ' ' + segment.numeral"
          [attr.aria-pressed]="segment.tier === selectedTier()"
          [testId]="tierTestId(segment.tier)"
          (click)="tierSelected.emit(segment.tier)"
        >
          {{ segment.numeral }}
        </button>
      }
    </div>
  `,
})
export class EncyclopediaLensControlComponent {
  readonly segments = input.required<readonly EncyclopediaTierSegment[]>();
  readonly selectedTier = input.required<TraitTier>();
  readonly tierSelected = output<TraitTier>();

  protected readonly switchLabel = TIER_SWITCH_LABEL;
  protected readonly variant = UI_BUTTON_VARIANT.quiet;
  protected readonly size = UI_BUTTON_SIZE.compact;
  protected readonly tierTestId = encyclopediaTierTestId;
}
