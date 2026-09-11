// The bench scene's motes: kinds by the eukaryote-era shares, bacteria on a deterministic walk
// (a function of the tick, never a draw per snapshot), all inside the dish.

import {
  BACTERIUM_DRIFT_SPEED,
  BACTERIUM_VARIANTS,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  TICK_INTERVAL_S,
  entityId,
  type FoodKind,
  type FoodMoteView,
  type RandomSource,
} from '@evolution/shared';
import { RENDER_BENCH_MOTE_SPREAD_WU } from '../constants';

export interface BenchMoteSpec {
  readonly id: string;
  readonly kind: FoodKind;
  readonly variantIndex: number;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}

/** Algae : bacterium : detritus shares of the bench dish. */
const ALGAE_SHARE = 0.6;
const BACTERIUM_SHARE = 0.3;
const DETRITUS_SHARE = 0.1;
const BENCH_MOTE_KIND_WEIGHTS: readonly [FoodKind, number][] = [
  [FOOD_KIND.algae, ALGAE_SHARE],
  [FOOD_KIND.bacterium, BACTERIUM_SHARE],
  [FOOD_KIND.detritus, DETRITUS_SHARE],
];
/** A bacterium's walk turns through this many radians per second of bench time. */
const WALK_TURN_PER_SECOND = 0.7;

export function benchMoteSpecs(count: number, random: RandomSource): BenchMoteSpec[] {
  return Array.from({ length: count }, (_unused, index) => {
    const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
    const distance = Math.sqrt(random.nextFloat()) * RENDER_BENCH_MOTE_SPREAD_WU;
    const kindIndex = random.weightedIndex(BENCH_MOTE_KIND_WEIGHTS.map(([, weight]) => weight));
    return {
      id: `bench-m-${index}`,
      kind: BENCH_MOTE_KIND_WEIGHTS[kindIndex]?.[0] ?? FOOD_KIND.algae,
      variantIndex: random.nextInt(0, BACTERIUM_VARIANTS.length - 1),
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      phase: random.nextFloat(),
    };
  });
}

/** Every mote at `tick`; a bacterium wanders on a circle of its drift speed, the rest hold. */
export function benchMotesAt(specs: readonly BenchMoteSpec[], tick: number): FoodMoteView[] {
  const timeSeconds = tick * TICK_INTERVAL_S;
  const walkRadius = BACTERIUM_DRIFT_SPEED / WALK_TURN_PER_SECOND;
  return specs.map((spec) => {
    const isBacterium = spec.kind === FOOD_KIND.bacterium;
    const walk = spec.phase * RADIANS_PER_FULL_TURN + timeSeconds * WALK_TURN_PER_SECOND;
    return {
      id: entityId(spec.id),
      kind: spec.kind,
      bacteriumVariant: isBacterium ? (BACTERIUM_VARIANTS[spec.variantIndex] ?? null) : null,
      x: spec.x + (isBacterium ? Math.cos(walk) * walkRadius : 0),
      y: spec.y + (isBacterium ? Math.sin(walk) * walkRadius : 0),
    };
  });
}
