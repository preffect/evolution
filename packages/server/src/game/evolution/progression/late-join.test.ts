// docs/PROGRESSION.md §5: late-join catch-up against the living players' medians.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, PLAYER_LIFE_STATE, levelUpCost, playerId, secondsToTicks } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../testing/builders.js';
import { applyCatchUp, computeLateJoinCatchUp, medianOf } from './late-join.js';

const { progression, growth } = DEFAULT_BALANCE;
const GRACE_TICKS = secondsToTicks(progression.LATE_JOIN_GRACE_SECONDS);

function twoPlayerWorld(dna: [number, number], mass: [number, number]) {
  const world = createTestWorld({
    players: [
      { playerId: playerId('p1'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('p2'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  world.roundElapsedTicks = GRACE_TICKS + 1;
  world.players[0]!.dnaCumulative = dna[0];
  world.players[1]!.dnaCumulative = dna[1];
  world.cells[0]!.mass = mass[0];
  world.cells[1]!.mass = mass[1];
  return world;
}

describe('medianOf', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([7])).toBe(7);
  });
});

describe('computeLateJoinCatchUp', () => {
  it('is null inside the grace period', () => {
    const world = twoPlayerWorld([120, 120], [400, 400]);
    world.roundElapsedTicks = GRACE_TICKS;
    expect(computeLateJoinCatchUp(world)).toBeNull();
  });

  it('is null when no player is alive', () => {
    const world = twoPlayerWorld([120, 120], [400, 400]);
    for (const player of world.players) player.lifeState = PLAYER_LIFE_STATE.spectating;
    expect(computeLateJoinCatchUp(world)).toBeNull();
  });

  it('halves the median DNA (floored) and takes a quarter of the median mass (P7)', () => {
    expect(computeLateJoinCatchUp(twoPlayerWorld([120, 120], [400, 400]))).toEqual({ dnaGift: 60, mass: 100 });
    expect(computeLateJoinCatchUp(twoPlayerWorld([101, 120], [400, 400]))).toEqual({ dnaGift: 55, mass: 100 });
  });

  it('clamps the mass to the starting mass and the late-join cap', () => {
    expect(computeLateJoinCatchUp(twoPlayerWorld([0, 0], [20, 20]))?.mass).toBe(growth.CELL_STARTING_MASS);
    expect(computeLateJoinCatchUp(twoPlayerWorld([0, 0], [5000, 5000]))?.mass).toBe(progression.LATE_JOIN_MAX_MASS);
  });

  it('counts a spectating player as neither DNA nor mass', () => {
    const world = twoPlayerWorld([1000, 120], [4000, 400]);
    world.players[0]!.lifeState = PLAYER_LIFE_STATE.spectating;
    expect(computeLateJoinCatchUp(world)).toEqual({ dnaGift: 60, mass: 100 });
  });
});

describe('applyCatchUp', () => {
  it('records the gift and climbs exactly the levels it buys, queuing the drafts', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    const gift = levelUpCost(1, progression);
    applyCatchUp(world, player, { dnaGift: gift, mass: 100 }, createTestStepContext(world));
    expect(player.dnaCumulative).toBe(gift);
    expect(player.dnaCatchUpGift).toBe(gift);
    expect(player.level).toBe(2);
    expect(player.dnaTowardNextLevel).toBe(0);
    expect(player.offerQueue).toHaveLength(1);
    expect(player.offerQueue[0]?.shownAtTick).toBeNull();
  });
});
