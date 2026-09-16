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
        <div class="heading">
          <h2 class="title" [id]="titleId">{{ text }}</h2>
          @if (subtitle(); as line) {
            <p class="subtitle" [id]="subtitleId">{{ line }}</p>
          }
        </div>
      }
      <ng-content select="[uiPanelHeader]" />
    </header>
    <ui-scroll-area class="body" [label]="title()"><ng-content /></ui-scroll-area>
    <!-- Under the body but outside its scroll area, which clips at its padding box: a section here can take the
         panel padding back with a negative inline margin and run edge to edge (the menu's Your traits rule). -->
    <ng-content select="[uiPanelBleed]" />
    <footer class="footer"><ng-content select="[uiPanelFooter]" /></footer>
  `,
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.role]': 'role()',
    '[attr.aria-modal]': 'ariaModal()',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.data-testid]': 'testId()',
  },
  styleUrl: './ui-panel.component.css',
})
export class UiPanelComponent {
  readonly variant = input<UiPanelVariant>(UI_PANEL_VARIANT.modal);
  readonly title = input<string | null>(null);
  /** One muted `body` line under the title (the menu's `The dish keeps running.`); it describes the panel. */
  readonly subtitle = input<string | null>(null);
  readonly testId = input<string | null>(null);

  protected readonly titleId = nextUiElementId('ui-panel-title');
  protected readonly subtitleId = nextUiElementId('ui-panel-subtitle');
  protected readonly role = computed(() => PANEL_ROLE[this.variant()]);
  protected readonly ariaModal = computed(() => (this.variant() === UI_PANEL_VARIANT.modal ? 'true' : null));
  protected readonly labelledBy = computed(() => (this.title() ? this.titleId : null));
  protected readonly describedBy = computed(() => (this.title() && this.subtitle() ? this.subtitleId : null));
}
