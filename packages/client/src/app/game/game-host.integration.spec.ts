// The hop from the game host into the input seam (docs/testing/tiers-and-builders.md §2.2), driven by a real key
// press on the document through the real `setupGame`, the real controller and the real modal gate, into the HUD's
// overlay state.
//
// **Why this file exists.** Everything below that hop was already covered — but by specs that call `setupGame`
// themselves, so none of them would notice `game-host.component.ts` passing nothing. #449's review proved it:
// deleting `onEncyclopediaKey` there left both tiers green with identical counts, which means `H` could have been
// dead in the shipped game behind a passing gate. The same hole sat under `onMenuKey`, older than this ticket.
//
// Mounting the component is what makes the pin real, and it is possible because `createPixiApp` is now injected
// through `CREATE_PIXI_APP` rather than imported (jsdom has no WebGL). Nothing here is mocked that carries a rule:
// the fakes are a canvas, a clock, an audio backend and a socket.

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../testing/builders';
import { createFakePixiApp } from '../../testing/fake-pixi-app';
import { FakeWebSocket } from '../../testing/fake-websocket';
import { IdentityService } from '../services/identity.service';
import { WebSocketService } from '../services/websocket.service';
import { AudioHooks } from './audio/audio-hooks';
import { CLOCK } from './clock-provider';
import { GameHostComponent } from './game-host.component';
import { ENCYCLOPEDIA_RETURN, HUD_OVERLAY, HudStateService } from './hud/hud-state.service';
import { HUD_TEST_ID } from './hud/test-ids';
import { CREATE_PIXI_APP } from './render/pixi-app-provider';

const VIEWPORT = { width: 1280, height: 720 };

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The one message that makes the room real, so the input seam's `isInGame` says yes and presses act. */
function gameStateMessage(): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('g'),
    playerId: TEST_OWN_PLAYER_ID,
    snapshot: createTestSnapshot({
      cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 0, y: 0, radius: 4 })],
    }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [TEST_OWN_PLAYER_ID],
    avatarAssignments: {},
  };
}

function press(code: string): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  TestBed.tick();
}

describe('what the game host hands the input seam', () => {
  let hudState: HudStateService;

  beforeEach(async () => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const audio = {
      ready: Promise.resolve(),
      observe: vi.fn(),
      updateOptions: vi.fn(),
      unlock: vi.fn(),
      disconnect: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [GameHostComponent],
      providers: [
        { provide: IdentityService, useValue: { clientId: 'me' } },
        { provide: CLOCK, useValue: new ManualClock(0) },
        { provide: CREATE_PIXI_APP, useValue: () => Promise.resolve(createFakePixiApp(VIEWPORT)) },
        { provide: AudioHooks, useValue: { connect: () => audio } },
      ],
    });
    hudState = TestBed.inject(HudStateService);
    TestBed.createComponent(GameHostComponent).detectChanges();

    TestBed.inject(WebSocketService).connect();
    FakeWebSocket.latest().open();
    FakeWebSocket.latest().receive(JSON.stringify(gameStateMessage()));
    await flush();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** §11.1, row 3: `H` in play opens at the last location — the `null` entry — and returns to the game. */
  it('opens the encyclopedia on H in play, at the last location and returning to the game', () => {
    press('KeyH');
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
    expect(hudState.encyclopediaEntryId()).toBeNull();
    expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.game);
  });

  /**
   * §11.1, row 1: `H` from the menu is the same control as the menu's own `Encyclopedia` button, focus return
   * included — which is what the second argument to `openEncyclopedia` buys, and why it cannot be left off.
   */
  it('opens it on H from the menu with the menu as the return, and the menu’s own control as the focus return', () => {
    press('Escape');
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);

    press('KeyH');
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
    expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.menu);
    expect(hudState.menuReturnFocusTestId()).toBe(HUD_TEST_ID.menuEncyclopedia);
  });

  /** The older hole this file closes with the same mount: Escape is the HUD's topmost order (docs/ui/overlays.md §3.5). */
  it('opens and closes the menu on Escape', () => {
    press('Escape');
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
    press('Escape');
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
  });
});
