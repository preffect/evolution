// The encyclopedia's keyboard over the wired game (docs/testing/tiers-and-builders.md §2.2): real key presses from
// the focused element, through the input seam's one document listener and its modal gate, into the HUD's overlay
// state and the panel it mounts. What each piece decides is unit-tested; this pins the crossings §11.5 and §4
// promise, including the three of #449's "Done when" that regress silently — `H` from the menu returning to the
// menu, the Escape order, and a reopen never restoring a stale query on either path a room can close by. (The core
// clears the query in both of its doors, but nothing *obliges* a host to use one, so that last is the host's.)
//
// The harness is `menu.integration.spec.ts`'s, deliberately repeated rather than shared: `.jscpd.json` exempts specs
// precisely so a test may hold its own setup instead of reaching through an indirection to read it.

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
import { EncyclopediaStateService } from '../encyclopedia/encyclopedia-state.service';
import { ENCYCLOPEDIA_SEARCH_KEY_CODE } from '../encyclopedia/encyclopedia-constants';
import { ENCYCLOPEDIA_TEST_ID } from '../encyclopedia/test-ids';
import { ENCYCLOPEDIA_KEY_CODE } from '../input/input-constants';
import { setupGame, type GameTeardown } from '../game-setup';
import { ENCYCLOPEDIA_RETURN, HUD_OVERLAY, HudStateService } from './hud-state.service';
import { HudComponent } from './hud.component';
import { HUD_TEST_ID, testIdSelector } from './test-ids';

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
function press(key: string, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  TestBed.tick();
  return event;
}

const pressEscape = (): KeyboardEvent => press('Escape', 'Escape');
const pressEncyclopediaKey = (): KeyboardEvent => press('h', ENCYCLOPEDIA_KEY_CODE);

