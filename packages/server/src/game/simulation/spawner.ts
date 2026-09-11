// The two spawners (docs/ECOLOGY.md §3): fractional accumulators, kind → zone → point, bacteria
// as clusters truncated to the room under the cap, and the initial fill that never skips. Every
// draw comes from the `spawner` stream except a fragment's drift direction (`moteMotion`).

import {
  BACTERIUM_VARIANTS,
  bacteriumVariantWeightsForZone,
  DNA_TAGS,
  ENTITY_KIND,
  FOOD_KIND,
  INITIAL_FILL_POINT_MAX_ATTEMPTS,
  RANDOM_STREAM,
  SPAWN_ACCUMULATOR_TOLERANCE,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
  type CellStage,
  type DnaTag,
  type RandomSource,
  type SpawnZoneId,
  type SpawnedKind,
  type Vec2,
} from '@evolution/shared';
import type { SpawnerState } from '../world/entities.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';
import { pickWeighted } from './pick-weighted.js';
import { drawPointAround, drawPointInZone } from './spawn-point.js';
import { fragmentSpawnerRates, foodSpawnerRates, spawnEventKindWeights, type SpawnerRates } from './spawn-rates.js';
import { worldReferenceAt } from './round-clock.js';
import { zoneAt } from './zones.js';

/** The zones a kind is drawn in, in one fixed order, with their weights (docs/ECOLOGY.md §3). */
const SPAWN_ZONE_ORDER: readonly SpawnZoneId[] = [ZONE_ID.sunlitShallows, ZONE_ID.warmVent, ZONE_ID.openBroth];

/** Index 0 is algae, index 1 a bacterium cluster, the order `spawnEventKindWeights` answers in. */
const SPAWN_EVENT_KINDS = [FOOD_KIND.algae, FOOD_KIND.bacterium] as const;

function drawZone(kind: SpawnedKind, random: RandomSource, balance: BalanceConfig): SpawnZoneId {
  const weights = balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND[kind];
  return pickWeighted(random, SPAWN_ZONE_ORDER, (zone) => weights[zone]);
}

function drawTag(point: Vec2, world: WorldState, random: RandomSource): DnaTag {
  const table = world.balance.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE[zoneAt(point, world.gelPatches, world.balance)];
  return pickWeighted(random, DNA_TAGS, (tag) => table[tag] ?? 0);
}

/** What bounds a cluster: the room left under the cap and the point redraws per member. */
interface ClusterLimits {
  readonly room: number;
  readonly maxAttempts: number;
}

/** What a food event reads of the world clock: the stage that picks the kind row and the broth variant row (docs/ECOLOGY.md §3.2). */
interface FoodEventLimits extends ClusterLimits {
  readonly worldStage: CellStage;
}

/** A whole cluster of one variant around `centre`, truncated to the room; returns the members spawned. */
function spawnBacteriumCluster(world: WorldState, random: RandomSource, centre: Vec2, limits: FoodEventLimits): number {
  const { ecology } = world.balance;
  const zone = zoneAt(centre, world.gelPatches, world.balance);
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
  const kind = pickWeighted(
    random,
    SPAWN_EVENT_KINDS,
    (eventKind) => kindWeights[SPAWN_EVENT_KINDS.indexOf(eventKind)] ?? 0,
  );
  const point = drawPointInZone(world, drawZone(kind, random, world.balance), random, limits.maxAttempts);
  if (point === null) {
    return 0;
  }
  if (kind === FOOD_KIND.bacterium) {
    return spawnBacteriumCluster(world, random, point, limits);
  }
  spawnFoodMote(world, { kind, variant: null, at: point });
  return 1;
}

/** One fragment: zone, point, the zone's tag, then a drift direction from `moteMotion`. */
export function spawnFragmentEvent(world: WorldState, context: StepContext, maxAttempts: number): number {
  const random = context.streams[RANDOM_STREAM.spawner];
  const point = drawPointInZone(world, drawZone(ENTITY_KIND.dnaFragment, random, world.balance), random, maxAttempts);
  if (point === null) {
    return 0;
  }
  const tag = drawTag(point, world, random);
  spawnDnaFragment(world, { at: point, tag, driftTurn: context.streams[RANDOM_STREAM.moteMotion].nextFloat() });
  return 1;
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

/** Step 8: both spawners for one tick; the kind row is the current world stage's (docs/ECOLOGY.md §3.2). */
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

/** Fills to `count` with the same draws as a live spawn, never skipping (docs/ECOLOGY.md §3). */
function fill(count: number, population: () => number, spawn: SpawnEvent, spawner: SpawnerState): void {
  while (population() < count) {
    const spawned = spawn(count - population());
    if (spawned === 0) {
      throw new SimulationInvariantError(
        `the initial fill found no spawnable point in ${INITIAL_FILL_POINT_MAX_ATTEMPTS} draws`,
      );
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
  fill(
    Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * food.cap),
    () => world.food.length,
    (room) =>
      spawnFoodEvent(world, context.streams[RANDOM_STREAM.spawner], {
        room,
        maxAttempts: INITIAL_FILL_POINT_MAX_ATTEMPTS,
        worldStage,
      }),
    world.spawners.food,
  );
  fill(
    Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragments.cap),
    () => world.dnaFragments.length,
    () => spawnFragmentEvent(world, context, INITIAL_FILL_POINT_MAX_ATTEMPTS),
    world.spawners.dnaFragments,
  );
}
