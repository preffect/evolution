// The mouse lock over the wired game (docs/ui/input-and-onboarding.md §4.1, #794): real pointer events on the canvas
// host, through the input seam's pointer adapter and the lock, to the HUD's menu, cursor and the `player_input` the
// room would receive. The browser's half is `testing/fake-pointer-lock.ts`, since jsdom has no Pointer Lock API. What
// each piece decides is unit-tested; this pins the crossings: the locking click that does not sprint, steering from
// the virtual pointer, Escape out of the lock opening the menu, the re-lock after it, the trait picker keeping the
// lock, and the encyclopedia handing it back.

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
  type TraitOfferView,
} from '@evolution/shared';
import { SILENT_TELEMETRY_SEAMS, TEST_OWN_PLAYER_ID, createTestCellView } from '../../../testing/builders';
import { createFakePixiApp } from '../../../testing/fake-pixi-app';
import { installFakePointerLock, type FakePointerLock } from '../../../testing/fake-pointer-lock';
import { MultiplayerService } from '../../services/multiplayer.service';
import { setupGame, type GameTeardown } from '../game-setup';
import { MOUSE_POINTER_TYPE, POINTER_LOCK_RETRY_COOLDOWN_MS } from '../input/input-constants';
import { HUD_OVERLAY, HudStateService } from './hud-state.service';
import { HudComponent } from './hud.component';
import { MouseLockService } from './mouse-lock.service';
import { HUD_TEST_ID, testIdSelector, traitCardPickTestId } from '../test-ids/hud-test-ids';

const VIEW = { width: 1280, height: 720 };
const CENTRE = { clientX: VIEW.width / 2, clientY: VIEW.height / 2 };
const SNAPSHOT_TICK = 5000;
const OFFER = createTestTraitOfferView({ offerId: 7, expiresAtTick: SNAPSHOT_TICK + 6 * TICK_HZ });

function snapshotWith(offer: TraitOfferView | null): ReturnType<typeof createTestSnapshot> {
  return createTestSnapshot({
    tick: SNAPSHOT_TICK,
    cells: [createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 0, y: 0, radius: 4 })],
    ownProgress: createTestPlayerProgressView({ playerId: TEST_OWN_PLAYER_ID, offer }),
  });
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function query(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(testIdSelector(testId));
}

function pointer(type: string, detail: Record<string, number | string> = {}): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    button: 0,
    pointerType: MOUSE_POINTER_TYPE,
    ...CENTRE,
    movementX: 0,
    movementY: 0,
    ...detail,
  });
  return event;
}

