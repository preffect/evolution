import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANTS,
  CELL_STAGE,
  createSeededRandom,
  DEFAULT_BALANCE,
  DEFAULT_CELL_MODIFIERS,
  DNA_TAGS,
  PLAYER_LIFE_STATE,
  playerId,
  radiusForMass,
} from '@evolution/shared';
import { findSafeSpawnPoint } from '../simulation/spawn-placement.js';
import { createTestWorld, TEST_PLAYER } from '../../testing/world-builders.js';
import {
  createCellRecord,
  createPlayerRecord,
  spawnCellForPlayer,
  zeroBacteriaCounters,
  zeroTagPoints,
} from './players.js';

const SEED = 42;

describe('createPlayerRecord', () => {
  it('starts at level 1, alive, with every counter at zero and no offers', () => {
    const player = createPlayerRecord({ playerId: playerId('p9'), playerName: 'Nine', avatarIndex: 4 }, 3);
    expect(player).toMatchObject({
      playerId: 'p9',
      playerName: 'Nine',
      avatarIndex: 4,
      joinOrder: 3,
      level: 1,
      dnaCumulative: 0,
      dnaCatchUpGift: 0,
      dnaTowardNextLevel: 0,
      absorptions: 0,
      score: 0,
      offer: null,
      lifeState: PLAYER_LIFE_STATE.alive,
      spectatingCellId: null,
      wildAbsorptions: 0,
      respawnInTicks: 0,
      ownedTraits: [],
      offerQueue: [],
      nextOfferId: 1,
      appliedInputSequence: 0,
      pendingInput: null,
    });
    expect(Object.keys(player.dnaTagPoints)).toEqual([...DNA_TAGS]);
    expect(Object.keys(player.bacteriaEatenByVariant)).toEqual([...BACTERIUM_VARIANTS]);
    expect(Object.values(zeroTagPoints()).every((value) => value === 0)).toBe(true);
    expect(Object.values(zeroBacteriaCounters()).every((value) => value === 0)).toBe(true);
  });
});

describe('createCellRecord', () => {
  it('appends a free protocell targeting its own centre with its derived state folded', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    player.level = 3;
    player.ownedTraits.push({ traitId: 'cell_wall', tier: 2 });
    const cell = createCellRecord(world, player, { x: 100, y: 200 }, 80);
    expect(world.cells.at(-1)).toBe(cell);
    expect(cell).toMatchObject({
      playerId: TEST_PLAYER.playerId,
      organismId: cell.id,
      x: 100,
      y: 200,
      targetX: 100,
      targetY: 200,
      velocityX: 0,
      mass: 80,
      level: 3,
      states: [],
      engulfProgress: 0,
      pinnedX: null,
      sprintRemainingTicks: 0,
    });
    expect(cell.radius).toBeCloseTo(radiusForMass(80, DEFAULT_BALANCE.growth), 12);
    expect(cell.traits).toEqual([{ traitId: 'cell_wall', tier: 2 }]);
    expect(cell.membraneRatioBonus).toBe(0.3);
    expect(cell.modifiers.speedMultiplier).toBe(0.9);
    expect(cell.stage).toBe(CELL_STAGE.protocell);
  });

  it('gives a bare cell the identity modifiers', () => {
    const world = createTestWorld();
    const cell = createCellRecord(world, world.players[0]!, { x: 0, y: 0 }, 20);
    expect(cell.modifiers).toEqual(DEFAULT_CELL_MODIFIERS);
  });
});

describe('spawnCellForPlayer', () => {
  it('places by safe placement from the given stream and resets the life state', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    world.cells = [];
    player.lifeState = PLAYER_LIFE_STATE.spectating;
    player.spectatingCellId = world.cells[0]?.id ?? null;
    player.respawnInTicks = 7;
    const expected = findSafeSpawnPoint(createSeededRandom(SEED), [], DEFAULT_BALANCE);
    const cell = spawnCellForPlayer(world, player, 20, createSeededRandom(SEED));
    expect({ x: cell.x, y: cell.y }).toEqual(expected);
    expect(player.lifeState).toBe(PLAYER_LIFE_STATE.alive);
    expect(player.spectatingCellId).toBeNull();
    expect(player.respawnInTicks).toBe(0);
    expect(world.cells).toEqual([cell]);
  });
});
