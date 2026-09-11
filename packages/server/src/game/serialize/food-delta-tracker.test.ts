import { describe, expect, it } from 'vitest';
import { FOOD_KIND } from '@evolution/shared';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { FoodDeltaTracker } from './food-delta-tracker.js';

function worldWithMotes(count: number) {
  const world = createTestWorld();
  for (let index = 0; index < count; index += 1) {
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: index * 10, y: 0 } });
  }
  return world;
}

describe('FoodDeltaTracker', () => {
  it('reports everything as spawned on the first call and nothing on an unchanged second call', () => {
    const world = worldWithMotes(3);
    const tracker = new FoodDeltaTracker();
    const first = tracker.diff(world.food);
    expect(first.spawned.map((view) => view.id)).toEqual(world.food.map((mote) => mote.id));
    expect(first.removedIds).toEqual([]);
    expect(first.moved).toEqual([]);
    expect(tracker.diff(world.food)).toEqual({ spawned: [], removedIds: [], moved: [] });
  });

  it('reports removed ids in the previous order and new motes as spawned', () => {
    const world = worldWithMotes(3);
    const tracker = new FoodDeltaTracker();
    tracker.diff(world.food);
    const [first, , third] = world.food;
    world.food = world.food.filter((mote) => mote !== first && mote !== third);
    const added = spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: { x: 99, y: 99 } });
    const delta = tracker.diff(world.food);
    expect(delta.removedIds).toEqual([first!.id, third!.id]);
    expect(delta.spawned.map((view) => view.id)).toEqual([added.id]);
    expect(delta.moved).toEqual([]);
  });

  it('reports a mote whose quantised position changed as moved, not one that jittered under the precision', () => {
    const world = worldWithMotes(2);
    const tracker = new FoodDeltaTracker();
    tracker.diff(world.food);
    world.food[0]!.x += 0.01;
    world.food[1]!.x += 5;
    const delta = tracker.diff(world.food);
    expect(delta.moved).toEqual([{ id: world.food[1]!.id, x: 15, y: 0 }]);
    expect(delta.spawned).toEqual([]);
  });

  it('reports an id that was removed and re-added as spawned again', () => {
    const world = worldWithMotes(1);
    const tracker = new FoodDeltaTracker();
    tracker.diff(world.food);
    const [mote] = world.food;
    world.food = [];
    expect(tracker.diff(world.food).removedIds).toEqual([mote!.id]);
    world.food = [mote!];
    expect(tracker.diff(world.food).spawned.map((view) => view.id)).toEqual([mote!.id]);
  });
});
