import { afterEach, describe, expect, it, vi } from 'vitest';
import { DNA_TAG, FOOD_KIND, entityId, type DnaFragmentView } from '@evolution/shared';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { FoodDeltaTracker, MoteMotion } from './food-delta-tracker.js';
import { ViewerMemberJson } from './viewer-member-json.js';

const VIEWERS = 8;
const MOTES = 5;
const STEP_WU = 5;
const FRAGMENT: DnaFragmentView = { id: entityId('d1'), x: 7, y: 8, tag: DNA_TAG.motile };

afterEach(() => vi.restoreAllMocks());

/** Eight viewers of one dish, each with its tracker, after a first broadcast that spawned everything. */
function viewersOfOneDish() {
  const world = createTestWorld();
  for (let index = 0; index < MOTES; index += 1) {
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: index * 10.25, y: -index } });
  }
  const motion = new MoteMotion();
  const trackers = Array.from({ length: VIEWERS }, (_unused, slot) => new FoodDeltaTracker(slot));
  const first = motion.position(world.food);
  const writer = new ViewerMemberJson();
  const firstDeltas = trackers.map((tracker) => writer.noteFood(tracker.diff(first, first.motes)));
  return { world, motion, trackers, writer, firstDeltas };
}

describe('ViewerMemberJson', () => {
  it('writes every member exactly as JSON.stringify does, so the wire does not change (#406)', () => {
    const { world, motion, trackers, writer, firstDeltas } = viewersOfOneDish();
    expect(writer.memberJson('food', firstDeltas[0])).toBe(JSON.stringify(firstDeltas[0]));
    world.food[1]!.x += STEP_WU;
    world.food = world.food.filter((mote) => mote !== world.food[2]);
    const next = motion.position(world.food);
    const delta = writer.noteFood(trackers[0]!.diff(next, next.motes));
    expect(delta.moved).toHaveLength(1);
    expect(delta.removedIds).toHaveLength(1);
    expect(writer.memberJson('food', delta)).toBe(JSON.stringify(delta));
    expect(writer.memberJson('dnaFragments', [FRAGMENT, FRAGMENT])).toBe(JSON.stringify([FRAGMENT, FRAGMENT]));
    const progress = { playerId: 'p1', level: 3 };
    expect(writer.memberJson('ownProgress', progress)).toBe(JSON.stringify(progress));
  });

  it('stringifies a mote once however many viewers are sent it (#406)', () => {
    const { world, motion, trackers, writer } = viewersOfOneDish();
    for (const mote of world.food) mote.x += STEP_WU;
    const next = motion.position(world.food);
    const deltas = trackers.map((tracker) => writer.noteFood(tracker.diff(next, next.motes)));
    const stringify = vi.spyOn(JSON, 'stringify');
    for (const delta of deltas) writer.memberJson('food', delta);
    const positions = new Set(deltas[0]!.moved);
    expect(positions.size).toBe(MOTES);
    const positionCalls = stringify.mock.calls.filter(([value]) => positions.has(value as never));
    expect(positionCalls, `each of ${MOTES} positions once, not once per viewer`).toHaveLength(MOTES);
  });
});
