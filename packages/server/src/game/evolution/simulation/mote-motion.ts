// Step 8, after the spawners (docs/ECOLOGY.md §1, docs/TRAITS.md §3.14): bacteria random-walk
// with a heading redrawn from the `moteMotion` stream every tick, fragments drift and reflect
// off the food boundary, detritus expires, and motes inside a cell's attract range drift toward
// its centre (the eyespot, seed-free). Motes never leave the food boundary.

import {
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  distanceBetween,
  unitVectorToward,
  type BalanceConfig,
  type Vec2,
} from '@evolution/shared';
import type { CellRecord, DnaFragmentRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';

interface Mobile extends Vec2 {
  x: number;
  y: number;
}

function foodBoundary(balance: BalanceConfig): number {
  return balance.world.DISH_RADIUS - balance.world.FOOD_EDGE_MARGIN;
}

/** Pulls a point back onto the food boundary circle when it has drifted past it. */
function clampToFoodBoundary(mote: Mobile, balance: BalanceConfig): boolean {
  const reach = foodBoundary(balance);
  const distance = Math.hypot(mote.x, mote.y);
  if (distance <= reach) {
    return false;
  }
  mote.x = (mote.x / distance) * reach;
  mote.y = (mote.y / distance) * reach;
  return true;
}

function walkBacteria(world: WorldState, context: StepContext): void {
  const random = context.streams[RANDOM_STREAM.moteMotion];
  const stepWu = context.balance.ecology.BACTERIUM_DRIFT_SPEED * TICK_INTERVAL_S;
  for (const mote of world.food) {
    if (mote.bacteriumVariant === null) {
      continue;
    }
    mote.headingRadians = random.nextFloat() * RADIANS_PER_FULL_TURN;
    mote.x += Math.cos(mote.headingRadians) * stepWu;
    mote.y += Math.sin(mote.headingRadians) * stepWu;
    clampToFoodBoundary(mote, context.balance);
  }
}

/** `v − 2 (v · n) n` mirrors a vector across the tangent: the outward component flips, the rest stays. */
const MIRROR_FACTOR = 2;

/** Reflects the drift radially at the boundary so a fragment keeps moving inside the dish. */
function driftFragment(fragment: DnaFragmentRecord, balance: BalanceConfig): void {
  fragment.x += fragment.driftX * TICK_INTERVAL_S;
  fragment.y += fragment.driftY * TICK_INTERVAL_S;
  if (clampToFoodBoundary(fragment, balance)) {
    const radial = unitVectorToward({ x: 0, y: 0 }, fragment);
    const outward = fragment.driftX * radial.x + fragment.driftY * radial.y;
    fragment.driftX -= MIRROR_FACTOR * outward * radial.x;
    fragment.driftY -= MIRROR_FACTOR * outward * radial.y;
  }
}

function expireDetritus(world: WorldState): void {
  const hasExpiry = world.food.some((mote) => mote.expiresAtTick !== null && mote.expiresAtTick <= world.tick);
  if (hasExpiry) {
    world.food = world.food.filter((mote) => mote.expiresAtTick === null || mote.expiresAtTick > world.tick);
  }
}

/** Motes and fragments whose centre is within `attractRangeInRadii × radius` drift toward the cell. */
function attractToward(cell: CellRecord, motes: readonly Mobile[]): void {
  const range = cell.modifiers.attractRangeInRadii * cell.radius;
  const stepWu = cell.modifiers.attractSpeed * TICK_INTERVAL_S;
  for (const mote of motes) {
    const distance = distanceBetween(mote, cell);
    if (distance > 0 && distance <= range) {
      const pull = Math.min(stepWu, distance);
      const direction = unitVectorToward(mote, cell);
      mote.x += direction.x * pull;
      mote.y += direction.y * pull;
    }
  }
}

function attractMotes(world: WorldState): void {
  for (const cell of world.cells) {
    if (cell.modifiers.attractRangeInRadii > 0 && cell.modifiers.attractSpeed > 0) {
      attractToward(cell, world.food);
      attractToward(cell, world.dnaFragments);
    }
  }
}

export function moveMotes(world: WorldState, context: StepContext): void {
  walkBacteria(world, context);
  for (const fragment of world.dnaFragments) {
    driftFragment(fragment, context.balance);
  }
  expireDetritus(world);
  attractMotes(world);
}
