// The chrome end to end (docs/testing/tiers-and-builders.md §2.2): real server messages off a real socket, through
// the multiplayer service and `GameStateService`, to the rows and digits a player reads. What each
// piece decides is unit-tested; this pins that they are wired, including the Tab hold the input
// layer hands over (`input/input.integration.spec.ts` pins the other half of that crossing).

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  CELL_STAGE,
  ROUND_PHASE,
  SERVER_MESSAGE_TYPE,
  createTestPlayerProgressView,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type BalanceConfig,
  type CellView,
  type GameSnapshot,
  type PlayerProgressView,
  type LeaderboardRow,
  type ServerMessage,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { FakeWebSocket } from '../../../testing/fake-websocket';
import { IdentityService } from '../../services/identity.service';
import { MultiplayerService } from '../../services/multiplayer.service';
import { RECONNECT_DELAY_MS, WebSocketService } from '../../services/websocket.service';
import { CONNECTION_BANNER_TEXT, CONNECTION_STATE } from './format/connection-banner';
import { HudComponent } from './hud.component';
import { HudStateService } from './hud-state.service';
import { HUD_TEST_ID, leaderboardRowTestId, testIdSelector } from './test-ids';

const OWN_PLAYER_ID = playerId('player-me');
const RIVAL = playerId('player-rival');
const ROUND_SECONDS = 60;

function row(rank: number, id: typeof OWN_PLAYER_ID, score: number, absorptions: number): LeaderboardRow {
  return { rank, playerId: id, score, mass: score, level: 1, absorptions };
}

/** The room's opening message: the seats, the round length, the live balance and a first board. */
function gameStateMessage(rows: LeaderboardRow[], secondsLeft: number): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('room'),
    playerId: OWN_PLAYER_ID,
    snapshot: snapshotWith(rows, secondsLeft),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig({ roundDurationSeconds: ROUND_SECONDS }),
    playerIds: [OWN_PLAYER_ID, RIVAL],
    avatarAssignments: { [OWN_PLAYER_ID]: 0, [RIVAL]: 1 },
  };
}

/** The live balance with one number retuned, as `debug_set_balance` would leave it. */
function balanceWithBloomFrom(bloomStartFraction: number): BalanceConfig {
  const session = { ...DEFAULT_BALANCE.session };
  session.ROUND_BLOOM_START_FRACTION = bloomStartFraction;
  return { ...DEFAULT_BALANCE, session };
}

function snapshotWith(
  rows: LeaderboardRow[],
  secondsLeft: number,
  ownProgress: Partial<PlayerProgressView> = {},
  ownCell: Partial<CellView> = {},
): GameSnapshot {
  return createTestSnapshot({
    roundTimeLeftMs: secondsLeft * MILLISECONDS_PER_SECOND,
    leaderboard: rows,
    cells: [createTestCellView({ playerId: OWN_PLAYER_ID, ...ownCell })],
    players: {
      [OWN_PLAYER_ID]: { playerId: OWN_PLAYER_ID, playerName: 'Me' },
      [RIVAL]: { playerId: RIVAL, playerName: 'Rival' },
    },
    ownProgress: createTestPlayerProgressView({ playerId: OWN_PLAYER_ID, playerName: 'Me', ...ownProgress }),
  });
}

