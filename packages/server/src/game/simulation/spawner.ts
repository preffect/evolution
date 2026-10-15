// The two spawners (docs/ecology/food-and-spawn.md §3): fractional accumulators, kind → zone → point, bacteria
// as clusters truncated to the room under the cap, and the initial fill that never skips. Every
// draw comes from the `spawner` stream except a fragment's drift direction (`moteMotion`). In the rock pool only the
// fragment spawner runs, at the dish's rates (docs/game-design/phases.md §14.5.2, tuning), its points uniform over the
// pool; the pool's food is its swarms (`pool-swarms.ts`).

import {
  BACTERIUM_VARIANTS,
  bacteriumVariantWeightsForZone,
  DNA_TAGS,
  ENTITY_KIND,
  FOOD_KIND,
  GAME_ERA,
  INITIAL_FILL_POINT_MAX_ATTEMPTS,
  RANDOM_STREAM,
  SPAWN_ACCUMULATOR_TOLERANCE,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
  type CellStage,
  type DnaTag,
  type FoodKindWeights,
  type RandomSource,
  type SpawnZoneId,
  type SpawnedKind,
  type Vec2,
  zoneAt,
} from '@evolution/shared';
import type { SpawnerState } from '../world/entities.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';
import { pickWeighted } from './pick-weighted.js';
import { drawPointAround, drawPointInPool, drawPointInZone } from './spawn-point.js';
import { fragmentSpawnerRates, foodSpawnerRates, spawnEventKindWeights, type SpawnerRates } from './spawn-rates.js';
import { worldReferenceAt } from './round-clock.js';
import { WHOLE_DISC_INNER_RADIUS, worldZoneMap } from './zones.js';

/** The zones a kind is drawn in, in one fixed order, with their weights (docs/ecology/food-and-spawn.md §3). */
const SPAWN_ZONE_ORDER: readonly SpawnZoneId[] = [ZONE_ID.sunlitShallows, ZONE_ID.warmVent, ZONE_ID.openBroth];

/** The two kinds a food event draws between, in one fixed order; `spawnEventKindWeights` weighs them. */
const SPAWN_EVENT_KINDS: readonly (keyof FoodKindWeights)[] = [FOOD_KIND.algae, FOOD_KIND.bacterium];

/** One zone for a spawned `kind`, drawn by its `FOOD_ZONE_WEIGHTS_BY_KIND` row. */
export function drawSpawnZone(kind: SpawnedKind, random: RandomSource, balance: BalanceConfig): SpawnZoneId {
  const weights = balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND[kind];
  return pickWeighted(random, SPAWN_ZONE_ORDER, (zone) => weights[zone]);
}

function drawTag(point: Vec2, world: WorldState, random: RandomSource): DnaTag {
  const table = world.balance.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE[zoneAt(point, worldZoneMap(world), world.balance)];
  return pickWeighted(random, DNA_TAGS, (tag) => table[tag] ?? 0);
}

/** What bounds a cluster: the room left under the cap and the point redraws per member. */
interface ClusterLimits {
  readonly room: number;
  readonly maxAttempts: number;
}

/** What a food event reads of the world clock: the stage that picks the kind row and the broth variant row (docs/ecology/food-and-spawn.md §3.2). */
interface FoodEventLimits extends ClusterLimits {
  readonly worldStage: CellStage;
}

/** A whole cluster of one variant around `centre`, truncated to the room; returns the members spawned. */
function spawnBacteriumCluster(world: WorldState, random: RandomSource, centre: Vec2, limits: FoodEventLimits): number {
  const { ecology } = world.balance;
  const zone = zoneAt(centre, worldZoneMap(world), world.balance);
  const variantWeights = bacteriumVariantWeightsForZone(zone, limits.worldStage, ecology);
  const variant = pickWeighted(random, BACTERIUM_VARIANTS, (name) => variantWeights[name]);
  const members = Math.min(ecology.BACTERIUM_CLUSTER_SIZE, limits.room);
  let spawned = 0;
  for (let member = 0; member < members; member += 1) {
    const disc = { centre, radius: ecology.BACTERIUM_CLUSTER_RADIUS };
    const point = drawPointAround(world, disc, random, limits.maxAttempts);
    if (point !== null) {
      spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant, at: point });
      spawned += 1;
    }
  }
  return spawned;
}

/** One food spawn event: kind, zone, point, then one algae or a cluster; the motes actually spawned. */
export function spawnFoodEvent(world: WorldState, random: RandomSource, limits: FoodEventLimits): number {
  const kindWeights = spawnEventKindWeights(world.balance, limits.worldStage);
  const kind = pickWeighted(random, SPAWN_EVENT_KINDS, (eventKind) => kindWeights[eventKind]);
  const point = drawPointInZone(world, drawSpawnZone(kind, random, world.balance), random, limits.maxAttempts);
  if (point === null) {
    return 0;
  }
  if (kind === FOOD_KIND.bacterium) {
    return spawnBacteriumCluster(world, random, point, limits);
  }
  spawnFoodMote(world, { kind, variant: null, at: point });
  return 1;
}

/** A fragment at `point` when one was found: the zone's tag, then a drift direction from `moteMotion`. */
function placeFragment(world: WorldState, context: StepContext, point: Vec2 | null): number {
  if (point === null) {
    return 0;
  }
  const tag = drawTag(point, world, context.streams[RANDOM_STREAM.spawner]);
  spawnDnaFragment(world, { at: point, tag, driftTurn: context.streams[RANDOM_STREAM.moteMotion].nextFloat() });
  return 1;
}

