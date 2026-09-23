import { beforeEach, describe, expect, it } from 'vitest';
import { FOOD_KIND } from '@evolution/shared';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import type { FoodMoteRecord } from '../world/entities.js';
import { FoodDeltaTracker, MoteMotion } from './food-delta-tracker.js';

function worldWithMotes(count: number) {
  const world = createTestWorld();
  for (let index = 0; index < count; index += 1) {
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: index * 10, y: 0 } });
  }
  return world;
}

/** The room's one `MoteMotion`, shared by every tracker of a test, and the next free viewer slot. */
let motion = new MoteMotion();
let slots = 0;
const nextSlot = (): number => slots++;

/** One broadcast's delta for one viewer seeing every mote: the motion read once, then diffed. */
function diffOf(tracker: FoodDeltaTracker, food: readonly FoodMoteRecord[]) {
  const positioned = motion.position(food);
  return tracker.diff(positioned, positioned.motes).delta;
}

beforeEach(() => {
  motion = new MoteMotion();
  slots = 0;
});

describe('FoodDeltaTracker', () => {
  it('reports everything as spawned on the first call and nothing on an unchanged second call', () => {
    const world = worldWithMotes(3);
    const tracker = new FoodDeltaTracker(nextSlot());
    const first = diffOf(tracker, world.food);
    expect(first.spawned.map((view) => view.id)).toEqual(world.food.map((mote) => mote.id));
    expect(first.removedIds).toEqual([]);
    expect(first.moved).toEqual([]);
    expect(diffOf(tracker, world.food)).toEqual({ spawned: [], removedIds: [], moved: [] });
  });

  it('reports removed ids in the previous order and new motes as spawned', () => {
    const world = worldWithMotes(3);
    const tracker = new FoodDeltaTracker(nextSlot());
    diffOf(tracker, world.food);
    const [first, , third] = world.food;
    world.food = world.food.filter((mote) => mote !== first && mote !== third);
    const added = spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: { x: 99, y: 99 } });
    const delta = diffOf(tracker, world.food);
    expect(delta.removedIds).toEqual([first!.id, third!.id]);
    expect(delta.spawned.map((view) => view.id)).toEqual([added.id]);
    expect(delta.moved).toEqual([]);
  });

  it('reports a mote whose quantised position changed as moved, not one that jittered under the precision', () => {
    const world = worldWithMotes(2);
    const tracker = new FoodDeltaTracker(nextSlot());
    diffOf(tracker, world.food);
    world.food[0]!.x += 0.01;
    world.food[1]!.x += 5;
    const delta = diffOf(tracker, world.food);
    expect(delta.moved).toEqual([{ id: world.food[1]!.id, x: 15, y: 0 }]);
    expect(delta.spawned).toEqual([]);
  });

  it('reports an id that was removed and re-added as spawned again', () => {
    const world = worldWithMotes(1);
    const tracker = new FoodDeltaTracker(nextSlot());
    diffOf(tracker, world.food);
    const [mote] = world.food;
    world.food = [];
    expect(diffOf(tracker, world.food).removedIds).toEqual([mote!.id]);
    world.food = [mote!];
    expect(diffOf(tracker, world.food).spawned.map((view) => view.id)).toEqual([mote!.id]);
  });

  it('sends a viewer that missed a broadcast the move made during it, and not a viewer that was sent it (#406)', () => {
    const world = worldWithMotes(1);
    const everyBroadcast = new FoodDeltaTracker(nextSlot());
    const missedOne = new FoodDeltaTracker(nextSlot());
    const first = motion.position(world.food);
    everyBroadcast.diff(first, first.motes);
    missedOne.diff(first, first.motes);
    world.food[0]!.x += 5;
    const second = motion.position(world.food);
    expect(everyBroadcast.diff(second, second.motes).delta.moved.map((position) => position.x)).toEqual([5]);
    const third = motion.position(world.food);
    expect(everyBroadcast.diff(third, third.motes).delta.moved, 'nothing moved since the second').toEqual([]);
    expect(
      missedOne.diff(third, third.motes).delta.moved.map((position) => position.x),
      'moved while it was not sent',
    ).toEqual([5]);
  });

  it('shares one position and one spawned view per mote between every viewer of a broadcast (#406)', () => {
    const world = worldWithMotes(2);
    const positioned = motion.position(world.food);
    const [ownDelta, otherDelta] = [new FoodDeltaTracker(nextSlot()), new FoodDeltaTracker(nextSlot())].map(
      (tracker) => tracker.diff(positioned, positioned.motes).delta,
    );
    expect(otherDelta!.spawned[0]).toBe(ownDelta!.spawned[0]);
    world.food[0]!.x += 5;
    const next = motion.position(world.food);
    const trackers = [new FoodDeltaTracker(nextSlot()), new FoodDeltaTracker(nextSlot())];
    trackers.forEach((tracker) => tracker.diff(positioned, positioned.motes));
    const [movedForOwn, movedForOther] = trackers.map((tracker) => tracker.diff(next, next.motes).delta.moved);
    expect(movedForOther![0]).toBe(movedForOwn![0]);
  });
});
