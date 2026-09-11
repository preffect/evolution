// The bench scene's DNA fragments: seeded rest points inside the dish with a slow oscillating
// drift, one tag each, so the tag-tinted rungs and halos all appear.

import {
  DNA_TAGS,
  FOOD_EDGE_MARGIN,
  RADIANS_PER_FULL_TURN,
  TICK_INTERVAL_S,
  entityId,
  type DnaFragmentView,
  type RandomSource,
} from '@evolution/shared';
import { RENDER_BENCH_MOTE_SPREAD_WU } from '../constants';

const HALF = 0.5;

export interface BenchFragmentSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly tagIndex: number;
  readonly phase: number;
}

export function benchFragmentSpec(index: number, random: RandomSource): BenchFragmentSpec {
  const angle = random.nextFloat() * RADIANS_PER_FULL_TURN;
  const distance = Math.sqrt(random.nextFloat()) * RENDER_BENCH_MOTE_SPREAD_WU;
  return {
    id: `bench-f-${index}`,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    tagIndex: random.nextInt(0, DNA_TAGS.length - 1),
    phase: random.nextFloat(),
  };
}

export function benchFragmentView(spec: BenchFragmentSpec, tick: number): DnaFragmentView {
  const timeSeconds = tick * TICK_INTERVAL_S;
  const drift = Math.sin(spec.phase * RADIANS_PER_FULL_TURN + timeSeconds * HALF);
  return {
    id: entityId(spec.id),
    x: spec.x + drift * FOOD_EDGE_MARGIN,
    y: spec.y + drift * FOOD_EDGE_MARGIN * HALF,
    tag: DNA_TAGS[spec.tagIndex] ?? DNA_TAGS[0]!,
  };
}
