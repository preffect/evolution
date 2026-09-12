// The element the game renders into (docs/ARCHITECTURE.md §6): mounts the canvas host, runs
// `setupGame` with the multiplayer seams and the injected clock and audio hooks, and tears it
// down with the component. It has no size of its own: it fills whatever the shell gives it, and
// in play the shell is the viewport (docs/UI.md §1, #217), so the Pixi app's `resizeTo` sizes the
// canvas to the viewport. The HUD (#100) wraps this with its overlay.

import { Component, ElementRef, inject, isDevMode, viewChild, type OnDestroy, type OnInit } from '@angular/core';
import { AudioHooks } from './audio/audio-hooks';
import { CLOCK } from './clock-provider';
import { MultiplayerService } from '../services/multiplayer.service';
import { setupGame, type GameTeardown } from './game-setup';
import { createPixiApp } from './render/pixi-app';

export const GAME_HOST_TEST_ID = 'game-host';

@Component({
  selector: 'app-game-host',
  standalone: true,
  // The host is focusable (docs/UI.md §4): a click on the canvas takes focus out of any field so
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
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private teardown: GameTeardown | null = null;

  ngOnInit(): void {
    this.teardown = setupGame(
      {
        send: (input) => this.multiplayer.sendInput(input),
        messages$: this.multiplayer.gameMessages$,
        host: this.host().nativeElement,
      },
      {
        clock: this.clock,
        connectAudio: (options) => this.audioHooks.connect(options),
        createPixiApp,
        devicePixelRatio: window.devicePixelRatio,
        debugHost: window,
        isDevMode: isDevMode(),
        previewTraitId: () => null,
        isReticleVisible: () => false,
      },
    );
  }

  ngOnDestroy(): void {
    this.teardown?.();
    this.teardown = null;
  }
}
