// docs/PROGRESSION.md §5 (P7, P8) and docs/GAME-DESIGN.md §5.2, §13 (G10, G14): joins and leaves between ticks.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, EFFECT_KIND, FOOD_KIND, playerId } from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { runStep } from '../simulation/step.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { createInputRejectionCounters } from '../world/world-state.js';
import { detritusMoteCount } from './death.js';
import { addPlayerToWorld, removePlayerFromWorld } from './membership.js';

const { progression, growth } = DEFAULT_BALANCE;
const joiner = { playerId: playerId('c'), playerName: 'C', avatarIndex: 2 };
/** "Joins before tick N steps": the module sees the join at tick N − 1 and the joiner is present for step N. */
const P7_JOIN_TICK = 6000;
const P8_JOIN_TICK = 600;
const G14_JOIN_TICK = 18_000;

function twoPlayerWorld() {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  for (const player of world.players) player.dnaCumulative = 120;
  for (const cell of world.cells) setCellMass(cell, 400, DEFAULT_BALANCE);
  return world;
}

describe('addPlayerToWorld', () => {
  it('P8: a join before the grace starts fresh (the world floor is level 1 and the starting mass)', () => {
    const world = twoPlayerWorld();
    world.tick = P8_JOIN_TICK - 1;
    expect(addPlayerToWorld(world, joiner, createInputRejectionCounters())).toBe(true);
    const player = world.players[2]!;
    expect(player).toMatchObject({ playerId: 'c', joinOrder: 2, level: 1, dnaCumulative: 0, dnaCatchUpGift: 0 });
    expect(player.offerQueue).toEqual([]);
    expect(world.cells[2]!.mass).toBe(growth.CELL_STARTING_MASS);
  });

  it('P7: a join after the grace gets half the median DNA, a level-2 draft shown, and the capped entry mass', () => {
    const world = twoPlayerWorld();
    world.tick = P7_JOIN_TICK - 1;
    addPlayerToWorld(world, joiner, createInputRejectionCounters());
    const player = world.players[2]!;
    const gift = Math.floor(progression.ENTRY_DNA_FRACTION * 120);
    expect(player.dnaCumulative).toBe(gift);
    expect(player.dnaCatchUpGift).toBe(gift);
    expect(player.score).toBe(0);
    expect(player.level).toBe(2);
    expect(player.dnaTowardNextLevel).toBe(0);
    expect(player.offerQueue).toHaveLength(1);
    expect(player.offer?.offerId).toBe(1);
    expect(world.cells[2]!.mass).toBe(progression.ENTRY_MAX_MASS);
    expect(world.cells[2]!.level).toBe(2);
  });

  it("keeps a late joiner's level-up effects in world.effects through the next step (the broadcast drains them)", () => {
    const world = createTestWorld();
    world.tick = G14_JOIN_TICK - 1;
    addPlayerToWorld(world, joiner, createInputRejectionCounters());
    const levelUps = world.effects.filter((effect) => effect.kind === EFFECT_KIND.levelUp);
    expect(levelUps).toHaveLength(1);
    runStep(world, world.balance, createInputRejectionCounters());
    expect(world.effects).toContain(levelUps[0]);
  });

  it('G14: the world floor lifts a joiner even when the living player has nothing', () => {
    const world = createTestWorld();
    world.tick = G14_JOIN_TICK - 1;
    addPlayerToWorld(world, joiner, createInputRejectionCounters());
    const player = world.players[1]!;
    expect(player.dnaCumulative).toBe(60);
    expect(player.dnaCatchUpGift).toBe(60);
    expect(player.level).toBe(2);
    expect(player.offer).not.toBeNull();
    expect(world.cells[1]!.mass).toBe(160);
  });

  it('writes the placement stream back so a second join lands elsewhere', () => {
    const world = twoPlayerWorld();
    addPlayerToWorld(world, joiner, createInputRejectionCounters());
    addPlayerToWorld(
      world,
      { playerId: playerId('d'), playerName: 'D', avatarIndex: 3 },
      createInputRejectionCounters(),
    );
    expect(world.cells[2]!.x).not.toBe(world.cells[3]!.x);
  });

  it('refuses a player who is already in the world', () => {
    const world = twoPlayerWorld();
    expect(
      addPlayerToWorld(
        world,
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        createInputRejectionCounters(),
      ),
    ).toBe(false);
    expect(world.players).toHaveLength(2);
  });
});

describe('removePlayerFromWorld', () => {
  it('G10: dissolves the cell into detritus and drops the player record', () => {
    const world = twoPlayerWorld();
    const cell = world.cells[0]!;
    const expectedMotes = detritusMoteCount(cell.mass, world);
    expect(removePlayerFromWorld(world, playerId('a'))).toBe(true);
    expect(world.players.map((player) => player.playerId)).toEqual(['b']);
    expect(world.cells.map((entry) => entry.playerId)).toEqual(['b']);
    const detritus = world.food.filter((mote) => mote.kind === FOOD_KIND.detritus);
    expect(detritus).toHaveLength(expectedMotes);
    expect(detritus.reduce((sum, mote) => sum + mote.mass, 0)).toBe(
      expectedMotes * DEFAULT_BALANCE.ecology.DETRITUS_MOTE_MASS,
    );
  });

  it('removes a spectating player without a cell', () => {
    const world = twoPlayerWorld();
    world.cells = world.cells.filter((cell) => cell.playerId !== 'a');
    expect(removePlayerFromWorld(world, playerId('a'))).toBe(true);
    expect(world.food).toEqual([]);
  });

  it('returns false for an unknown player', () => {
    const world = twoPlayerWorld();
    expect(removePlayerFromWorld(world, playerId('nobody'))).toBe(false);
  });
});
