// docs/ECOLOGY.md §8, the spawn-model rows on the seeded world (E1–E3, E14), each run twice and
// hash-compared (`runDeterministic`). The placed rows are ecology-cells.gameplay.test.ts; the
// engulf rows (E9–E11, E13, E16) wait for the engulf slice of #98 and the evolving-world rows
// (§8.1, W1–W10) for the wild-cell slice.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, FOOD_KIND, TICK_HZ, distanceBetween } from '@evolution/shared';
import { clearFood, resetSpawnerAccumulators } from '../gameplay/evolution-adapter.js';
import { cellOf, foodCount, fragmentCount, type EvolutionView } from '../gameplay/evolution-views.js';
import { seededSolo } from './shared-setups.js';

const { ecology, world: dish, session } = DEFAULT_BALANCE;
const ALGAE_SHARE_TOLERANCE = 0.06;
const SOLO_FOOD_CAP = ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER;
const SOLO_FRAGMENT_CAP = ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER;
/** E2 and E14 count over 610 ticks so that no count lands on the final tick. */
const COUNT_WINDOW_TICKS = 610;

function algaeShare(view: EvolutionView): number {
  const motes = view.snapshot.food.spawned;
  return motes.filter((mote) => mote.kind === FOOD_KIND.algae).length / motes.length;
}

function farthestMoteFromOrigin(view: EvolutionView): number {
  return Math.max(...view.snapshot.food.spawned.map((mote) => Math.hypot(mote.x, mote.y)));
}

function motesInsidePlayerCell(view: EvolutionView): number {
  const cell = cellOf(view, 0)!;
  return view.snapshot.food.spawned.filter((mote) => distanceBetween(mote, cell) <= cell.radius).length;
}

function foodSpawnedSince(label: string): (view: EvolutionView) => number {
  return (view) => view.snapshot.spawnedCounts.food - (view.captured(label) as number);
}

function fragmentsSpawnedSince(label: string): (view: EvolutionView) => number {
  return (view) => view.snapshot.spawnedCounts.dnaFragments - (view.captured(label) as number);
}

describe('ECOLOGY §8: the spawn model on the seeded world', () => {
  it('E1: the initial fill', () => {
    seededSolo('E1')
      .expect('food count', foodCount)
      .atTick(0)
      .toBe(Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * SOLO_FOOD_CAP))
      .expect('fragment count', fragmentCount)
      .atTick(0)
      .toBe(Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * SOLO_FRAGMENT_CAP))
      .expect('every mote inside the edge margin', farthestMoteFromOrigin)
      .atTick(0)
      .toBeAtMost(dish.DISH_RADIUS - dish.FOOD_EDGE_MARGIN)
      .expect('algae share', algaeShare)
      .atTick(0)
      .toBeBetween(
        ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.protocell.algae - ALGAE_SHARE_TOLERANCE,
        ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.protocell.algae + ALGAE_SHARE_TOLERANCE,
      )
      .expect('no mote inside the player cell', motesInsidePlayerCell)
      .atTick(0)
      .toBe(0)
      .runDeterministic();
  });

  it('E2: spawns counted over 610 ticks', () => {
    seededSolo('E2')
      .advance(COUNT_WINDOW_TICKS)
      .capture('food at start', (view) => view.snapshot.spawnedCounts.food)
      .atTick(0)
      .capture('fragments at start', (view) => view.snapshot.spawnedCounts.dnaFragments)
      .atTick(0)
      .expect('food spawned', foodSpawnedSince('food at start'))
      .atEnd()
      .toBeBetween(71, 75)
      .expect('fragments spawned', fragmentsSpawnedSince('fragments at start'))
      .atEnd()
      .toBe(4)
      .runDeterministic();
  });

  it('E3: both populations sit at the cap after 3000 ticks', () => {
    seededSolo('E3')
      .advance(3000)
      .expect('food count', foodCount)
      .atEnd()
      .toBeBetween(SOLO_FOOD_CAP - 1, SOLO_FOOD_CAP + 1)
      .expect('fragment count', fragmentCount)
      .atEnd()
      .toBeBetween(SOLO_FRAGMENT_CAP - 1, SOLO_FRAGMENT_CAP + 1)
      .runDeterministic();
  });

  it('E14: the bloom multiplies the rates over a 610-tick window with the populations held at 0', () => {
    const bloomStart = session.ROUND_BLOOM_START_FRACTION * session.ROUND_DURATION_SECONDS * TICK_HZ;
    const run = seededSolo('E14')
      .advance(bloomStart + COUNT_WINDOW_TICKS)
      .atTick(bloomStart + 1)
      .place(resetSpawnerAccumulators);
    for (let tick = bloomStart + 1; tick <= bloomStart + COUNT_WINDOW_TICKS; tick += 1) {
      run.atTick(tick).place(clearFood);
    }
    run
      .capture('food at window start', (view) => view.snapshot.spawnedCounts.food)
      .atTick(bloomStart)
      .capture('fragments at window start', (view) => view.snapshot.spawnedCounts.dnaFragments)
      .atTick(bloomStart)
      .expect('food spawned in the window', foodSpawnedSince('food at window start'))
      .atEnd()
      .toBeBetween(106, 110)
      .expect('fragments spawned in the window', fragmentsSpawnedSince('fragments at window start'))
      .atEnd()
      .toBe(8)
      .runDeterministic();
  });
});
