// The bench scene's motes and DNA fragments (docs/RENDERING.md §7): motes by the eukaryote-era
// shares with the bacteria on a walk that is a function of the tick (never a draw per snapshot),
// fragments at seeded rest points with a slow oscillating drift, one tag each so every tag tint
// appears. Everything inside the dish, nothing from the clock.

import {
  BACTERIUM_DRIFT_SPEED,
  BACTERIUM_VARIANTS,
  DNA_TAGS,
  FOOD_EDGE_MARGIN,
  FOOD_KIND,
  RADIANS_PER_FULL_TURN,
  TICK_INTERVAL_S,
  entityId,
  type DnaFragmentView,
  type FoodKind,
  type FoodMoteView,
  type RandomSource,
} from '@evolution/shared';
import { RENDER_BENCH_MOTE_KIND_SHARES, RENDER_BENCH_MOTE_SPREAD_WU } from '../constants';
import { HALF } from '../geometry';

export interface BenchMoteSpec {
  readonly id: string;
  readonly kind: FoodKind;
  readonly variantIndex: number;
  readonly x: number;
  readonly y: number;
  readonly phase: number;
}

export interface BenchFragmentSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly tagIndex: number;
  readonly phase: number;
}

/** The kinds in a fixed order with their shares, for the weighted draw. */
const BENCH_MOTE_KINDS: readonly FoodKind[] = [FOOD_KIND.algae, FOOD_KIND.bacterium, FOOD_KIND.detritus];
const BENCH_MOTE_KIND_WEIGHTS = BENCH_MOTE_KINDS.map((kind) => RENDER_BENCH_MOTE_KIND_SHARES[kind]);
/** A bacterium's walk turns through this many radians per second of bench time. */
const WALK_TURN_PER_SECOND = 0.7;
/** A fragment's drift oscillates at this many radians per second. */
const FRAGMENT_DRIFT_PER_SECOND = 0.5;

/** A seeded point inside the spread disc, uniform by area. */
function scatterPoint(random: RandomSource): { x: number; y: number } {
  const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const distance = Math.sqrt(random.nextFloat()) * RENDER_BENCH_MOTE_SPREAD_WU;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

export function benchMoteSpecs(count: number, random: RandomSource): BenchMoteSpec[] {
  return Array.from({ length: count }, (_unused, index) => {
    const point = scatterPoint(random);
    const kindIndex = random.weightedIndex(BENCH_MOTE_KIND_WEIGHTS);
    return {
      id: `bench-m-${index}`,
      kind: BENCH_MOTE_KINDS[kindIndex] ?? FOOD_KIND.algae,
      variantIndex: random.nextInt(0, BACTERIUM_VARIANTS.length - 1),
      ...point,
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

export function benchFragmentSpecs(count: number, random: RandomSource): BenchFragmentSpec[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `bench-f-${index}`,
    ...scatterPoint(random),
    tagIndex: random.nextInt(0, DNA_TAGS.length - 1),
    phase: random.nextFloat(),
  }));
}

export function benchFragmentView(spec: BenchFragmentSpec, tick: number): DnaFragmentView {
  const drift = Math.sin(spec.phase * RADIANS_PER_FULL_TURN + tick * TICK_INTERVAL_S * FRAGMENT_DRIFT_PER_SECOND);
  return {
    id: entityId(spec.id),
    x: spec.x + drift * FOOD_EDGE_MARGIN,
    y: spec.y + drift * FOOD_EDGE_MARGIN * HALF,
    tag: DNA_TAGS[spec.tagIndex] ?? DNA_TAGS[0]!,
  };
}
