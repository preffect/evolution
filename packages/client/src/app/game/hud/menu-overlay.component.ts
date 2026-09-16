// The Escape menu (docs/ui/overlays.md §3.5): the kit's modal panel over a light scrim, in a focus trap, on its own
// `[uiSurface]` layer. `Menu` over `The dish keeps running.` (the sim never pauses), the alert strip while an alert is
// up, `Return to game` (autofocus), `Encyclopedia`, `Exit game` with its one confirm, and `Your traits`.
//
// The trait keys stay live underneath (input-and-onboarding.md §4's modal gate lets `1` `2` `3` through), which is why
// the alert strip carries an open offer and its seconds. Closing returns focus to the canvas host; coming back from the
// encyclopedia puts it on the control that opened it (`HudStateService.menuReturnFocusTestId`).

import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { UiButtonComponent } from '../../ui-kit/ui-button.component';
import { UiAutofocusDirective, UiFocusTrapDirective } from '../../ui-kit/ui-focus-trap.directive';
import { UiPanelComponent } from '../../ui-kit/ui-panel.component';
import { UiScrimComponent } from '../../ui-kit/ui-scrim.component';
import { UiSurfaceDirective } from '../../ui-kit/ui-surface.directive';
import { MultiplayerService } from '../../services/multiplayer.service';
import { GameStateService } from '../state/game-state.service';
import { menuTraitRowsFor, type MenuTraitRow } from './format/menu-traits';
import { MENU_SCRIM_ALPHA } from './hud-constants';
import { HudStateService } from './hud-state.service';
import { MenuExitComponent } from './menu-exit.component';
import { MenuTraitsComponent } from './menu-traits.component';
import { OverlayAlertComponent } from './overlay-alert.component';
import { HUD_TEST_ID, menuTraitTestId, testIdSelector } from './test-ids';

@Component({
  selector: 'app-menu-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MenuExitComponent,
    MenuTraitsComponent,
    OverlayAlertComponent,
    UiAutofocusDirective,
    UiButtonComponent,
    UiFocusTrapDirective,
    UiPanelComponent,
    UiScrimComponent,
    UiSurfaceDirective,
  ],
  styleUrl: './menu-overlay.component.css',
  template: `
    <div class="layer" uiSurface>
      <ui-scrim [alpha]="scrimAlpha" />
      <ui-panel
        class="menu"
        variant="modal"
        title="Menu"
        subtitle="The dish keeps running."
        uiFocusTrap
        [restoreTo]="canvasHost"
        [testId]="testId.menuOverlay"
      >
        <div class="content">
          <app-overlay-alert [testId]="testId.menuAlert" />
          <div class="actions">
            <button
              type="button"
              class="action"
              uiButton
              uiAutofocus
              variant="primary"
              keyHint="Escape"
              [testId]="testId.menuResume"
              (click)="returnToGame()"
            >
              Return to game
            </button>
            <button
              type="button"
              class="action"
              uiButton
              variant="secondary"
              keyHint="H"
              [testId]="testId.menuEncyclopedia"
              (click)="openEncyclopedia()"
            >
              Encyclopedia
            </button>
            <app-menu-exit (exited)="exitGame()" />
          </div>
        </div>
        <!-- Outside the body's scroll area, so its rule spans the panel's full width (docs/ui/overlays.md §3.5). -->
        <app-menu-traits uiPanelBleed [rows]="traitRows()" (opened)="openTraitEntry($event)" />
      </ui-panel>
    </div>
  `,
})
export class MenuOverlayComponent {
  private readonly hudState = inject(HudStateService);
  private readonly gameState = inject(GameStateService);
  private readonly multiplayer = inject(MultiplayerService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly testId = HUD_TEST_ID;
  protected readonly scrimAlpha = MENU_SCRIM_ALPHA;

  /** Where focus goes when the menu closes (input-and-onboarding.md §4): the canvas host, so the hotkeys work again. */
  protected readonly canvasHost = this.host.ownerDocument.querySelector<HTMLElement>(
    testIdSelector(HUD_TEST_ID.gameHost),
  );

  /** The player's own traits, so a spectator still sees theirs (docs/ui/overlays.md §3.5). */
  protected readonly traitRows = computed(() =>
    menuTraitRowsFor(this.gameState.ownProgress()?.ownedTraits ?? [], this.gameState.balance()?.traits ?? null),
  );

  constructor() {
    // After the trap's autofocus: back from the encyclopedia, the control that opened it takes focus instead.
    afterNextRender(() => this.focusReturnTarget());
  }

  protected returnToGame(): void {
    this.hudState.closeOverlays();
  }

  protected openEncyclopedia(): void {
    this.hudState.openEncyclopedia(null, HUD_TEST_ID.menuEncyclopedia);
  }

  protected openTraitEntry(row: MenuTraitRow): void {
    this.hudState.openEncyclopedia(row.entryId, menuTraitTestId(row.traitId));
  }

  /** Leaving drops the seat (#319) and the lobby returns (docs/ui/overlays.md §3.6). */
  protected exitGame(): void {
    this.hudState.closeOverlays();
    this.multiplayer.leave();
  }

  private focusReturnTarget(): void {
    const testId = this.hudState.menuReturnFocusTestId();
    if (testId !== null) this.host.querySelector<HTMLElement>(testIdSelector(testId))?.focus();
  }
}
