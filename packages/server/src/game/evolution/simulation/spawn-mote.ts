// The mote and fragment record factories (docs/ECOLOGY.md §1): one home for "what a mote of
// this kind is worth", shared by the spawners, the detritus drop, the debug `spawn` tool and the
// scenario fixtures. Stats come from `balance.ecology` by kind, never from a switch.

import {
  ENTITY_KIND,
  FOOD_KIND,
  pointOnCircle,
  RADIANS_PER_FULL_TURN,
  secondsToTicks,
  type BacteriumVariant,
  type BalanceConfig,
  type DnaTag,
  type FoodKind,
  type Vec2,
} from '@evolution/shared';
import type { DnaFragmentRecord, FoodMoteRecord } from '../world/entities.js';
import { mintEntityId } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';

export interface FoodKindStats {
  readonly mass: number;
  readonly dna: number;
}

/** Mass and DNA by kind (docs/ECOLOGY.md §1), read from the live balance. */
export function foodKindStats(kind: FoodKind, balance: BalanceConfig): FoodKindStats {
  const { ecology } = balance;
  const byKind: Record<FoodKind, FoodKindStats> = {
    [FOOD_KIND.algae]: { mass: ecology.ALGAE_MASS, dna: ecology.ALGAE_DNA },
    [FOOD_KIND.bacterium]: { mass: ecology.BACTERIUM_MASS, dna: ecology.BACTERIUM_DNA },
    [FOOD_KIND.detritus]: { mass: ecology.DETRITUS_MOTE_MASS, dna: 0 },
  };
  return byKind[kind];
}

export interface FoodMoteSpec {
  readonly kind: FoodKind;
  /** Required for a bacterium, ignored otherwise. */
  readonly variant: BacteriumVariant | null;
  readonly at: Vec2;
}

/** Appends a mote of `spec.kind` at `spec.at`; a bacterium carries its variant's tag, detritus its expiry. */
export function spawnFoodMote(world: WorldState, spec: FoodMoteSpec): FoodMoteRecord {
  const { ecology } = world.balance;
  const stats = foodKindStats(spec.kind, world.balance);
  const isBacterium = spec.kind === FOOD_KIND.bacterium;
  const variant = isBacterium ? spec.variant : null;
  const mote: FoodMoteRecord = {
    id: mintEntityId(world, ENTITY_KIND.foodMote),
    kind: spec.kind,
    bacteriumVariant: variant,
    x: spec.at.x,
    y: spec.at.y,
    mass: stats.mass,
    dna: stats.dna,
    tag: variant === null ? null : ecology.BACTERIUM_TAG_BY_VARIANT[variant],
    headingRadians: 0,
    expiresAtTick:
      spec.kind === FOOD_KIND.detritus ? world.tick + secondsToTicks(ecology.DETRITUS_LIFETIME_SECONDS) : null,
  };
  world.food.push(mote);
  return mote;
}

export interface DnaFragmentSpec {
  readonly at: Vec2;
  readonly tag: DnaTag;
  /** The drift direction as a turn fraction in [0, 1), drawn from the `moteMotion` stream at spawn. */
  readonly driftTurn: number;
}

export function spawnDnaFragment(world: WorldState, spec: DnaFragmentSpec): DnaFragmentRecord {
  const drift = pointOnCircle(world.balance.ecology.DNA_FRAGMENT_DRIFT_SPEED, spec.driftTurn * RADIANS_PER_FULL_TURN);
  const fragment: DnaFragmentRecord = {
    id: mintEntityId(world, ENTITY_KIND.dnaFragment),
    x: spec.at.x,
    y: spec.at.y,
    tag: spec.tag,
    driftX: drift.x,
    driftY: drift.y,
  };
  world.dnaFragments.push(fragment);
  return fragment;
}