/** One fragment in the pool: a point beyond `innerRadius`, then as in the dish. */
function spawnPoolFragmentEvent(
  world: WorldState,
  context: StepContext,
  maxAttempts: number,
  innerRadius: number,
): number {
  const point = drawPointInPool(world, innerRadius, context.streams[RANDOM_STREAM.spawner], maxAttempts);
  return placeFragment(world, context, point);
}

/** One fragment: zone, point, the zone's tag, then a drift direction from `moteMotion`; in the pool, no zone draw. */
export function spawnFragmentEvent(world: WorldState, context: StepContext, maxAttempts: number): number {
  if (world.eraMovedInto !== GAME_ERA.dish) {
    return spawnPoolFragmentEvent(world, context, maxAttempts, WHOLE_DISC_INNER_RADIUS);
  }
  const random = context.streams[RANDOM_STREAM.spawner];
  const zone = drawSpawnZone(ENTITY_KIND.dnaFragment, random, world.balance);
  return placeFragment(world, context, drawPointInZone(world, zone, random, maxAttempts));
}

type SpawnEvent = (room: number) => number;

/** Accumulates the rate and spends whole units while the population is under the cap. */
function runSpawner(spawner: SpawnerState, rates: SpawnerRates, population: () => number, spawn: SpawnEvent): void {
  if (!spawner.isEnabled) {
    return;
  }
  spawner.accumulator += rates.ratePerSecond * TICK_INTERVAL_S;
  while (spawner.accumulator + SPAWN_ACCUMULATOR_TOLERANCE >= 1 && population() < rates.cap) {
    const spawned = spawn(rates.cap - population());
    spawner.accumulator -= Math.max(1, spawned);
    spawner.spawnedCount += spawned;
  }
}

/**
 * Every mote and fragment gone and both spawners off: what the pool's move does to the dish's food
 * (docs/game-design/phases.md §14.4.2 step 4) and what a placed scenario row starts from (docs/ecology/acceptance.md §8).
 */
export function clearFoodAndStopSpawners(world: WorldState): void {
  world.food = [];
  world.dnaFragments = [];
  world.spawners.food.isEnabled = false;
  world.spawners.dnaFragments.isEnabled = false;
}

/** Step 8: both spawners for one tick; the kind row is the current world stage's (docs/ecology/food-and-spawn.md §3.2). */
export function runSpawners(world: WorldState, context: StepContext): void {
  const maxAttempts = context.balance.ecology.SPAWN_POINT_MAX_ATTEMPTS;
  const { worldStage } = worldReferenceAt(world, world.tick);
  runSpawner(
    world.spawners.food,
    foodSpawnerRates(world, context.balance),
    () => world.food.length,
    (room) => spawnFoodEvent(world, context.streams[RANDOM_STREAM.spawner], { room, maxAttempts, worldStage }),
  );
  runSpawner(
    world.spawners.dnaFragments,
    fragmentSpawnerRates(world, context.balance),
    () => world.dnaFragments.length,
    () => spawnFragmentEvent(world, context, maxAttempts),
  );
}

/** What one initial fill runs: the target, the population it reads, the event and the spawner it credits. */
interface Fill {
  readonly count: number;
  readonly population: () => number;
  readonly spawn: SpawnEvent;
  readonly spawner: SpawnerState;
  /** The point-draw bound `spawn` runs under, named in the invariant when it is exhausted. */
  readonly maxAttempts: number;
}

/** Fills to `count` with the same draws as a live spawn, never skipping (docs/ecology/food-and-spawn.md §3). */
function fill({ count, population, spawn, spawner, maxAttempts }: Fill): void {
  while (population() < count) {
    const spawned = spawn(count - population());
    if (spawned === 0) {
      throw new SimulationInvariantError(`the initial fill found no spawnable point in ${maxAttempts} draws`);
    }
    spawner.spawnedCount += spawned;
  }
}

/** The initial fill, after player placement: `fillFraction × cap` motes and fragments. */
export function runInitialFill(world: WorldState, context: StepContext): void {
  const { ecology } = context.balance;
  const food = foodSpawnerRates(world, context.balance);
  const fragments = fragmentSpawnerRates(world, context.balance);
  const { worldStage } = worldReferenceAt(world, world.tick);
  const maxAttempts = INITIAL_FILL_POINT_MAX_ATTEMPTS;
  fill({
    count: Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * food.cap),
    population: () => world.food.length,
    spawn: (room) => spawnFoodEvent(world, context.streams[RANDOM_STREAM.spawner], { room, maxAttempts, worldStage }),
    spawner: world.spawners.food,
    maxAttempts,
  });
  fill({
    count: Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragments.cap),
    population: () => world.dnaFragments.length,
    spawn: () => spawnFragmentEvent(world, context, maxAttempts),
    spawner: world.spawners.dnaFragments,
    maxAttempts,
  });
}

/**
 * The pool's fragments at its move (docs/game-design/phases.md §14.4.2 step 2): the fragment spawner runs again, and
 * the fill tops it up to `DNA_FRAGMENT_INITIAL_FILL_FRACTION` of its cap, every fragment beyond `innerRadius` (the
 * landing, step 7).
 */
export function fillPoolFragments(world: WorldState, context: StepContext, innerRadius: number): void {
  const maxAttempts = INITIAL_FILL_POINT_MAX_ATTEMPTS;
  world.spawners.dnaFragments.isEnabled = true;
  fill({
    count: Math.floor(
      context.balance.ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragmentSpawnerRates(world, context.balance).cap,
    ),
    population: () => world.dnaFragments.length,
    spawn: () => spawnPoolFragmentEvent(world, context, maxAttempts, innerRadius),
    spawner: world.spawners.dnaFragments,
    maxAttempts,
  });
}
