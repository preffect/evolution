import { describe, expect, it } from 'vitest';
import {
  ROUND_PHASE,
  TICK_HZ,
  createTestSessionConfig,
  createTestSnapshot,
  playerId,
  type LeaderboardRow,
  type PlayerId,
} from '@evolution/shared';
import { RESULTS_TEXT, resultsLinesFor, resultsStartedAtTickFor, type ResultsInput } from './results-lines';

const OWN_PLAYER_ID = playerId('player-me');
const RIVAL_PLAYER_ID = playerId('player-rival');
const THIRD_PLAYER_ID = playerId('player-third');
const RESULTS_SCREEN_SECONDS = 20;
const RESULTS_STARTED_AT_TICK = 7_200;

function row(rank: number, id: PlayerId): LeaderboardRow {
  return { rank, playerId: id, score: 100 - rank, mass: 40, level: 3, absorptions: 1 };
}

function input(overrides: Partial<ResultsInput> = {}): ResultsInput {
  return {
    rows: [row(2, OWN_PLAYER_ID), row(1, RIVAL_PLAYER_ID), row(3, THIRD_PLAYER_ID)],
    players: {
      [OWN_PLAYER_ID]: { playerId: OWN_PLAYER_ID, playerName: 'Me' },
      [RIVAL_PLAYER_ID]: { playerId: RIVAL_PLAYER_ID, playerName: 'Amoeboid' },
      [THIRD_PLAYER_ID]: { playerId: THIRD_PLAYER_ID, playerName: 'Third' },
    },
    avatarAssignments: { [OWN_PLAYER_ID]: 0, [RIVAL_PLAYER_ID]: 2, [THIRD_PLAYER_ID]: 1 },
    ownPlayerId: OWN_PLAYER_ID,
    tick: RESULTS_STARTED_AT_TICK,
    resultsStartedAtTick: RESULTS_STARTED_AT_TICK,
    resultsScreenSeconds: RESULTS_SCREEN_SECONDS,
    ...overrides,
  };
}

describe('resultsLinesFor', () => {
  it('names the top-ranked player as the winner, with their seat', () => {
    expect(resultsLinesFor(input()).winner).toEqual({ text: 'Amoeboid wins', avatarIndex: 2 });
  });

  it('says `You win` when the viewer is first', () => {
    const lines = resultsLinesFor(input({ rows: [row(1, OWN_PLAYER_ID), row(2, RIVAL_PLAYER_ID)] }));
    expect(lines.winner?.text).toBe(RESULTS_TEXT.ownWin);
  });

  it('cuts a long winner name as every other place does', () => {
    const players = { [RIVAL_PLAYER_ID]: { playerId: RIVAL_PLAYER_ID, playerName: 'Protoplasmic Wanderer' } };
    expect(resultsLinesFor(input({ players })).winner?.text).toBe('Protoplasmi… wins');
  });

  it('has no winner in an empty room', () => {
    expect(resultsLinesFor(input({ rows: [] })).winner).toBeNull();
  });

  it('ranks every player in order, however many there are, and flags only the own row', () => {
    const rows = Array.from({ length: 12 }, (_slot, index) => row(index + 1, playerId(`player-${index}`)));
    const lines = resultsLinesFor(input({ rows: [...rows, row(13, OWN_PLAYER_ID)].reverse() }));
    expect(lines.rows.map((entry) => entry.rank)).toEqual(Array.from({ length: 13 }, (_slot, index) => index + 1));
    expect(lines.rows.filter((entry) => entry.isOwn).map((entry) => entry.rank)).toEqual([13]);
  });

  it('counts the whole results phase down in whole seconds, rounding up', () => {
    expect(resultsLinesFor(input()).countdown).toBe('Next round in 20 s');
    expect(resultsLinesFor(input({ tick: RESULTS_STARTED_AT_TICK + 3 * TICK_HZ + 1 })).countdown).toBe(
      'Next round in 17 s',
    );
  });

  it('never reads 0 s on the last tick before the rematch', () => {
    const lastTick = RESULTS_STARTED_AT_TICK + RESULTS_SCREEN_SECONDS * TICK_HZ;
    expect(resultsLinesFor(input({ tick: lastTick })).countdown).toBe('Next round in 1 s');
  });

  it('says `Next round soon` before the room’s config or the balance has arrived', () => {
    expect(resultsLinesFor(input({ resultsStartedAtTick: null })).countdown).toBe(RESULTS_TEXT.countdownUnknown);
    expect(resultsLinesFor(input({ resultsScreenSeconds: null })).countdown).toBe(RESULTS_TEXT.countdownUnknown);
  });
});

describe('resultsStartedAtTickFor', () => {
  const config = createTestSessionConfig({ roundDurationSeconds: 90 });

  it('lands on the round’s start plus its length, however late the snapshot', () => {
    const snapshot = createTestSnapshot({ roundPhase: ROUND_PHASE.results, roundStartTick: 1_000, tick: 7_777 });
    expect(resultsStartedAtTickFor(snapshot, config)).toBe(1_000 + 90 * TICK_HZ);
  });

  it('is null in play, before the first snapshot and before the config', () => {
    const results = createTestSnapshot({ roundPhase: ROUND_PHASE.results });
    expect(resultsStartedAtTickFor(createTestSnapshot({ roundPhase: ROUND_PHASE.playing }), config)).toBeNull();
    expect(resultsStartedAtTickFor(null, config)).toBeNull();
    expect(resultsStartedAtTickFor(results, null)).toBeNull();
  });
});
