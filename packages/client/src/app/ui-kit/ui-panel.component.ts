// The kit's panel (docs/ui/components-and-constants.md §10.2). `modal`: the opaque panel gradient with its rim and lit
// top edge, a dialog labelled by its title, entering over `UI_PANEL_ENTER_MS`; its host places it, over a
// `ui-scrim`, inside a `[uiFocusTrap]`. `side`: the translucent gradient over a blur of the dish, a region with
// no scrim, no trap and no motion, because it shows while a key is held; its host anchors it to a viewport edge,
// and it takes the pointer only on its controls. The kit never places either.

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { nextUiElementId } from './ui-element-id';
import { UiScrollAreaComponent } from './ui-scroll-area.component';

export const UI_PANEL_VARIANT = { modal: 'modal', side: 'side' } as const;
export type UiPanelVariant = (typeof UI_PANEL_VARIANT)[keyof typeof UI_PANEL_VARIANT];

const PANEL_ROLE: Readonly<Record<UiPanelVariant, string>> = {
  [UI_PANEL_VARIANT.modal]: 'dialog',
  [UI_PANEL_VARIANT.side]: 'region',
};

@Component({
  selector: 'ui-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiScrollAreaComponent],
  template: `
    <header class="header">
      @if (title(); as text) {
        <h2 class="title" [id]="titleId">{{ text }}</h2>
      }
      <ng-content select="[uiPanelHeader]" />
    </header>
    <ui-scroll-area class="body"><ng-content /></ui-scroll-area>
    <footer class="footer"><ng-content select="[uiPanelFooter]" /></footer>
  `,
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.role]': 'role()',
    '[attr.aria-modal]': 'ariaModal()',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.data-testid]': 'testId()',
  },
  styleUrl: './ui-panel.component.css',
})
export class UiPanelComponent {
  readonly variant = input<UiPanelVariant>(UI_PANEL_VARIANT.modal);
  readonly title = input<string | null>(null);
  readonly testId = input<string | null>(null);

  protected readonly titleId = nextUiElementId('ui-panel-title');
  protected readonly role = computed(() => PANEL_ROLE[this.variant()]);
  protected readonly ariaModal = computed(() => (this.variant() === UI_PANEL_VARIANT.modal ? 'true' : null));
  protected readonly labelledBy = computed(() => (this.title() ? this.titleId : null));
}
