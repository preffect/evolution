import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  FOOD_KIND,
  ROUND_PHASE,
  SNAPSHOT_POSITION_DECIMALS,
  type GameEffect,
  EFFECT_KIND,
  playerId,
} from '@evolution/shared';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { FoodDeltaTracker } from './food-delta-tracker.js';
import {
  quantizePosition,
  serializeDeltaSnapshot,
  serializeFullSnapshot,
  toCellView,
  toDnaFragmentView,
  toFoodMoteView,
  toMotePositionView,
  toPlayerProgressView,
  toPlayerRosterView,
  withOwnProgress,
} from './serialize.js';

describe('quantizePosition', () => {
  it('rounds to SNAPSHOT_POSITION_DECIMALS', () => {
    expect(SNAPSHOT_POSITION_DECIMALS).toBe(1);
    expect(quantizePosition(1234.56789)).toBe(1234.6);
    expect(quantizePosition(-0.04)).toBe(-0);
  });
});

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

describe('withOwnProgress', () => {
  it('adds the viewer’s own progress and leaves every other row a roster row', () => {
    const world = createTestWorld();
    const viewer = world.players[0]!;
    viewer.ownedTraits = [{ traitId: 'nucleoid', tier: 1 }];
    const snapshot = serializeFullSnapshot(world);
    const viewed = withOwnProgress(snapshot, world, viewer.playerId);
    expect(viewed.ownProgress).toEqual(toPlayerProgressView(viewer));
    expect(viewed.players).toBe(snapshot.players);
    expect(snapshot.ownProgress).toBeNull();
  });

  it('gives a viewer with no player in the world no progress', () => {
    const world = createTestWorld();
    expect(withOwnProgress(serializeFullSnapshot(world), world, playerId('nobody')).ownProgress).toBeNull();
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
    expect(snapshot.leaderboard).toEqual(world.leaderboard);
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
