// Step 4 (docs/ECOLOGY.md §1): a mote or fragment is eaten the tick its centre lies within a
// cell's radius. Cells eat in array order, hits in id order (the spatial hash), and a mote eaten
// by an earlier cell is gone for the later ones. Mass arrives through `gainMass` (digestion
// bonus, cap overflow to DNA); DNA and tag points through the progression counters.

import { EFFECT_KIND, ENTITY_KIND, FOOD_KIND, SPATIAL_HASH_CELL_SIZE_WU, type EntityId } from '@evolution/shared';
import { gainDna, gainTagPoints } from '../progression/dna.js';
import type { CellRecord, DnaFragmentRecord, FoodMoteRecord, PlayerRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import { SpatialHash } from '../world/spatial-hash.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { gainMass } from './cell-mass.js';

interface Diner {
  readonly cell: CellRecord;
  readonly player: PlayerRecord;
}

/** What an `eat` effect names: the entity and which array it came from. */
interface Eaten {
  readonly entity: { readonly id: EntityId; readonly x: number; readonly y: number };
  readonly kind: typeof ENTITY_KIND.foodMote | typeof ENTITY_KIND.dnaFragment;
}

function pushEatEffect(world: WorldState, context: StepContext, diner: Diner, eaten: Eaten): void {
  context.effects.push({
    kind: EFFECT_KIND.eat,
    tick: world.tick,
    x: eaten.entity.x,
    y: eaten.entity.y,
    cellId: diner.cell.id,
    eatenId: eaten.entity.id,
    eatenKind: eaten.kind,
  });
}

export function eatFoodMote(diner: Diner, mote: FoodMoteRecord, world: WorldState, context: StepContext): void {
  const { cell, player } = diner;
  gainMass(cell, player, mote.mass * (1 + cell.modifiers.digestionFactorBonus), context.balance);
  gainDna(player, mote.dna, cell.modifiers.dnaGainMultiplier);
  if (mote.tag !== null) {
    gainTagPoints(player, mote.tag, 1);
  }
  if (mote.kind === FOOD_KIND.bacterium && mote.bacteriumVariant !== null) {
    player.bacteriaEatenByVariant[mote.bacteriumVariant] += 1;
  }
  pushEatEffect(world, context, diner, { entity: mote, kind: ENTITY_KIND.foodMote });
}

export function eatDnaFragment(
  diner: Diner,
  fragment: DnaFragmentRecord,
  world: WorldState,
  context: StepContext,
): void {
  const { cell, player } = diner;
  gainDna(player, context.balance.ecology.DNA_FRAGMENT_DNA, cell.modifiers.dnaGainMultiplier);
  gainTagPoints(player, fragment.tag, 1);
  pushEatEffect(world, context, diner, { entity: fragment, kind: ENTITY_KIND.dnaFragment });
}

export function eat(world: WorldState, context: StepContext): void {
  const foodHash = new SpatialHash<FoodMoteRecord>(SPATIAL_HASH_CELL_SIZE_WU);
  foodHash.insertAll(world.food);
  const fragmentHash = new SpatialHash<DnaFragmentRecord>(SPATIAL_HASH_CELL_SIZE_WU);
  fragmentHash.insertAll(world.dnaFragments);
  const eaten = new Set<EntityId>();
  for (const cell of world.cells) {
    const diner: Diner = { cell, player: requirePlayer(world, cell.playerId) };
    for (const mote of foodHash.queryCircle(cell.x, cell.y, cell.radius)) {
      if (!eaten.has(mote.id)) {
        eaten.add(mote.id);
        eatFoodMote(diner, mote, world, context);
      }
    }
    for (const fragment of fragmentHash.queryCircle(cell.x, cell.y, cell.radius)) {
      if (!eaten.has(fragment.id)) {
        eaten.add(fragment.id);
        eatDnaFragment(diner, fragment, world, context);
      }
    }
  }
  if (eaten.size > 0) {
    world.food = world.food.filter((mote) => !eaten.has(mote.id));
    world.dnaFragments = world.dnaFragments.filter((fragment) => !eaten.has(fragment.id));
  }
}