describe('the HUD chrome, end to end', () => {
  let fixture: ComponentFixture<HudComponent>;
  let hudState: HudStateService;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function receive(message: ServerMessage): void {
    FakeWebSocket.latest().receive(JSON.stringify(message));
    fixture.detectChanges();
  }

  beforeEach(() => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({
      imports: [HudComponent],
      providers: [{ provide: IdentityService, useValue: { clientId: 'me' } }],
    });
    TestBed.inject(MultiplayerService);
    TestBed.inject(WebSocketService).connect();
    FakeWebSocket.latest().open();
    hudState = TestBed.inject(HudStateService);
    fixture = TestBed.createComponent(HudComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fills the chrome from the room’s game_state and keeps it current on every snapshot', () => {
    receive(gameStateMessage([row(1, RIVAL, 30, 0), row(2, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));

    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))?.textContent).toBe('1:00');
    expect(element().querySelector(testIdSelector(leaderboardRowTestId(OWN_PLAYER_ID)))).not.toBeNull();
    expect(element().querySelector(testIdSelector(leaderboardRowTestId(RIVAL)))).not.toBeNull();

    receive({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: snapshotWith([row(1, RIVAL, 30, 0), row(2, OWN_PLAYER_ID, 10, 0)], 42),
    });
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))?.textContent).toBe('0:42');
  });

  it('moves the board and the absorption count when a kill pays out', () => {
    receive(gameStateMessage([row(1, RIVAL, 30, 0), row(2, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    const rankBefore = element()
      .querySelector(testIdSelector(leaderboardRowTestId(OWN_PLAYER_ID)))
      ?.querySelector('.rank');
    expect(rankBefore?.textContent).toBe('2');

    // The payout of #259: the absorbed rival's mass and score cross to the predator.
    receive({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: snapshotWith([row(1, OWN_PLAYER_ID, 90, 1), row(2, RIVAL, 5, 0)], 40),
    });

    const ownRow = element().querySelector(testIdSelector(leaderboardRowTestId(OWN_PLAYER_ID)));
    expect(ownRow?.querySelector('.rank')?.textContent).toBe('1');
    expect(ownRow?.querySelector('.score')?.textContent).toBe('90');

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    expect(
      element()
        .querySelector(testIdSelector(leaderboardRowTestId(OWN_PLAYER_ID)))
        ?.querySelector('.absorptions')?.textContent,
    ).toBe('1');
  });

  it('re-reads the bloom threshold from balance_updated, the live-retune path the clock depends on', () => {
    // Sixty seconds left of a sixty-second round is 0 % elapsed, so no fraction short of 0 blooms.
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundPhase))?.textContent).toBe('ROUND');

    // `debug_set_balance` dropping the threshold to zero puts every tick of the round in bloom.
    receive({ type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: balanceWithBloomFrom(0) });

    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundPhase))?.textContent).toBe('BLOOM');
  });

  it('stands the board down for the results phase, where #189’s overlay claims the same corner', () => {
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).not.toBeNull();

    receive({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: { ...snapshotWith([row(1, OWN_PLAYER_ID, 10, 0)], 0), roundPhase: ROUND_PHASE.results },
    });

    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboard))).toBeNull();
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))).toBeNull();
  });

  it('mirrors the own cell off the wire, so a WebGL-only indicator has a DOM a test can read', () => {
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    const mirror = (): Element | null => element().querySelector(testIdSelector(HUD_TEST_ID.ownCell));
    expect(mirror()?.getAttribute('data-level')).toBe('1');
    expect(mirror()?.getAttribute('data-ladder')).toBe('ghost:nucleoid');

    // A vent trip: the cell is a prokaryote and four aerobic bacteria are in. Nothing on screen
    // says so except the ladder counter, which is the requirement gameplay-qa flagged as hidden.
    receive({
      type: SERVER_MESSAGE_TYPE.gameSnapshot,
      snapshot: snapshotWith(
        [row(1, OWN_PLAYER_ID, 10, 0)],
        ROUND_SECONDS,
        { bacteriaEatenByVariant: { plain: 0, aerobic: 4, photosynthetic: 0 } },
        { stage: CELL_STAGE.prokaryote },
      ),
    });

    expect(mirror()?.getAttribute('data-ladder')).toBe('counters');
    expect(mirror()?.getAttribute('data-aerobic')).toBe('4/10');
    expect(mirror()?.textContent).toContain('Aerobic 4 of 10');
  });

  it('dims the round under the connection banner while the socket is down, and clears it on the resync (#219)', () => {
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    const banner = (): Element | null => element().querySelector(testIdSelector(HUD_TEST_ID.connectionBanner));
    const dim = (): Element | null => element().querySelector('.connection-lost-dim');
    expect(banner()).toBeNull();
    // The lobby announced a name, which is what the reopen re-sends to learn whether the seat survived.
    TestBed.inject(MultiplayerService).joinLobby('Me');

    vi.useFakeTimers();
    FakeWebSocket.latest().close();
    fixture.detectChanges();
    expect(banner()?.getAttribute('data-connection-state')).toBe(CONNECTION_STATE.disconnected);
    expect(banner()?.textContent?.trim()).toBe(CONNECTION_BANNER_TEXT.disconnected);
    expect(dim()).not.toBeNull();
    // The last snapshot stays: the round is still on screen under the banner.
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))?.textContent).toBe('1:00');

    // The transport's own reconnect timer, then the server's connect-time game_state for the seat it kept.
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    vi.useRealTimers();
    FakeWebSocket.latest().open();
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], 30));
    expect(banner()).toBeNull();
    expect(dim()).toBeNull();
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.roundClock))?.textContent).toBe('0:30');
  });

  it('surfaces a server error in play, where the lobby’s error line is not rendered, until dismissed (#219)', () => {
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    receive({ type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' });
    const notice = (): Element | null => element().querySelector(testIdSelector(HUD_TEST_ID.serverError));
    expect(notice()?.textContent).toContain('Game is full');

    element().querySelector<HTMLElement>(testIdSelector(HUD_TEST_ID.serverErrorDismiss))?.click();
    fixture.detectChanges();
    expect(notice()).toBeNull();
  });

  it('expands to the full list while the Tab hold is on, and collapses on its release', () => {
    receive(gameStateMessage([row(1, OWN_PLAYER_ID, 10, 0)], ROUND_SECONDS));
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).toBeNull();

    hudState.setFullLeaderboardHeld(true);
    fixture.detectChanges();
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).not.toBeNull();

    hudState.setFullLeaderboardHeld(false);
    fixture.detectChanges();
    expect(element().querySelector(testIdSelector(HUD_TEST_ID.leaderboardFull))).toBeNull();
  });
});
