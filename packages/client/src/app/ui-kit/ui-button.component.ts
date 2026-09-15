// The kit's button (docs/ui/components-and-constants.md §10.2), on a native `<button>` so it is a Tab stop and Enter
// and Space press it. Its width is its label (and key hint) plus the inline padding. The states table: hover and
// pressed lay a text-colour tint over the variant's fill, `:focus-visible` alone draws the unscaled ring, and a
// disabled button keeps its Tab stop (`aria-disabled`, so it can still be found and read) but fades, takes no
// hover and swallows its clicks.

import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { UiKeyHintComponent } from './ui-key-hint.component';

export const UI_BUTTON_VARIANT = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  quiet: 'quiet',
  icon: 'icon',
} as const;
export type UiButtonVariant = (typeof UI_BUTTON_VARIANT)[keyof typeof UI_BUTTON_VARIANT];

export const UI_BUTTON_SIZE = { regular: 'regular', compact: 'compact' } as const;
export type UiButtonSize = (typeof UI_BUTTON_SIZE)[keyof typeof UI_BUTTON_SIZE];

@Component({
  selector: 'button[uiButton]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiKeyHintComponent],
  template: `
    <span class="label"><ng-content /></span>
    @if (keyHint(); as key) {
      <ui-key-hint [key]="key" />
    }
  `,
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.aria-keyshortcuts]': 'keyHint()',
    '[attr.aria-disabled]': 'ariaDisabled()',
    '[attr.data-testid]': 'testId()',
  },
  styleUrl: './ui-button.component.css',
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>(UI_BUTTON_VARIANT.secondary);
  readonly size = input<UiButtonSize>(UI_BUTTON_SIZE.regular);
  /** The key that also presses it, named as `KeyboardEvent.key` names it; shown as a keycap. */
  readonly keyHint = input<string | null>(null);
  readonly isDisabled = input(false);
  readonly testId = input<string | null>(null);

  protected readonly ariaDisabled = computed(() => (this.isDisabled() ? 'true' : null));

  constructor() {
    // Registered before any template `(click)` on the same button, so a disabled press never reaches one.
    const element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
    element.addEventListener('click', (event) => this.swallowWhileDisabled(event), { capture: true });
  }

  private swallowWhileDisabled(event: Event): void {
    if (!this.isDisabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
