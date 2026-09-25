// docs/ecology/acceptance.md §8, the spawn-model rows on the seeded world (E1–E3, E14), each run twice and
// hash-compared (`runDeterministic`). The placed rows are ecology-cells.gameplay.test.ts, the engulf rows
// ecology-engulf*.gameplay.test.ts and the evolving-world rows (§8.1, W2–W10) ecology-wild*.gameplay.test.ts.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, FOOD_KIND, TICK_HZ, distanceBetween } from '@evolution/shared';
import { cellOf, foodCount, fragmentCount, type EvolutionView } from '../gameplay/evolution-views.js';
import { withoutWildSeats } from '../gameplay/evolution-adapter.js';
import { player } from '../gameplay/index.js';
import { foodSpawnedSince, holdPopulationsAtZero, seededSolo } from './shared-setups.js';
import { RUNS_PER_ROW, countWindow, createWindowCounts } from './wild-setups.js';

const { ecology, world: dish, session } = DEFAULT_BALANCE;
const ALGAE_SHARE_TOLERANCE = 0.06;
const SOLO_FOOD_CAP = ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER;
const SOLO_FRAGMENT_CAP = ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER;
/** E2 and E14 count over 610 ticks so that no count lands on the final tick. */
const COUNT_WINDOW_TICKS = 610;
/**
 * E14 on the pinned seed: since #677 (every cell at the top speed) a wild cell eats the idle player once in the window
 * (tick 29 023), and its 182-tick spectate takes the per-player rates off the budget:
 * food 106.75 − 182 / 60 × 1 × 1.5 = 102.2 → "between 102 and 106" (106–110 with no death, before #677); fragments
 * 8.13 − 182 / 60 × 0.1 × 2 = 7.53 → 7 (8 before).
 */
const E14_DEATHS_IN_WINDOW = 1;
const E14_SPAWNED_LOW = 102;
const E14_SPAWNED_HIGH = 106;
const E14_FRAGMENTS_SPAWNED = 7;

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

function fragmentsSpawnedSince(label: string): (view: EvolutionView) => number {
  return (view) => view.snapshot.spawnedCounts.dnaFragments - (view.captured(label) as number);
}

describe('ecology/acceptance.md §8: the spawn model on the seeded world', () => {
  it('E1: the initial fill', async () => {
    await seededSolo('E1')
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

  it('E2: spawns counted over 610 ticks', async () => {
    await seededSolo('E2')
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

  it('E3: both populations sit at the cap after 3000 ticks (the spawner alone: no wild seats)', async () => {
    // The wild cells graze since #551 and hold the food at 446 of 700 on this seed; E3 is a spawner row, so it
    // removes the seats at tick 0 (docs/ecology/acceptance.md §8 E3), and the grazing cost is the playtest's to judge.
    await seededSolo('E3')
      .place(withoutWildSeats)
      .advance(3000)
      .expect('food count', foodCount)
      .atEnd()
      .toBeBetween(SOLO_FOOD_CAP - 1, SOLO_FOOD_CAP + 1)
      .expect('fragment count', fragmentCount)
      .atEnd()
      .toBeBetween(SOLO_FRAGMENT_CAP - 1, SOLO_FRAGMENT_CAP + 1)
      .runDeterministic();
  });

  it('E14: the bloom multiplies the rates over a 610-tick window with the populations held at 0', async () => {
    const bloomStart = session.ROUND_BLOOM_START_FRACTION * session.ROUND_DURATION_SECONDS * TICK_HZ;
    const windowEnd = bloomStart + COUNT_WINDOW_TICKS;
    // One tick past the window, as `heldWindow` runs: the counting script sees the previous tick's effects.
    const run = seededSolo('E14').advance(windowEnd + 1);
    const counts = createWindowCounts();
    holdPopulationsAtZero(run, bloomStart + 1, windowEnd).between(
      bloomStart + 2,
      windowEnd + 1,
      player(0).does(countWindow(counts)),
    );
    await run
      .capture('food at window start', (view) => view.snapshot.spawnedCounts.food)
      .atTick(bloomStart)
      .capture('fragments at window start', (view) => view.snapshot.spawnedCounts.dnaFragments)
      .atTick(bloomStart)
      .expect('food spawned in the window', foodSpawnedSince('food at window start'))
      .atTick(windowEnd)
      .toBeBetween(E14_SPAWNED_LOW, E14_SPAWNED_HIGH)
      .expect('fragments spawned in the window', fragmentsSpawnedSince('fragments at window start'))
      .atTick(windowEnd)
      .toBe(E14_FRAGMENTS_SPAWNED)
      .runDeterministic();
    expect(counts.deaths).toBe(RUNS_PER_ROW * E14_DEATHS_IN_WINDOW);
  });
});