describe('the encyclopedia’s keyboard over the wired game', () => {
  let hudState: HudStateService;
  let encyclopedia: EncyclopediaStateService;
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

  /** Types into the real search field, the way the reader does; the panel must be open. */
  function typeQuery(text: string): void {
    const field = query(ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    TestBed.tick();
    field.focus();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HudComponent] });
    hudState = TestBed.inject(HudStateService);
    encyclopedia = TestBed.inject(EncyclopediaStateService);
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
        // Exactly what `game-host.component.ts` hands the seam, so this spec covers that wiring and not a copy.
        onMenuKey: () => hudState.pressMenuKey(),
        onEncyclopediaKey: () => hudState.openEncyclopedia(null, HUD_TEST_ID.menuEncyclopedia),
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

  describe('the H key (§11.1, §4)', () => {
    it('opens the encyclopedia from play, returning to the game', () => {
      pressEncyclopediaKey();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
      expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.game);

      pressEscape();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);
    });

    it('opens it from the menu with the menu as the return, exactly as the menu’s own button does', () => {
      pressEscape();
      expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();

      pressEncyclopediaKey();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
      expect(query(HUD_TEST_ID.menuOverlay)).toBeNull();
      expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.menu);
    });

    /** §11.1's last column: the control that opened it takes focus when the menu comes back. */
    it('gives focus back to the menu’s Encyclopedia control when it closes to the menu', () => {
      pressEscape();
      pressEncyclopediaKey();
      pressEscape();
      expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();
      expect(document.activeElement).toBe(query(HUD_TEST_ID.menuEncyclopedia));
    });

    it('does nothing from inside the encyclopedia, which is already open', () => {
      pressEncyclopediaKey();
      const location = encyclopedia.location();
      pressEncyclopediaKey();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
      expect(hudState.encyclopediaReturnTo()).toBe(ENCYCLOPEDIA_RETURN.game);
      expect(encyclopedia.location()).toEqual(location);
    });
  });

  // The modal gate (§4), which the encyclopedia now joins the menu in.

  it('swallows sprint and steering while it is open, and leaves the steer target latched', () => {
    pressEncyclopediaKey();
    press(' ', 'Space');
    press('d', 'KeyD');
    frame();
    expect(sent.at(-1)?.shouldSprint).toBe(false);
    expect(sent.at(-1)?.targetX).toBe(0);
  });

  it('keeps the trait keys live under it and leaves Tab native, since an offer runs on under the reading screen', () => {
    pressEncyclopediaKey();
    press('1', 'Digit1');
    expect(press('Tab', 'Tab').defaultPrevented).toBe(false);
    frame();
    expect(sent.at(-1)?.traitChoice).toMatchObject({ offerId: OFFER.offerId, cardIndex: 0 });
    expect(hudState.openOverlay()).toBe(HUD_OVERLAY.encyclopedia);
  });

  describe('the Escape order (§11.5)', () => {
    it('lets the search field own the first Escape while a query is up, and closes on the next', () => {
      pressEncyclopediaKey();
      typeQuery('mito');

      expect(pressEscape().defaultPrevented).toBe(true);
      expect(encyclopedia.query()).toBe('');
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();

      expect(pressEscape().defaultPrevented).toBe(false);
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    });

    it('closes from the field on an Escape nothing consumed, so a blank field never traps the reader', () => {
      pressEncyclopediaKey();
      (query(ENCYCLOPEDIA_TEST_ID.search) as HTMLInputElement).focus();
      pressEscape();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    });
  });

  it('reaches the panel’s own keys through the modal gate: `/` focuses the field, Alt+← goes back', () => {
    pressEncyclopediaKey();
    press('/', ENCYCLOPEDIA_SEARCH_KEY_CODE);
    expect(document.activeElement).toBe(query(ENCYCLOPEDIA_TEST_ID.search));

    const landing = encyclopedia.location();
    encyclopedia.openEntry(encyclopedia.groups()[0]!.entries[0]!.entryId);
    TestBed.tick();
    press('ArrowLeft', 'ArrowLeft', { altKey: true });
    expect(encyclopedia.location()).toEqual(landing);
    expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).not.toBeNull();
  });

  /** #449's added "Done when". A stale query is a silent failure: the panel looks right and shows the wrong list. */
  describe('a reopen never restores a stale query', () => {
    /**
     * Closes with the query **still up**, which is the case the invariant is about: Close is the one control that
     * ends the panel mid-search, and it runs the HUD shell's own close-to-`encyclopediaReturnTo`. An Escape would
     * clear the query itself first and prove nothing about the host.
     */
    function typeAndPressClose(): void {
      typeQuery('mito');
      expect(encyclopedia.query()).toBe('mito');
      query(ENCYCLOPEDIA_TEST_ID.close)!.click();
      TestBed.tick();
      expect(query(ENCYCLOPEDIA_TEST_ID.encyclopedia)).toBeNull();
    }

    /** The reading position is the session's and survives the close; only the query does not (§11.5). */
    it('when the shell closed it to the game, and H opens it again on the page it was left at', () => {
      pressEncyclopediaKey();
      const entryId = encyclopedia.groups()[0]!.entries[0]!.entryId;
      encyclopedia.openEntry(entryId);
      TestBed.tick();
      typeAndPressClose();
      expect(hudState.openOverlay()).toBe(HUD_OVERLAY.none);

      pressEncyclopediaKey();
      expect(encyclopedia.location().entryId).toBe(entryId);
      expect(encyclopedia.query()).toBe('');
      expect(query(ENCYCLOPEDIA_TEST_ID.search)).toHaveProperty('value', '');
    });

    /** The menu's own control is the other door into the same panel, so it is reopened through that one too. */
    it('when the shell closed it to the menu, and either door there opens it again', () => {
      pressEscape();
      pressEncyclopediaKey();
      typeAndPressClose();
      expect(query(HUD_TEST_ID.menuOverlay)).not.toBeNull();

      query(HUD_TEST_ID.menuEncyclopedia)!.click();
      TestBed.tick();
      expect(encyclopedia.query()).toBe('');
      expect(query(ENCYCLOPEDIA_TEST_ID.search)).toHaveProperty('value', '');

      typeAndPressClose();
      pressEncyclopediaKey();
      expect(encyclopedia.query()).toBe('');
    });
  });
});
