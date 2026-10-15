// The rock pool's main food (docs/game-design/phases.md §14.5.2): `POOL_SWARM_COUNT` swarms of `POOL_SWARM_SIZE` green
// specks, each spread within `POOL_SWARM_RADIUS` of its centre. A swarm drifts toward the light patch at
// `POOL_SWARM_SPEED` until its centre is inside it, its specks moving with it; one eaten down to a quarter respawns at a
// random point, its last specks left lying as loose food. Placement and respawn points come from the `pool` stream.
// The move places the swarms (§14.4.2 step 2) clear of the landing (step 7); step 8 runs them every tick after the
// mote motion, a no-op in every world the move has not run in.

import {
  FOOD_KIND,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  distanceBetween,
  lightPatchCentreAt,
  uniformPointInAnnulus,
  unitVectorToward,
  type BalanceConfig,
  type EntityId,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import type { FoodMoteRecord, PoolSwarmRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { spawnFoodMote } from './spawn-mote.js';
import { drawPointAround } from './spawn-point.js';
import { clampedToFoodBoundary, foodBoundaryRadius } from './zones.js';

/** A swarm eaten down to this share of `POOL_SWARM_SIZE` respawns (§14.5.2: "down to a quarter"). */
const SWARM_RESPAWN_SHARE = 0.25;
/** A respawned swarm may appear anywhere in the pool, its centre included. */
const ANYWHERE_INNER_RADIUS = 0;

/**
 * A swarm's centre, uniform by area from `innerRadius` out to the food boundary less the swarm's radius, so every speck
 * of it lies at least `innerRadius − POOL_SWARM_RADIUS` from the pool's centre and inside the food boundary.
 */
function drawSwarmCentre(random: RandomSource, innerRadius: number, balance: BalanceConfig): Vec2 {
  const outerRadius = foodBoundaryRadius(balance) - balance.pool.POOL_SWARM_RADIUS;
  return uniformPointInAnnulus(innerRadius, outerRadius, random.nextFloat(), random.nextFloat());
}

/** A new swarm: a centre, then up to `POOL_SWARM_SIZE` specks around it (a point inside a cell is redrawn, then skipped). */
function spawnSwarm(world: WorldState, random: RandomSource, innerRadius: number): PoolSwarmRecord {
  const { balance } = world;
  const centre = drawSwarmCentre(random, innerRadius, balance);
  const disc = { centre, radius: balance.pool.POOL_SWARM_RADIUS };
  const memberIds: EntityId[] = [];
  for (let member = 0; member < balance.pool.POOL_SWARM_SIZE; member += 1) {
    const point = drawPointAround(world, disc, random, balance.ecology.SPAWN_POINT_MAX_ATTEMPTS);
    if (point !== null) {
      memberIds.push(spawnFoodMote(world, { kind: FOOD_KIND.greenSpeck, variant: null, at: point }).id);
    }
  }
  return { centreX: centre.x, centreY: centre.y, memberIds };
}

/**
 * The move's swarms (§14.4.2 step 2), placed after the leftovers: `POOL_SWARM_COUNT` of them, every speck outside
 * `ERA_LANDING_CLEAR_RADIUS` (step 7: no swarm is placed inside the landing).
 */
export function placePoolSwarms(world: WorldState, random: RandomSource): void {
  const innerRadius = world.balance.eras.ERA_LANDING_CLEAR_RADIUS + world.balance.pool.POOL_SWARM_RADIUS;
  world.poolSwarms = Array.from({ length: world.balance.pool.POOL_SWARM_COUNT }, () =>
    spawnSwarm(world, random, innerRadius),
  );
}

/** Drops the eaten specks from every swarm, then replaces each swarm eaten down to a quarter, in swarm order. */
function respawnEatenSwarms(world: WorldState, swarms: PoolSwarmRecord[], random: RandomSource): void {
  const lying = new Set(world.food.map((mote) => mote.id));
  const respawnAtOrBelow = world.balance.pool.POOL_SWARM_SIZE * SWARM_RESPAWN_SHARE;
  for (const [index, swarm] of swarms.entries()) {
    swarm.memberIds = swarm.memberIds.filter((id) => lying.has(id));
    if (swarm.memberIds.length <= respawnAtOrBelow) {
      swarms[index] = spawnSwarm(world, random, ANYWHERE_INNER_RADIUS);
    }
  }
}

/** Moves a speck with its swarm, kept inside the food boundary. */
function carrySpeck(speck: FoodMoteRecord, offset: Vec2, balance: BalanceConfig): void {
  const moved = clampedToFoodBoundary({ x: speck.x + offset.x, y: speck.y + offset.y }, balance);
  speck.x = moved.x;
  speck.y = moved.y;
}

/** One tick of drift toward the patch's centre, stopping once the swarm's centre lies inside the patch. */
function driftSwarm(
  swarm: PoolSwarmRecord,
  patchCentre: Vec2,
  specks: ReadonlyMap<EntityId, FoodMoteRecord>,
  balance: BalanceConfig,
): void {
  const centre = { x: swarm.centreX, y: swarm.centreY };
  const outside = distanceBetween(centre, patchCentre) - balance.pool.POOL_LIGHT_PATCH_RADIUS;
  if (outside <= 0) return;
  const direction = unitVectorToward(centre, patchCentre);
  const stepWu = Math.min(balance.pool.POOL_SWARM_SPEED * TICK_INTERVAL_S, outside);
  const offset = { x: direction.x * stepWu, y: direction.y * stepWu };
  swarm.centreX += offset.x;
  swarm.centreY += offset.y;
  for (const id of swarm.memberIds) {
    const speck = specks.get(id);
    if (speck !== undefined) carrySpeck(speck, offset, balance);
  }
}

/** Step 8, after the mote motion: the swarms respawn where eaten, then drift toward the light patch on this tick. */
export function runPoolSwarms(world: WorldState, context: StepContext): void {
  const swarms = world.poolSwarms;
  if (swarms === null || world.poolLayout === null) return;
  respawnEatenSwarms(world, swarms, context.streams[RANDOM_STREAM.pool]);
  const patchCentre = lightPatchCentreAt(world.poolLayout.lightPatchOrbit, world.tick, context.balance);
  const specks = new Map(world.food.map((mote) => [mote.id, mote]));
  for (const swarm of swarms) {
    driftSwarm(swarm, patchCentre, specks, context.balance);
  }
}
