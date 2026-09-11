import { describe, expect, it } from 'vitest';
import { FOOD_KIND, ROUND_PHASE, SNAPSHOT_POSITION_DECIMALS, type GameEffect, EFFECT_KIND } from '@evolution/shared';
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

  it('projects a player onto the view fields with copied records and offer', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    player.offer = { offerId: 1, cards: [{ traitId: 'nucleoid', tier: 1 }], expiresAtTick: 600 };
    const view = toPlayerProgressView(player);
    expect(view.offer).toEqual(player.offer);
    expect(view.offer).not.toBe(player.offer);
    expect(view.dnaTagPoints).not.toBe(player.dnaTagPoints);
    expect(view).not.toHaveProperty('offerQueue');
    expect(view).not.toHaveProperty('pendingInput');
    expect(view).not.toHaveProperty('joinOrder');
    expect(toPlayerProgressView({ ...player, offer: null }).offer).toBeNull();
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
    expect(Object.keys(snapshot.players)).toEqual(['p1']);
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
    const first = serializeDeltaSnapshot(world, tracker, effects);
    expect(first.food.spawned.map((view) => view.id)).toEqual([mote.id]);
    expect(first.effects).toEqual(effects);
    expect(first.effects).not.toBe(effects);
    world.food = [];
    const second = serializeDeltaSnapshot(world, tracker, []);
    expect(second.food).toEqual({ spawned: [], removedIds: [mote.id], moved: [] });
  });
});
