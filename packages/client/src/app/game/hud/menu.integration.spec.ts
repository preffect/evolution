// The Escape menu over the wired game (docs/testing/tiers-and-builders.md §2.2): real key presses from the focused
// element, through the input seam's one document listener and its modal gate, to the HUD's menu and to the
// `player_input` the room would receive. What each piece decides is unit-tested; this pins the crossings — Escape
// opening and closing the menu over the open trait picker, `1` still picking under it, and the exit confirm owning
// its own Escape (docs/ui/overlays.md §3.5, docs/ui/input-and-onboarding.md §4).

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  TICK_HZ,
  TICK_INTERVAL_MS,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  createTestTraitOfferView,
  gameId,
  type GameInput,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../../testing/builders';
import { createFakePixiApp } from '../../../testing/fake-pixi-app';
import { MultiplayerService } from '../../services/multiplayer.service';
import { setupGame, type GameTeardown } from '../game-setup';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';
import { HudComponent } from './hud.component';
import { HUD_TEST_ID, testIdSelector } from '../test-ids/hud-test-ids';

const SNAPSHOT_TICK = 5000;
const OFFER = createTestTraitOfferView({ offerId: 7, expiresAtTick: SNAPSHOT_TICK + 6 * TICK_HZ });
const SNAPSHOT = createTestSnapshot({
  tick: SNAPSHOT_TICK,
  cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 0, y: 0, radius: 4 })],
  ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID, offer: OFFER }),
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function query(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(testIdSelector(testId));
}

/** A key pressed where focus is, as a browser dispatches it, and the render it causes. */
function press(key: string, code: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);
  TestBed.tick();
  return event;
}

function pressEscape(): KeyboardEvent {
  return press('Escape', 'Escape');
}

describe('the Escape menu over the wired game', () => {
  let hudState: HudStateService;
  let hud: ComponentFixture<HudComponent>;
  let canvasHost: HTMLElement;
  let clock: ManualClock;
  let pixi: ReturnType<typeof createFakePixiApp>;
  let sent: GameInput[];
  let teardown: GameTeardown;

  function frame(): void {
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    pixi.tick();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HudComponent] });
    hudState = TestBed.inject(HudStateService);
    const multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(TEST_OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);
    multiplayer.snapshot.set(SNAPSHOT);

    canvasHost = document.body.appendChild(document.createElement('div'));
    canvasHost.tabIndex = 0;
    canvasHost.setAttribute('data-testid', HUD_TEST_ID.gameHost);
    hud = TestBed.createComponent(HudComponent);
    hud.detectChanges();

    clock = new ManualClock(0);
    pixi = createFakePixiApp({ width: 1280, height: 720 });
    sent = [];
    const messages$ = new Subject<ServerMessage>();
    const audio = {
      ready: Promise.resolve(),
      observe: vi.fn(),
      updateOptions: vi.fn(),
      unlock: vi.fn(),
      disconnect: vi.fn(),
    };
    teardown = setupGame(
      { send: (input) => sent.push(input), messages$, acknowledgeSnapshot: () => undefined, host: canvasHost },
      {
        clock,
        connectAudio: () => audio,
        createPixiApp: () => Promise.resolve(pixi),
        devicePixelRatio: 1,
        debugHost: {},
        isDevMode: false,
        previewTraitId: () => null,
        ownCellIndicators: () => null,
        isReticleVisible: () => false,
        onMenuKey: () => hudState.pressMenuKey(),
      },
    );
    messages$.next({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId('g'),
      playerId: TEST_OWN_PLAYER_ID,
      snapshot: SNAPSHOT,
      balance: DEFAULT_BALANCE,
      config: createTestSessionConfig(),
      playerIds: [TEST_OWN_PLAYER_ID],
      avatarAssignments: {},
    });
    await flush();
    canvasHost.focus();
  });

  afterEach(() => {
    teardown();
    hud.destroy();
    canvasHost.remove();
    vi.restoreAllMocks();
  });

  it('opens over the open picker with focus on Return to game, and Escape closes it back to the canvas host', () => {
    pressEscape();
    expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuResume));
    expect(query(HUD_TEST_ID.traitOffer)).not.toBeNull();

    pressEscape();
    expect(query(HUD_TEST_ID.menuOverlay)).toBeNull();
    expect(query(HUD_TEST_ID.traitOffer)).not.toBeNull();
    expect(document.activeElement).toBe(canvasHost);
  });

  it('keeps the trait keys live under the menu and swallows sprint', () => {
    pressEscape();
    press('1', 'Digit1');
    press(' ', 'Space');
    frame();
    expect(sent.at(-1)?.traitChoice).toMatchObject({ offerId: OFFER.offerId, cardIndex: 0 });
    expect(sent.at(-1)?.shouldSprint).toBe(false);
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.menu);
  });

  it('lets the exit confirm own its Escape: the row comes back and the menu stays, and the next Escape closes it', () => {
    pressEscape();
    query(HUD_TEST_ID.menuExit)!.click();
    TestBed.tick();
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuExitCancel));

    expect(pressEscape().defaultPrevented).toBe(true);
    expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();
    expect(document.activeElement).toBe(query(HUD_TEST_ID.menuExit));

    pressEscape();
    expect(query(HUD_TEST_ID.menuOverlay)).toBeNull();
    expect(query(HUD_TEST_ID.traitOffer)).not.toBeNull();
  });
});
