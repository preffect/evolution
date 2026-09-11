// docs/ECOLOGY.md §1 (motion column) and docs/TRAITS.md §3.14, §6 (T8).
import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DEFAULT_BALANCE, DNA_TAG, FOOD_KIND, RANDOM_STREAM, TICK_HZ } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import { moveMotes } from './mote-motion.js';
import { spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';

const { ecology, world: worldBalance } = DEFAULT_BALANCE;
const FOOD_REACH = worldBalance.DISH_RADIUS - worldBalance.FOOD_EDGE_MARGIN;

function emptyWorld(): WorldState {
  const world = createTestWorld();
  world.cells = [];
  return world;
}

describe('moveMotes: bacteria', () => {
  it('steps each bacterium BACTERIUM_DRIFT_SPEED / TICK_HZ along a fresh heading and draws once per bacterium', () => {
    const world = emptyWorld();
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.plain, at: BROTH_POINT });
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: BROTH_POINT });
    const context = createTestStepContext(world);
    const positionBefore = context.streams[RANDOM_STREAM.moteMotion].getState().position;
    moveMotes(world, context);
    expect(Math.hypot(mote.x - BROTH_POINT.x, mote.y - BROTH_POINT.y)).toBeCloseTo(
      ecology.BACTERIUM_DRIFT_SPEED / TICK_HZ,
      9,
    );
    expect(context.streams[RANDOM_STREAM.moteMotion].getState().position).toBe(positionBefore + 1);
    expect(world.food[1]).toMatchObject(BROTH_POINT);
  });

  it('keeps bacteria within the food boundary', () => {
    const world = emptyWorld();
    const mote = spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: { x: FOOD_REACH, y: 0 },
    });
    const context = createTestStepContext(world);
    for (let tick = 0; tick < 200; tick += 1) {
      moveMotes(world, context);
      expect(Math.hypot(mote.x, mote.y)).toBeLessThanOrEqual(FOOD_REACH + 1e-9);
    }
  });
});

describe('moveMotes: fragments', () => {
  it('drifts a fragment by its drift vector per tick', () => {
    const world = emptyWorld();
    const fragment = spawnDnaFragment(world, { at: BROTH_POINT, tag: DNA_TAG.motile, driftTurn: 0 });
    moveMotes(world, createTestStepContext(world));
    expect(fragment.x).toBeCloseTo(BROTH_POINT.x + ecology.DNA_FRAGMENT_DRIFT_SPEED / TICK_HZ, 9);
    expect(fragment.y).toBeCloseTo(BROTH_POINT.y, 9);
  });

  it('reflects the drift at the food boundary and stays inside', () => {
    const world = emptyWorld();
    const fragment = spawnDnaFragment(world, { at: { x: FOOD_REACH - 0.05, y: 0 }, tag: DNA_TAG.motile, driftTurn: 0 });
    const context = createTestStepContext(world);
    moveMotes(world, context);
    expect(fragment.x).toBeCloseTo(FOOD_REACH, 9);
    expect(fragment.driftX).toBeCloseTo(-ecology.DNA_FRAGMENT_DRIFT_SPEED, 9);
    moveMotes(world, context);
    expect(fragment.x).toBeLessThan(FOOD_REACH);
  });
});

describe('moveMotes: detritus', () => {
  it('removes detritus on its expiry tick and not before', () => {
    const world = emptyWorld();
    const detritus = spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: BROTH_POINT });
    const context = createTestStepContext(world);
    world.tick = detritus.expiresAtTick! - 1;
    moveMotes(world, context);
    expect(world.food).toHaveLength(1);
    world.tick = detritus.expiresAtTick!;
    moveMotes(world, context);
    expect(world.food).toHaveLength(0);
  });
});

describe('moveMotes: attraction (T8)', () => {
  it('pulls a mote at 2.5 radii inward at the attract speed until eaten; a mote at 4 radii does not move', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.x = BROTH_POINT.x;
    cell.y = BROTH_POINT.y;
    world.players[0]!.ownedTraits.push({ traitId: 'euglena_eyespot', tier: 1 });
    refreshCellDerivedState(cell, world.players[0]!, DEFAULT_BALANCE);
    const near = spawnFoodMote(world, {
      kind: FOOD_KIND.algae,
      variant: null,
      at: { x: cell.x + 2.5 * cell.radius, y: cell.y },
    });
    const far = spawnFoodMote(world, {
      kind: FOOD_KIND.algae,
      variant: null,
      at: { x: cell.x + 4 * cell.radius, y: cell.y },
    });
    const context = createTestStepContext(world);
    moveMotes(world, context);
    expect(near.x).toBeCloseTo(cell.x + 2.5 * cell.radius - 40 / TICK_HZ, 9);
    let ticksToReach = 1;
    while (near.x - cell.x > cell.radius) {
      moveMotes(world, context);
      ticksToReach += 1;
    }
    expect(Math.abs(ticksToReach - 40)).toBeLessThanOrEqual(2);
    expect(far.x).toBe(cell.x + 4 * cell.radius);
  });

  it('never pulls a mote past the centre', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.modifiers.attractRangeInRadii = 3;
    cell.modifiers.attractSpeed = 4000;
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: cell.x + 5, y: cell.y } });
    moveMotes(world, createTestStepContext(world));
    expect(mote.x).toBeCloseTo(cell.x, 9);
  });
});
