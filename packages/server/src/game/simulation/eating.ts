// Step 4 (docs/ecology/food-and-spawn.md §1): a mote or fragment is eaten the tick its centre lies within a
// cell's radius. Cells eat in array order, hits in id order (the spatial hash), and a mote eaten
// by an earlier cell is gone for the later ones; wild cells are skipped. Mass arrives through `gainMass` (digestion
// bonus, cap overflow to DNA); DNA and tag points through the progression counters. The `eat` effect carries the mass and DNA
// the meal added, measured around the gains (#383).

import { EFFECT_KIND, ENTITY_KIND, FOOD_KIND, SPATIAL_HASH_CELL_SIZE_WU, type EntityId } from '@evolution/shared';
import { gainDna, gainTagPoints } from '../progression/dna.js';
import {
  isPlayerCell,
  type DnaFragmentRecord,
  type FoodMoteRecord,
  type PlayerCellRecord,
  type PlayerRecord,
} from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import { SpatialHash } from '../world/spatial-hash.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { gainMass, measureGain, type MeasuredGain } from './cell-mass.js';

interface Diner {
  readonly cell: PlayerCellRecord;
  readonly player: PlayerRecord;
}

/** What an `eat` effect names: the entity and which array it came from. */
interface Eaten {
  readonly entity: { readonly id: EntityId; readonly x: number; readonly y: number };
  readonly kind: typeof ENTITY_KIND.foodMote | typeof ENTITY_KIND.dnaFragment;
  /** What the meal added, measured around the gains (#383). */
  readonly gain: MeasuredGain;
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
    massGained: eaten.gain.massGained,
    dnaGained: eaten.gain.dnaGained,
  });
}

export function eatFoodMote(diner: Diner, mote: FoodMoteRecord, world: WorldState, context: StepContext): void {
  const { cell, player } = diner;
  const gain = measureGain(cell, player, () => {
    gainMass(cell, player, mote.mass * (1 + cell.modifiers.digestionFactorBonus), context.balance);
    gainDna(player, mote.dna, cell.modifiers.dnaGainMultiplier);
  });
  if (mote.tag !== null) {
    gainTagPoints(player, mote.tag, context.balance.ecology.FOOD_TAG_POINTS);
  }
  if (mote.kind === FOOD_KIND.bacterium && mote.bacteriumVariant !== null) {
    player.bacteriaEatenByVariant[mote.bacteriumVariant] += 1;
  }
  pushEatEffect(world, context, diner, { entity: mote, kind: ENTITY_KIND.foodMote, gain });
}

export function eatDnaFragment(
  diner: Diner,
  fragment: DnaFragmentRecord,
  world: WorldState,
  context: StepContext,
): void {
  const { cell, player } = diner;
  const gain = measureGain(cell, player, () =>
    gainDna(player, context.balance.ecology.DNA_FRAGMENT_DNA, cell.modifiers.dnaGainMultiplier),
  );
  gainTagPoints(player, fragment.tag, context.balance.ecology.FOOD_TAG_POINTS);
  pushEatEffect(world, context, diner, { entity: fragment, kind: ENTITY_KIND.dnaFragment, gain });
}

export function eat(world: WorldState, context: StepContext): void {
  const foodHash = new SpatialHash<FoodMoteRecord>(SPATIAL_HASH_CELL_SIZE_WU);
  foodHash.insertAll(world.food);
  const fragmentHash = new SpatialHash<DnaFragmentRecord>(SPATIAL_HASH_CELL_SIZE_WU);
  fragmentHash.insertAll(world.dnaFragments);
  const eaten = new Set<EntityId>();
  for (const cell of world.cells) {
    if (!isPlayerCell(cell)) {
      continue; // a wild cell never eats (docs/ecology/wild-cells.md §3.3)
    }
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
