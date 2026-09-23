// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestPlayerProgressView, playerId, type LeaderboardRow, type PlayerId } from '@evolution/shared';
import { LEADERBOARD_COMPACT_ROWS } from '../hud-constants';
import { leaderboardEntriesFor, type LeaderboardInput } from './leaderboard-rows';
import { truncatePlayerName } from './player-name';

const OWN_ID = playerId('player-own');

function testPlayerId(rank: number): PlayerId {
  return playerId(`player-${rank}`);
}

function testRow(rank: number, overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank,
    playerId: testPlayerId(rank),
    score: rank * 10,
    mass: rank * 5,
    level: rank,
    absorptions: rank,
    ...overrides,
  };
}

function inputWith(rows: readonly LeaderboardRow[], overrides: Partial<LeaderboardInput> = {}): LeaderboardInput {
  const players = Object.fromEntries(
    rows.map((row) => [
      row.playerId,
      createTestPlayerProgressView({ playerId: row.playerId, playerName: `Name ${row.rank}` }),
    ]),
  );
  return {
    rows,
    players,
    avatarAssignments: Object.fromEntries(rows.map((row, index) => [row.playerId, index])),
    ownPlayerId: OWN_ID,
    maxRows: LEADERBOARD_COMPACT_ROWS,
    ...overrides,
  };
}

describe('leaderboardEntriesFor', () => {
  it('cuts to the panel height in rank order', () => {
    const rows = Array.from({ length: 8 }, (_unused, index) => testRow(index + 1));
    const entries = leaderboardEntriesFor(inputWith(rows));
    expect(entries).toHaveLength(LEADERBOARD_COMPACT_ROWS);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts by rank even when the snapshot hands the rows over out of order', () => {
    const rows = [testRow(3), testRow(1), testRow(2)];
    expect(leaderboardEntriesFor(inputWith(rows)).map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('reads the name, level, score, mass and absorptions of its row', () => {
    const row = testRow(1, { score: 123.6, mass: 40.4, level: 3, absorptions: 2 });
    const [entry] = leaderboardEntriesFor(inputWith([row]));
    expect(entry).toEqual({
      playerId: row.playerId,
      rank: 1,
      name: 'Name 1',
      level: 3,
      scoreText: '124',
      massText: '40',
      absorptions: 2,
      avatarIndex: 0,
      isOwn: false,
    });
  });

  it('keeps the own row in the last slot when its rank is outside the cut', () => {
    const rows = [
      ...Array.from({ length: 7 }, (_unused, index) => testRow(index + 1)),
      testRow(8, { playerId: OWN_ID }),
    ];
    const entries = leaderboardEntriesFor(inputWith(rows));
    expect(entries).toHaveLength(LEADERBOARD_COMPACT_ROWS);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 8]);
    expect(entries.at(-1)?.isOwn).toBe(true);
  });

  it('does not displace a row when the own row already made the cut', () => {
    const rows = [testRow(1), testRow(2, { playerId: OWN_ID }), testRow(3)];
    const entries = leaderboardEntriesFor(inputWith(rows));
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(entries.filter((entry) => entry.isOwn)).toHaveLength(1);
  });

  it('shows more rows when the full list asks for them', () => {
    const rows = Array.from({ length: 8 }, (_unused, index) => testRow(index + 1));
    expect(leaderboardEntriesFor(inputWith(rows, { maxRows: 8 }))).toHaveLength(8);
  });

  it('falls back to the player id and the first seat when the snapshot has neither', () => {
    const row = testRow(1);
    const [entry] = leaderboardEntriesFor(inputWith([row], { players: {}, avatarAssignments: {} }));
    expect(entry?.name).toBe(truncatePlayerName(row.playerId));
    expect(entry?.avatarIndex).toBe(0);
  });

  it('is empty with no rows, and is empty rather than own-only while spectating an empty board', () => {
    expect(leaderboardEntriesFor(inputWith([]))).toEqual([]);
    expect(leaderboardEntriesFor(inputWith([testRow(1)], { ownPlayerId: null }))).toHaveLength(1);
  });
});
