// The element the game renders into (docs/ARCHITECTURE.md §6): mounts the canvas host, runs
// `setupGame` with the multiplayer seams and the injected clock and audio hooks, and tears it
// down with the component. The HUD (#100) wraps this with its overlay.

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
  template: `<div #host class="game-host" data-testid="${GAME_HOST_TEST_ID}"></div>`,
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
        min-height: 480px;
        overflow: hidden;
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
        drainLatestSnapshot: () => this.multiplayer.drainLatestSnapshotMessage(),
        host: this.host().nativeElement,
      },
      {
        clock: this.clock,
        connectAudio: (options) => this.audioHooks.connect(options),
        createPixiApp,
        devicePixelRatio: window.devicePixelRatio,
        debugHost: window as unknown as Record<string, unknown>,
        isDevMode: isDevMode(),
        previewTraitId: () => null,
        reticle: () => ({ isVisible: false, x: 0, y: 0 }),
      },
    );
  }

  ngOnDestroy(): void {
    this.teardown?.();
    this.teardown = null;
  }
}
