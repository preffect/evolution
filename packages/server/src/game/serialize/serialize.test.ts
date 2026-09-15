import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  FOOD_KIND,
  ROUND_PHASE,
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_RADIUS_DECIMALS,
  SNAPSHOT_SCORE_DECIMALS,
  SNAPSHOT_VELOCITY_DECIMALS,
  type GameEffect,
  type LeaderboardRow,
  EFFECT_KIND,
  playerId,
} from '@evolution/shared';
import { updateLeaderboard } from '../session/leaderboard.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { FoodDeltaTracker } from './food-delta-tracker.js';
import { EXACT_SNAPSHOT_VALUES } from './quantize.js';
import {
  serializeDeltaSnapshot,
  serializeFullSnapshot,
  toCellView,
  toDnaFragmentView,
  toFoodMoteView,
  toLeaderboardRowView,
  toMotePositionView,
  toPlayerProgressView,
  toPlayerRosterView,
  ownProgressOf,
  serializeViewerState,
  VIEWER_SNAPSHOT_KEYS,
} from './serialize.js';

/** A grown, moving cell as a recording client saw it on the wire before #341: every float at full precision. */
const MOVING_CELL = {
  velocityX: 154.05011631888448,
  velocityY: -12.34,
  mass: 117.91111692892059,
  radius: 43.43472678624837,
};

describe('view projections', () => {
  it('projects a cell onto exactly the view fields with quantised positions and copied arrays', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.x = 10.123;
    cell.y = -20.456;
    const view = toCellView(cell);
    expect(view.x).toBe(10.1);
    expect(view.y).toBe(-20.5);
    expect(view).not.toHaveProperty('targetX');
    expect(view).not.toHaveProperty('modifiers');
    expect(view).not.toHaveProperty('pinnedX');
    expect(view.traits).not.toBe(cell.traits);
    expect(view.states).not.toBe(cell.states);
    expect(Object.keys(view).sort()).toEqual(
      [
        'id',
        'kind',
        'playerId',
        'organismId',
        'avatarIndex',
        'x',
        'y',
        'velocityX',
        'velocityY',
        'mass',
        'radius',
        'level',
        'stage',
        'traits',
        'membraneRatioBonus',
        'states',
        'engulfProgress',
        'engulfingCellId',
        'engulfedByCellId',
        'sprintRemainingTicks',
        'sprintCooldownRemainingTicks',
      ].sort(),
    );
  });

  it('rounds a cell’s velocity, mass and radius to their wire decimals and leaves the record exact', () => {
    const world = createTestWorld();
    const cell = Object.assign(world.cells[0]!, MOVING_CELL);
    expect([SNAPSHOT_VELOCITY_DECIMALS, SNAPSHOT_MASS_DECIMALS, SNAPSHOT_RADIUS_DECIMALS]).toEqual([1, 1, 1]);
    expect(toCellView(cell)).toMatchObject({ velocityX: 154.1, velocityY: -12.3, mass: 117.9, radius: 43.4 });
    expect(cell).toMatchObject(MOVING_CELL);
  });

  it('writes every number exact with EXACT_SNAPSHOT_VALUES', () => {
    const world = createTestWorld();
    const cell = Object.assign(world.cells[0]!, MOVING_CELL, { x: 10.123, y: -20.456 });
    expect(toCellView(cell, EXACT_SNAPSHOT_VALUES)).toMatchObject({ ...MOVING_CELL, x: 10.123, y: -20.456 });
  });

  it('projects motes, positions and fragments', () => {
    const world = createTestWorld();
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'aerobic', at: { x: 1.26, y: 2.24 } });
    expect(toFoodMoteView(mote)).toEqual({
      id: mote.id,
      kind: 'bacterium',
      bacteriumVariant: 'aerobic',
      x: 1.3,
      y: 2.2,
    });
    expect(toMotePositionView(mote)).toEqual({ id: mote.id, x: 1.3, y: 2.2 });
    const fragment = spawnDnaFragment(world, { at: { x: 5.55, y: 6 }, tag: 'motile', driftTurn: 0 });
    expect(toDnaFragmentView(fragment)).toEqual({ id: fragment.id, x: 5.6, y: 6, tag: 'motile' });
  });

  it('copies a leaderboard row with its score whole and its mass at the cell’s precision', () => {
    const row: LeaderboardRow = {
      rank: 1,
      playerId: playerId('p1'),
      score: 1877.2600000000025,
      mass: 689.1834400023941,
      level: 11,
      absorptions: 10,
    };
    expect(SNAPSHOT_SCORE_DECIMALS).toBe(0);
    const view = toLeaderboardRowView(row);
    expect(view).toEqual({ ...row, score: 1877, mass: 689.2 });
    expect(view).not.toBe(row);
    expect(row.score).toBe(1877.2600000000025);
    expect(toLeaderboardRowView(row, EXACT_SNAPSHOT_VALUES)).toEqual(row);
  });

  it('projects a player onto the view fields with copied records, owned traits and offer', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    player.offer = { offerId: 1, level: 3, cards: [{ traitId: 'nucleoid', tier: 1 }], expiresAtTick: 600 };
    player.ownedTraits = [{ traitId: 'nucleoid', tier: 2 }];
    player.stage = CELL_STAGE.prokaryote;
    const view = toPlayerProgressView(player);
    expect(view.offer).toEqual(player.offer);
    expect(view.offer).not.toBe(player.offer);
    expect(view).toMatchObject({ ownedTraits: player.ownedTraits, stage: CELL_STAGE.prokaryote });
    expect(view.ownedTraits[0]).not.toBe(player.ownedTraits[0]);
    expect(view.dnaTagPoints).not.toBe(player.dnaTagPoints);
    expect(view).not.toHaveProperty('offerQueue');
    expect(view).not.toHaveProperty('pendingInput');
    expect(view).not.toHaveProperty('joinOrder');
    expect(toPlayerProgressView({ ...player, offer: null }).offer).toBeNull();
  });

  it('projects a player onto a roster row of its id and name only', () => {
    const player = createTestWorld().players[0]!;
    player.ownedTraits = [{ traitId: 'nucleoid', tier: 2 }];
    expect(toPlayerRosterView(player)).toEqual({ playerId: player.playerId, playerName: player.playerName });
  });
});

