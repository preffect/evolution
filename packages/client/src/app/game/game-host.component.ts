// The element the game renders into (docs/architecture/client.md §6): mounts the canvas host, runs
// `setupGame` with the multiplayer seams and the injected clock and audio hooks, and tears it
// down with the component. It has no size of its own: it fills whatever the shell gives it, and
// in play the shell is the viewport (docs/ui/layout.md §1, #217), so the Pixi app's `resizeTo` sizes the
// canvas to the viewport. The HUD (#100) wraps this with its overlay.

import { Component, ElementRef, inject, isDevMode, viewChild, type OnDestroy, type OnInit } from '@angular/core';
import { AudioHooks } from './audio/audio-hooks';
import { CLOCK } from './clock-provider';
import { GameStateService } from './state/game-state.service';
import { HudStateService } from './hud/hud-state.service';
import { OnboardingService } from './hud/onboarding.service';
import { MultiplayerService } from '../services/multiplayer.service';
import { setupGame, type GameTeardown } from './game-setup';
import { CREATE_PIXI_APP } from './render/pixi-app-provider';
import { HUD_TEST_ID } from './test-ids/hud-test-ids';

export const GAME_HOST_TEST_ID = HUD_TEST_ID.gameHost;

@Component({
  selector: 'app-game-host',
  standalone: true,
  // The host is focusable (docs/ui/input-and-onboarding.md §4): a click on the canvas takes focus out of any field so
  // the hotkeys reach the document handler.
  template: `<div #host class="game-host" tabindex="0" data-testid="${GAME_HOST_TEST_ID}"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .game-host {
        width: 100%;
        height: 100%;
        overflow: hidden;
        /* The canvas is not an interactive control: focus is taken for the hotkeys, not shown. */
        outline: none;
      }
    `,
  ],
})
export class GameHostComponent implements OnInit, OnDestroy {
  private readonly multiplayer = inject(MultiplayerService);
  private readonly audioHooks = inject(AudioHooks);
  private readonly clock = inject(CLOCK);
  private readonly hudState = inject(HudStateService);
  private readonly gameState = inject(GameStateService);
  private readonly onboarding = inject(OnboardingService);
  /** Injected rather than imported, so a spec can mount this component without a WebGL context (#449's review). */
  private readonly createPixiApp = inject(CREATE_PIXI_APP);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private teardown: GameTeardown | null = null;

  ngOnInit(): void {
    this.teardown = setupGame(
      {
        send: (input) => this.multiplayer.sendInput(input),
        messages$: this.multiplayer.gameMessages$,
        acknowledgeSnapshot: (tick) => this.multiplayer.acknowledgeSnapshot(tick),
        host: this.host().nativeElement,
      },
      {
        clock: this.clock,
        connectAudio: (options) => this.audioHooks.connect(options),
        createPixiApp: this.createPixiApp,
        devicePixelRatio: window.devicePixelRatio,
        debugHost: window,
        isDevMode: isDevMode(),
        // The picker's highlighted card (docs/ui/overlays.md §3.2): the renderer previews its trait on the own cell.
        previewTraitId: () => this.hudState.previewTraitId(),
        // The steer beat (docs/ui/input-and-onboarding.md §5) shows the pointer reticle and the line to it.
        isReticleVisible: () => this.onboarding.reticleVisible(),
        // The fourth crossing (docs/ui/hud.md §3.1.4): the record the status mirror speaks is the one the renderer draws.
        ownCellIndicators: () => this.gameState.ownCellIndicators(),
        // Tab (docs/ui/input-and-onboarding.md §4) reaches the HUD through the input layer's one keyboard listener.
        onFullLeaderboardHeldChanged: (isHeld) => this.hudState.setFullLeaderboardHeld(isHeld),
        // Escape nothing consumed (docs/ui/overlays.md §3.5): the HUD closes the topmost overlay or opens the menu.
        onMenuKey: () => this.hudState.pressMenuKey(),
        // `H` (docs/ui/encyclopedia.md §11.1): at the last location read this session, and — pressed from the menu —
        // returning to the menu with focus on the control that would have opened it, exactly as that button does.
        onEncyclopediaKey: () => this.hudState.openEncyclopedia(null, HUD_TEST_ID.menuEncyclopedia),
        // A clicked card picks through the input seam's pick policy, like the `1` `2` `3` keys.
        onTraitCardPickReady: (pick) => this.hudState.setTraitCardPick(pick),
        // The one render-side fact the HUD reads (docs/ui/components-and-constants.md §7): what is on screen right now.
        onCameraExtent: (extent) => this.gameState.setCameraExtent(extent),
      },
    );
  }

  ngOnDestroy(): void {
    this.teardown?.();
    this.teardown = null;
    // The HUD state outlives the room: the next room must not open with this one's menu on screen.
    this.hudState.closeOverlays();
  }
}
