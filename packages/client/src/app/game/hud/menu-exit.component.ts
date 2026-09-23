// The menu's `Exit game` row (docs/ui/overlays.md §3.5), which asks once: leaving drops the seat (#319), so one stray
// click must not do it. The row keeps its size and danger rim and becomes `Leave this round?` with `Exit` and then
// `Cancel` (focused) at the trailing end, where a quick second click on `Exit game` lands. `Cancel` or Escape
// restores the row with focus on `Exit game`; that Escape is consumed (`preventDefault`, input-and-onboarding.md §4),
// so the document's handler does not also close the menu.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  output,
  signal,
} from '@angular/core';
import { UiButtonComponent } from '../../ui-kit/ui-button.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

@Component({
  selector: 'app-menu-exit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent],
  template: `
    @if (isConfirming()) {
      <div class="confirm" role="group" aria-label="Leave this round?" (keydown.escape)="cancelByEscape($event)">
        <span class="question">Leave this round?</span>
        <button
          type="button"
          uiButton
          variant="danger"
          size="compact"
          [testId]="testId.menuExitConfirm"
          (click)="exited.emit()"
        >
          Exit
        </button>
        <button
          type="button"
          uiButton
          variant="secondary"
          size="compact"
          [testId]="testId.menuExitCancel"
          (click)="cancel()"
        >
          Cancel
        </button>
      </div>
    } @else {
      <button type="button" class="exit" uiButton variant="danger" [testId]="testId.menuExit" (click)="ask()">
        Exit game
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .exit {
        width: 100%;
        justify-content: flex-start;
      }

      /* The danger button's size and rim, holding the question and two compact buttons centred in its height. */
      .confirm {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: calc(var(--ui-space-s) * var(--ui-scale));
        height: calc(var(--ui-button-height) * var(--ui-scale));
        padding-inline-start: calc(var(--ui-button-padding-inline) * var(--ui-scale));
        padding-inline-end: calc((var(--ui-button-height) - var(--ui-button-compact-height)) / 2 * var(--ui-scale));
        border: calc(var(--ui-rim) * var(--ui-scale)) solid
          color-mix(in srgb, var(--ui-danger) calc(var(--ui-danger-rim-alpha) * 100%), transparent);
        border-radius: calc(var(--ui-radius-control) * var(--ui-scale));
        color: var(--ui-text);
        font-family: var(--ui-font-sans);
        font-size: calc(var(--ui-type-body) * var(--ui-scale));
        line-height: 1;
      }

      .question {
        flex: 1;
      }
    `,
  ],
})
export class MenuExitComponent {
  /** `Exit` confirmed: the menu leaves the room. */
  readonly exited = output();

  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected readonly testId = HUD_TEST_ID;
  protected readonly isConfirming = signal(false);

  protected ask(): void {
    this.isConfirming.set(true);
    this.focusOnceRendered(HUD_TEST_ID.menuExitCancel);
  }

  protected cancel(): void {
    this.isConfirming.set(false);
    this.focusOnceRendered(HUD_TEST_ID.menuExit);
  }

  /** This Escape is the row's, not the menu's: consumed, so the document handler lets the menu stay. */
  protected cancelByEscape(event: Event): void {
    event.preventDefault();
    this.cancel();
  }

  private focusOnceRendered(testId: string): void {
    afterNextRender(() => this.host.querySelector<HTMLElement>(testIdSelector(testId))?.focus(), {
      injector: this.injector,
    });
  }
}
