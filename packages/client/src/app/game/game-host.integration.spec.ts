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
// the fakes are a canvas, a clock, an audio backend and a socket. The same mount pins the hop out to the wire
// (ticket #256): the render session's frame-budget report leaves the socket as `client_performance`.

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  ManualClock,
  RENDER_STAGE_NAMES,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../testing/builders';
import { createFakePixiApp, type FakePixiApp } from '../../testing/fake-pixi-app';
import { FakeWebSocket } from '../../testing/fake-websocket';
import { IdentityService } from '../services/identity.service';
import { WebSocketService } from '../services/websocket.service';
import { AudioHooks } from './audio/audio-hooks';
import { CLOCK } from './clock-provider';
import { GameHostComponent } from './game-host.component';
import { ENCYCLOPEDIA_RETURN, HUD_OVERLAY, HudStateService } from './hud/hud-state.service';
import { HUD_TEST_ID } from './test-ids/hud-test-ids';
import { CREATE_PIXI_APP } from './render/pixi-app-provider';
import { CLIENT_PERFORMANCE_REPORT_INTERVAL_MS } from './render/constants';

const VIEWPORT = { width: 1280, height: 720 };
/** The frame period the report test draws at; the renderer's staged build takes a few frames before the first draw. */
const FRAME_MS = 20;
const BUILD_FRAMES_MAX = 100;

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

describe('what the game host hands the input seam and the wire', () => {
  let hudState: HudStateService;
  let clock: ManualClock;
  let pixi: FakePixiApp;

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
    clock = new ManualClock(0);
    pixi = createFakePixiApp(VIEWPORT);
    TestBed.configureTestingModule({
      imports: [GameHostComponent],
      providers: [
        { provide: IdentityService, useValue: { clientId: 'me' } },
        { provide: CLOCK, useValue: clock },
        { provide: CREATE_PIXI_APP, useValue: () => Promise.resolve(pixi) },
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

  /** Ticket #256: the report goes out through the host's `reportPerformance`, the service and the socket. */
  it('sends the frame-budget report as client_performance once a report interval of frames has been drawn', async () => {
    const sentReports = () =>
      FakeWebSocket.latest()
        .sentMessages()
        .filter((message) => (message as { type: string }).type === CLIENT_MESSAGE_TYPE.clientPerformance);
    const framesToFirstReport = BUILD_FRAMES_MAX + CLIENT_PERFORMANCE_REPORT_INTERVAL_MS / FRAME_MS;
    for (let frame = 0; frame < framesToFirstReport && sentReports().length === 0; frame += 1) {
      clock.advanceMilliseconds(FRAME_MS);
      pixi.tick();
      await flush();
    }
    const [sent] = sentReports() as { report: { renderStagesMs: object } }[];
    expect(sent).toBeDefined();
    expect(Object.keys(sent!.report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
  });
});