describe('the mouse lock over the wired game', () => {
  let hudState: HudStateService;
  let multiplayer: MultiplayerService;
  let hud: ComponentFixture<HudComponent>;
  let canvasHost: HTMLElement;
  let browser: FakePointerLock;
  let clock: ManualClock;
  let pixi: ReturnType<typeof createFakePixiApp>;
  let sent: GameInput[];
  let teardown: GameTeardown;

  function frame(): GameInput | undefined {
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    pixi.tick();
    TestBed.tick();
    return sent.at(-1);
  }

  function click(): void {
    canvasHost.dispatchEvent(pointer('pointerdown'));
    TestBed.tick();
  }

  function lockByClicking(): void {
    click();
    browser.grant();
    TestBed.tick();
  }

  async function startRoom(offer: TraitOfferView | null): Promise<void> {
    const snapshot = snapshotWith(offer);
    multiplayer.snapshot.set(snapshot);
    const messages$ = new Subject<ServerMessage>();
    const audio = {
      ready: Promise.resolve(),
      observe: vi.fn(),
      updateOptions: vi.fn(),
      unlock: vi.fn(),
      disconnect: vi.fn(),
    };
    const mouseLock = TestBed.inject(MouseLockService);
    teardown = setupGame(
      { send: (input) => sent.push(input), messages$, ...SILENT_TELEMETRY_SEAMS, host: canvasHost },
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
        onEncyclopediaKey: () => hudState.openEncyclopedia(null, HUD_TEST_ID.menuEncyclopedia),
        onTraitCardPickReady: (pick) => hudState.setTraitCardPick(pick),
        pointerLock: {
          isEnabled: () => mouseLock.isEnabled(),
          isCursorNeeded: () => mouseLock.isCursorNeeded(),
          onUserExit: () => mouseLock.exitedByUser(),
          onCursorMoved: (point) => mouseLock.setCursorPoint(point),
        },
      },
    );
    messages$.next({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId('g'),
      playerId: TEST_OWN_PLAYER_ID,
      snapshot,
      balance: DEFAULT_BALANCE,
      config: createTestSessionConfig(),
      playerIds: [TEST_OWN_PLAYER_ID],
      avatarAssignments: {},
    });
    await flush();
    canvasHost.focus();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HudComponent] });
    hudState = TestBed.inject(HudStateService);
    multiplayer = TestBed.inject(MultiplayerService);
    multiplayer.playerId.set(TEST_OWN_PLAYER_ID);
    multiplayer.balance.set(DEFAULT_BALANCE);

    canvasHost = document.body.appendChild(document.createElement('div'));
    canvasHost.tabIndex = 0;
    canvasHost.setAttribute('data-testid', HUD_TEST_ID.gameHost);
    vi.spyOn(canvasHost, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, VIEW.width, VIEW.height));
    browser = installFakePointerLock(canvasHost);
    hud = TestBed.createComponent(HudComponent);
    hud.detectChanges();

    clock = new ManualClock(0);
    pixi = createFakePixiApp(VIEW);
    sent = [];
  });

  afterEach(() => {
    teardown();
    hud.destroy();
    browser.restore();
    canvasHost.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('locks on the first click without sprinting, draws the cursor, steers from it, and sprints on the next click', async () => {
    await startRoom(null);
    lockByClicking();
    expect(frame()?.shouldSprint).toBe(false);
    expect(query(HUD_TEST_ID.virtualCursor)).not.toBeNull();
    const centredTargetX = sent.at(-1)!.targetX!;

    canvasHost.dispatchEvent(pointer('pointermove', { movementX: 200, clientX: 0 }));
    expect(frame()!.targetX!).toBeGreaterThan(centredTargetX);

    click();
    expect(frame()?.shouldSprint).toBe(true);
  });

  it('opens the menu on an Escape out of the lock, and re-locks on a click once the cooldown is over', async () => {
    await startRoom(null);
    lockByClicking();
    browser.unlock({ hasDocumentFocus: true });
    TestBed.tick();
    expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();
    expect(query(HUD_TEST_ID.virtualCursor)).toBeNull();

    query(HUD_TEST_ID.menuResume)!.click();
    TestBed.tick();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    click();
    expect(frame()?.shouldSprint).toBe(false);
    expect(browser.requests).toHaveBeenCalledOnce();

    clock.advanceMilliseconds(POINTER_LOCK_RETRY_COOLDOWN_MS);
    click();
    expect(browser.requests).toHaveBeenCalledTimes(2);
    expect(frame()?.shouldSprint).toBe(false);
  });

  it('keeps the lock through the trait picker, where a click on a card picks it rather than sprinting', async () => {
    await startRoom(OFFER);
    lockByClicking();
    frame();
    expect(browser.exits).not.toHaveBeenCalled();

    browser.setElementAtPoint(query(traitCardPickTestId(1)));
    click();
    const input = frame()!;
    expect(input.traitChoice).toMatchObject({ offerId: OFFER.offerId, cardIndex: 1 });
    expect(input.shouldSprint).toBe(false);
  });

  it('hands the lock back for the encyclopedia, which is no Escape, and sprints as before with the toggle off', async () => {
    await startRoom(null);
    lockByClicking();
    canvasHost.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', bubbles: true }));
    frame();
    expect(browser.exits).toHaveBeenCalledOnce();
    browser.settle();
    TestBed.tick();
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
    expect(query(HUD_TEST_ID.virtualCursor)).toBeNull();

    TestBed.inject(MouseLockService).toggle();
    hudState.closeOverlays();
    click();
    expect(browser.requests).toHaveBeenCalledOnce();
    expect(frame()?.shouldSprint).toBe(true);
  });
});
