// docs/GAME-DESIGN.md §5.3: score and ranking.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, playerId } from '@evolution/shared';
import { createTestPlayerRecord, createTestWorld } from '../testing/builders.js';
import { scoreOf, updateLeaderboard } from './leaderboard.js';

const bonus = DEFAULT_BALANCE.session.SCORE_ABSORPTION_BONUS;

describe('scoreOf', () => {
  it('is lifetime DNA minus the catch-up gift plus the absorption bonus', () => {
    const player = createTestPlayerRecord({ dnaCumulative: 100, dnaCatchUpGift: 30, absorptions: 2 });
    expect(scoreOf(player, bonus)).toBe(70 + 2 * bonus);
  });
});

describe('updateLeaderboard', () => {
  it('ranks by score, then mass, then join order, and writes every score', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
        { playerId: playerId('c'), playerName: 'C', avatarIndex: 2 },
        { playerId: playerId('d'), playerName: 'D', avatarIndex: 3 },
      ],
    });
    const [playerA, playerB, playerC, playerD] = world.players;
    playerA!.dnaCumulative = 10;
    playerB!.dnaCumulative = 10;
    playerC!.dnaCumulative = 50;
    playerC!.dnaCatchUpGift = 50;
    playerD!.absorptions = 1;
    world.cells[1]!.mass = 40;
    updateLeaderboard(world);
    expect(world.leaderboard.map((row) => [row.rank, row.playerId, row.score, row.mass])).toEqual([
      [1, 'd', bonus, 20],
      [2, 'b', 10, 40],
      [3, 'a', 10, 20],
      [4, 'c', 0, 20],
    ]);
    expect(world.players.map((player) => player.score)).toEqual([10, 10, 0, bonus]);
    expect(world.leaderboard[0]).toMatchObject({ level: 1, absorptions: 1 });
  });

  it('ranks a spectating player with mass 0', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
      ],
    });
    world.cells = world.cells.filter((cell) => cell.playerId !== 'a');
    updateLeaderboard(world);
    expect(world.leaderboard.map((row) => [row.playerId, row.mass])).toEqual([
      ['b', 20],
      ['a', 0],
    ]);
  });
});