describe('ownProgressOf', () => {
  it('is the viewer’s own progress view', () => {
    const world = createTestWorld();
    const viewer = world.players[0]!;
    viewer.ownedTraits = [{ traitId: 'nucleoid', tier: 1 }];
    expect(ownProgressOf(world, viewer.playerId)).toEqual(toPlayerProgressView(viewer));
  });

  it('is null for a viewer with no player in the world', () => {
    expect(ownProgressOf(createTestWorld(), playerId('nobody'))).toBeNull();
  });
});

describe('serializeViewerState', () => {
  it('answers exactly the declared viewer members: the viewer’s own progress', () => {
    const world = createTestWorld();
    const viewer = world.players[0]!;
    const state = serializeViewerState(world, viewer.playerId);
    expect(Object.keys(state)).toEqual([...VIEWER_SNAPSHOT_KEYS]);
    expect(state.ownProgress).toEqual(toPlayerProgressView(viewer));
  });
});

describe('serializeFullSnapshot', () => {
  it('carries every mote as spawned, the players keyed by id and no effects', () => {
    const world = createTestWorld({ isFilled: true });
    world.effects.push({
      kind: EFFECT_KIND.respawn,
      tick: 0,
      x: 0,
      y: 0,
      cellId: world.cells[0]!.id,
      playerId: 'p1',
    } as GameEffect);
    const snapshot = serializeFullSnapshot(world);
    expect(snapshot.food.spawned).toHaveLength(world.food.length);
    expect(snapshot.food.removedIds).toEqual([]);
    expect(snapshot.food.moved).toEqual([]);
    expect(snapshot.effects).toEqual([]);
    expect(snapshot.players).toEqual({ p1: toPlayerRosterView(world.players[0]!) });
    expect(snapshot.ownProgress).toBeNull();
    expect(snapshot.appliedInputSequenceByPlayer).toEqual({ p1: 0 });
    expect(snapshot.roundPhase).toBe(ROUND_PHASE.playing);
    expect(snapshot.seed).toBe(world.seed);
    expect(snapshot.dnaFragments).toHaveLength(world.dnaFragments.length);
    expect(snapshot.gelPatches).toEqual(world.gelPatches);
    expect(snapshot.gelPatches).not.toBe(world.gelPatches);
    expect(snapshot.leaderboard).toEqual(world.leaderboard.map((row) => toLeaderboardRowView(row)));
  });

  it('writes a cell and its leaderboard row with one wire mass, so the HUD shows one whole number for both', () => {
    const world = createTestWorld();
    // Just under a half: rounded once more to 0 decimals it would read 20, but 21 once it is 20.5 on the wire.
    world.cells[0]!.mass = 20.46;
    updateLeaderboard(world);
    const snapshot = serializeFullSnapshot(world);
    expect(snapshot.leaderboard[0]!.mass).toBe(snapshot.cells[0]!.mass);
  });
});

describe('serializeDeltaSnapshot', () => {
  it('carries the tracker diff and the given effects', () => {
    const world = createTestWorld();
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 1, y: 1 } });
    const tracker = new FoodDeltaTracker();
    const effects: GameEffect[] = [
      {
        kind: EFFECT_KIND.eat,
        tick: 1,
        x: 0,
        y: 0,
        cellId: world.cells[0]!.id,
        eatenId: mote.id,
        eatenKind: 'food_mote',
      },
    ];
    world.effects.push(...effects);
    const first = serializeDeltaSnapshot(world, tracker);
    expect(first.food.spawned.map((view) => view.id)).toEqual([mote.id]);
    expect(first.effects).toEqual(effects);
    expect(world.effects).toEqual([]);
    world.food = [];
    const second = serializeDeltaSnapshot(world, tracker);
    expect(second.food).toEqual({ spawned: [], removedIds: [mote.id], moved: [] });
    expect(second.effects).toEqual([]);
  });
});
