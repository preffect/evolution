// docs/PROGRESSION.md §5: the entry rule over the world reference and the living players' medians.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, PLAYER_LIFE_STATE, playerId, secondsToTicks, worldReference } from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { applyEntryState, entryState, lateJoinMedians, livingMedians, medianOf } from './entry.js';

const { progression } = DEFAULT_BALANCE;
const THREE_MINUTES_SECONDS = 180;
const SIX_AND_A_HALF_MINUTES_SECONDS = 393.017;

function twoPlayerWorld() {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  world.players[0]!.dnaCumulative = 100;
  world.players[1]!.dnaCumulative = 140;
  setCellMass(world.cells[0]!, 300, DEFAULT_BALANCE);
  setCellMass(world.cells[1]!, 500, DEFAULT_BALANCE);
  return world;
}

describe('medianOf', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    expect(medianOf([5, 1, 3])).toBe(3);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([7])).toBe(7);
  });
});

describe('entryState', () => {
  it('reads the world floor alone for a respawn: the world DNA and half the world mass, bounded', () => {
    const fresh = { dnaCumulative: 0 };
    expect(entryState(fresh, null, worldReference(0, DEFAULT_BALANCE), DEFAULT_BALANCE)).toEqual({
      dnaGift: 0,
      mass: DEFAULT_BALANCE.growth.CELL_STARTING_MASS,
    });
    expect(entryState(fresh, null, worldReference(THREE_MINUTES_SECONDS, DEFAULT_BALANCE), DEFAULT_BALANCE)).toEqual({
      dnaGift: 60,
      mass: 100,
    });
    const late = entryState(
      fresh,
      null,
      worldReference(SIX_AND_A_HALF_MINUTES_SECONDS, DEFAULT_BALANCE),
      DEFAULT_BALANCE,
    );
    expect(late).toEqual({ dnaGift: 140, mass: progression.ENTRY_MAX_MASS });
  });

  it('never lowers a player above the floor (a gift of zero) and lifts by the medians when they are higher', () => {
    const reference = worldReference(THREE_MINUTES_SECONDS, DEFAULT_BALANCE);
    expect(entryState({ dnaCumulative: 200 }, null, reference, DEFAULT_BALANCE).dnaGift).toBe(0);
    const state = entryState({ dnaCumulative: 0 }, { mass: 500, dnaCumulative: 300 }, reference, DEFAULT_BALANCE);
    expect(state).toEqual({ dnaGift: 150, mass: progression.ENTRY_MAX_MASS });
  });
});

describe('livingMedians and lateJoinMedians', () => {
  it('measures the living players only, and nobody when all spectate', () => {
    const world = twoPlayerWorld();
    expect(livingMedians(world)).toEqual({ mass: 400, dnaCumulative: 120 });
    world.players[1]!.lifeState = PLAYER_LIFE_STATE.spectating;
    world.cells.pop();
    expect(livingMedians(world)).toEqual({ mass: 300, dnaCumulative: 100 });
    world.players[0]!.lifeState = PLAYER_LIFE_STATE.spectating;
    expect(livingMedians(world)).toBeNull();
  });

  it('has no median term inside the grace, and one right after it', () => {
    const world = twoPlayerWorld();
    const graceTicks = secondsToTicks(progression.ENTRY_GRACE_SECONDS);
    expect(lateJoinMedians(world, graceTicks)).toBeNull();
    expect(lateJoinMedians(world, graceTicks + 1)).toEqual({ mass: 400, dnaCumulative: 120 });
  });
});

describe('applyEntryState', () => {
  it('grants the gift, climbs every level it buys one draft each, and shows the first draft', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    applyEntryState(world, player, { dnaGift: 140, mass: 20 }, createTestStepContext(world));
    expect(player).toMatchObject({ dnaCumulative: 140, dnaCatchUpGift: 140, level: 3, dnaTowardNextLevel: 0 });
    expect(player.offerQueue).toHaveLength(2);
    expect(player.offer?.offerId).toBe(1);
    expect(player.offerQueue[1]?.shownAtTick).toBeNull();
    expect(player.score).toBe(0);
  });

  it('leaves a player at or above the floor untouched', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    applyEntryState(world, player, { dnaGift: 0, mass: 20 }, createTestStepContext(world));
    expect(player).toMatchObject({ dnaCumulative: 0, dnaCatchUpGift: 0, level: 1 });
    expect(player.offerQueue).toEqual([]);
  });
});
