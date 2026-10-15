// docs/game-design/phases.md §14.5.2, §14.4.2 steps 2 and 7: the move places the swarms clear of the landing and inside
// the food boundary; the green speck swarms drift toward the light patch at `POOL_SWARM_SPEED`, their
// specks with them, until the swarm's centre is inside it; a swarm eaten down to a quarter respawns at a random point
// from the `pool` stream, its last specks left lying.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  FOOD_KIND,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  createTestPoolLayout,
  distanceBetween,
  type Vec2,
} from '@evolution/shared';
import { createTestStepContext, createTestWorld, createTestWorldInEras } from '../../testing/world-builders.js';
import type { PoolSwarmRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { placePoolSwarms, runPoolSwarms } from './pool-swarms.js';
import { spawnFoodMote } from './spawn-mote.js';
import { foodBoundaryRadius } from './zones.js';

const { pool } = DEFAULT_BALANCE;
const DIGITS = 9;
/** The test layout's patch lies 1 500 wu due east on tick 0. */
const PATCH_ON_TICK_ZERO = { x: 1500, y: 0 };
const STEP_WU = pool.POOL_SWARM_SPEED * TICK_INTERVAL_S;
/** Eaten down to a quarter of `POOL_SWARM_SIZE` (12): three specks left. */
const QUARTER = pool.POOL_SWARM_SIZE / 4;

/** A world in the pool on tick 0, the test layout's patch due east, no food. */
function poolWorld(): WorldState {
  const world = createTestWorldInEras();
  world.poolLayout = createTestPoolLayout();
  world.tick = 0;
  world.poolSwarms = [];
  return world;
}

/**
 * A full swarm centred on `centre`: a speck at each of `specks`, in order, then the rest of `POOL_SWARM_SIZE` each
 * 1 wu further east of the centre, so no swarm here is eaten down to its respawn.
 */
function addSwarm(world: WorldState, centre: Vec2, specks: readonly Vec2[] = []): PoolSwarmRecord {
  const padding = Array.from({ length: pool.POOL_SWARM_SIZE - specks.length }, (_unused, index) => ({
    x: centre.x + index,
    y: centre.y,
  }));
  const memberIds = [...specks, ...padding].map(
    (point) => spawnFoodMote(world, { kind: FOOD_KIND.greenSpeck, variant: null, at: point }).id,
  );
  const swarm = { centreX: centre.x, centreY: centre.y, memberIds };
  world.poolSwarms!.push(swarm);
  return swarm;
}

function eatSpecks(world: WorldState, swarm: PoolSwarmRecord, count: number): void {
  const eaten = new Set(swarm.memberIds.slice(0, count));
  world.food = world.food.filter((mote) => !eaten.has(mote.id));
}

function step(world: WorldState): void {
  runPoolSwarms(world, createTestStepContext(world));
}

describe('placePoolSwarms (the move)', () => {
  /**
   * Enough seeds that some centres fall in the outermost 150 wu of each allowed band: over 200 centres, a band that
   * narrow on the inner edge holds about 4 % of them, so a bound loosened by `POOL_SWARM_RADIUS` is caught.
   */
  const seeds = Array.from({ length: 20 }, (_unused, index) => index + 1);
  const { eras } = DEFAULT_BALANCE;
  const innerBound = eras.ERA_LANDING_CLEAR_RADIUS + pool.POOL_SWARM_RADIUS;
  const outerBound = foodBoundaryRadius(DEFAULT_BALANCE) - pool.POOL_SWARM_RADIUS;

  function swarmsForSeeds(): { world: WorldState; swarms: PoolSwarmRecord[] } {
    const world = createTestWorld();
    const swarms = seeds.flatMap((seed) => {
      placePoolSwarms(world, createSeededRandom(seed));
      return world.poolSwarms!;
    });
    return { world, swarms };
  }

  it('puts every centre at least ERA_LANDING_CLEAR_RADIUS + POOL_SWARM_RADIUS out, so no speck lands in the landing', () => {
    const { world, swarms } = swarmsForSeeds();
    const radii = swarms.map((swarm) => Math.hypot(swarm.centreX, swarm.centreY));
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(innerBound);
    expect(Math.min(...radii)).toBeLessThan(innerBound + pool.POOL_SWARM_RADIUS);
    for (const speck of world.food) {
      expect(Math.hypot(speck.x, speck.y)).toBeGreaterThanOrEqual(eras.ERA_LANDING_CLEAR_RADIUS);
    }
  });

  it('puts every centre at most POOL_SWARM_RADIUS inside the food boundary, so every speck lies inside it', () => {
    const { world, swarms } = swarmsForSeeds();
    const radii = swarms.map((swarm) => Math.hypot(swarm.centreX, swarm.centreY));
    expect(Math.max(...radii)).toBeLessThanOrEqual(outerBound);
    expect(Math.max(...radii)).toBeGreaterThan(outerBound - pool.POOL_SWARM_RADIUS);
    for (const speck of world.food) {
      expect(Math.hypot(speck.x, speck.y)).toBeLessThanOrEqual(foodBoundaryRadius(DEFAULT_BALANCE));
    }
  });
});

describe('runPoolSwarms: the drift', () => {
  it('moves a swarm’s centre and every speck one tick of POOL_SWARM_SPEED toward the patch', () => {
    const world = poolWorld();
    const swarm = addSwarm(world, { x: -1500, y: 0 }, [
      { x: -1500, y: 100 },
      { x: -1450, y: -40 },
    ]);
    const before = world.food.map((speck) => ({ x: speck.x, y: speck.y }));
    step(world);
    expect(swarm.centreX).toBeCloseTo(-1500 + STEP_WU, DIGITS);
    expect(swarm.centreY).toBeCloseTo(0, DIGITS);
    expect(world.food.map((speck) => ({ x: speck.x, y: speck.y }))).toEqual(
      before.map((point) => ({ x: point.x + STEP_WU, y: point.y })),
    );
  });

  it('stops once the centre is inside the patch, and steps no further than its rim', () => {
    const world = poolWorld();
    const inside = addSwarm(world, { x: PATCH_ON_TICK_ZERO.x - 100, y: 0 }, [{ x: 1400, y: 0 }]);
    const nearRim = PATCH_ON_TICK_ZERO.x - pool.POOL_LIGHT_PATCH_RADIUS - STEP_WU / 2;
    const atRim = addSwarm(world, { x: nearRim, y: 0 });
    step(world);
    expect([inside.centreX, world.food[0]!.x]).toEqual([1400, 1400]);
    expect(distanceBetween({ x: atRim.centreX, y: atRim.centreY }, PATCH_ON_TICK_ZERO)).toBeCloseTo(
      pool.POOL_LIGHT_PATCH_RADIUS,
      DIGITS,
    );
  });

  it('follows the patch round its orbit: a quarter turn later it heads north', () => {
    const world = poolWorld();
    world.tick = pool.POOL_LIGHT_PATCH_PERIOD_SECONDS / TICK_INTERVAL_S / 4;
    const swarm = addSwarm(world, { x: 0, y: -1500 });
    step(world);
    expect(swarm.centreX).toBeCloseTo(0, DIGITS);
    expect(swarm.centreY).toBeCloseTo(-1500 + STEP_WU, DIGITS);
  });

  it('keeps a carried speck inside the food boundary', () => {
    const world = poolWorld();
    const boundary = foodBoundaryRadius(DEFAULT_BALANCE);
    addSwarm(world, { x: -1500, y: 0 }, [{ x: 0, y: boundary }]);
    step(world);
    expect(Math.hypot(world.food[0]!.x, world.food[0]!.y)).toBeCloseTo(boundary, DIGITS);
    expect(world.food[0]!.x).toBeGreaterThan(0);
  });
});

describe('runPoolSwarms: the respawn', () => {
  it('drops eaten specks from the swarm and keeps it while more than a quarter is left', () => {
    const world = poolWorld();
    const swarm = addSwarm(world, { x: -1500, y: 0 });
    eatSpecks(world, swarm, pool.POOL_SWARM_SIZE - QUARTER - 1);
    step(world);
    expect(world.poolSwarms![0]).toBe(swarm);
    expect(swarm.memberIds).toHaveLength(QUARTER + 1);
    expect(world.random[RANDOM_STREAM.pool]).toEqual(createTestWorldInEras().random[RANDOM_STREAM.pool]);
  });

  it('eaten down to a quarter, respawns a full swarm from the pool stream and leaves its last specks lying', () => {
    const world = poolWorld();
    const swarm = addSwarm(world, { x: -1500, y: 0 });
    eatSpecks(world, swarm, pool.POOL_SWARM_SIZE - QUARTER);
    const lastSpecks = world.food.map((speck) => speck.id);
    step(world);
    const respawned = world.poolSwarms![0]!;
    expect(respawned).not.toBe(swarm);
    expect(respawned.memberIds).toHaveLength(pool.POOL_SWARM_SIZE);
    expect(respawned.memberIds.some((id) => lastSpecks.includes(id))).toBe(false);
    expect(world.food.map((speck) => speck.id)).toEqual(expect.arrayContaining(lastSpecks));
    expect(world.food).toHaveLength(QUARTER + pool.POOL_SWARM_SIZE);
  });

  it('respawns the same swarm for the same pool stream: deterministic', () => {
    const respawnOnce = () => {
      const world = poolWorld();
      eatSpecks(world, addSwarm(world, { x: -1500, y: 0 }), pool.POOL_SWARM_SIZE);
      step(world);
      return world.poolSwarms![0]!;
    };
    expect(respawnOnce()).toEqual(respawnOnce());
  });
});

describe('runPoolSwarms in a world the move has not run in', () => {
  it('does nothing and draws nothing', () => {
    const world = createTestWorld();
    const food = structuredClone(world.food);
    step(world);
    expect(world.poolSwarms).toBeNull();
    expect(world.food).toEqual(food);
    expect(world.random[RANDOM_STREAM.pool].position).toBe(0);
  });
});
