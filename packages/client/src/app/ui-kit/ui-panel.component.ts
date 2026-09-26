// The kit's panel (docs/ui/components-and-constants.md §10.2). `modal`: the opaque panel gradient with its rim and lit
// top edge, a dialog labelled by its title, entering over `UI_PANEL_ENTER_MS`; its host places it, over a
// `ui-scrim`, inside a `[uiFocusTrap]`. `side`: the translucent gradient over a blur of the dish, a region with
// no scrim, no trap and no motion, because it shows while a key is held; its host anchors it to a viewport edge,
// and it takes the pointer only on its controls. The kit never places either. Under the body, the `[uiPanelBleed]` slot
// spans the panel's full width for a section whose rule runs edge to edge (#439).

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { nextUiElementId } from './ui-element-id';
import { UiScrollAreaComponent } from './ui-scroll-area.component';

export const UI_PANEL_VARIANT = { modal: 'modal', side: 'side' } as const;
export type UiPanelVariant = (typeof UI_PANEL_VARIANT)[keyof typeof UI_PANEL_VARIANT];

/**
 * What the body is (#461). `scroll`: the kit's, padded and wrapped in one kit scroll area, scrolling as one page.
 * `bleed`: the feature's, with no padding, no gap and no scroll area: a plain flex column the feature fills edge to
 * edge and scrolls where it chooses (the encyclopedia's three columns, docs/ui/encyclopedia.md §11.3).
 */
export const UI_PANEL_BODY = { scroll: 'scroll', bleed: 'bleed' } as const;
export type UiPanelBody = (typeof UI_PANEL_BODY)[keyof typeof UI_PANEL_BODY];

const PANEL_ROLE: Readonly<Record<UiPanelVariant, string>> = {
  [UI_PANEL_VARIANT.modal]: 'dialog',
  [UI_PANEL_VARIANT.side]: 'region',
};

@Component({
  selector: 'ui-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, UiScrollAreaComponent],
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
    <!-- One projection, placed by the body mode: content projects once, so both branches borrow the same template. -->
    <ng-template #bodyContent><ng-content /></ng-template>
    @if (isBleed()) {
      <div class="body bleed"><ng-container [ngTemplateOutlet]="bodyContent" /></div>
    } @else {
      <ui-scroll-area class="body" [label]="title()"><ng-container [ngTemplateOutlet]="bodyContent" /></ui-scroll-area>
    }
    <!-- Under the body but outside its scroll area, which clips at its padding box: the kit takes the panel padding
         back here, so a section in this slot runs edge to edge and re-insets its own children by --panel-inset. -->
    <div class="bleed-slot"><ng-content select="[uiPanelBleed]" /></div>
    <footer class="footer"><ng-content select="[uiPanelFooter]" /></footer>
  `,
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.data-body]': 'body()',
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
  readonly body = input<UiPanelBody>(UI_PANEL_BODY.scroll);
  readonly title = input<string | null>(null);
  /** One muted `body` line under the title (the menu's `The dish keeps running.`); it describes the panel. */
  readonly subtitle = input<string | null>(null);
  readonly testId = input<string | null>(null);

  protected readonly titleId = nextUiElementId('ui-panel-title');
  protected readonly subtitleId = nextUiElementId('ui-panel-subtitle');
  protected readonly isBleed = computed(() => this.body() === UI_PANEL_BODY.bleed);
  protected readonly role = computed(() => PANEL_ROLE[this.variant()]);
  protected readonly ariaModal = computed(() => (this.variant() === UI_PANEL_VARIANT.modal ? 'true' : null));
  protected readonly labelledBy = computed(() => (this.title() ? this.titleId : null));
  protected readonly describedBy = computed(() => (this.title() && this.subtitle() ? this.subtitleId : null));
}
