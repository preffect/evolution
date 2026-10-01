// @vitest-environment node
// The dive's bakes in slices (docs/rendering/opening-dive.md §4): the mockup's `pump` on its timer, over every baker
// in order, so the planet's coastlines bake before the upper bands' tiles.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_BAKE_START_DELAY_MS } from '../constants';
import { DiveBakePump, type DiveBaker } from './dive-bake-pump';

/** A baker done after `slices` slices; the one at `landsAt` (counted from 1) finishes a bake. */
function countingBaker(name: string, slices: number, log: string[], landsAt = slices): DiveBaker {
  let done = 0;
  return {
    get isBaked() {
      return done === slices;
    },
    pumpBakes(budgetMs) {
      log.push(`${name}:${budgetMs}`);
      done += 1;
      return done === landsAt;
    },
  };
}

describe('DiveBakePump', () => {
  it('bakes as the mockup’s pump did: 8 ms slices every 10 ms from 60 ms, the bakers in order, until all are done', () => {
    const scheduler = new ManualScheduler();
    const log: string[] = [];
    const pump = new DiveBakePump([countingBaker('planet', 2, log, 1), countingBaker('tiles', 1, log)]);
    let landed = 0;
    pump.start(scheduler, () => (landed += 1));
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS - 1);
    expect(log).toEqual([]);
    scheduler.advanceMilliseconds(1);
    expect(log).toEqual([`planet:${DIVE_BAKE_BUDGET_MS}`]);
    for (let step = 0; step < 5; step += 1) scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
    expect(log).toEqual([
      `planet:${DIVE_BAKE_BUDGET_MS}`,
      `planet:${DIVE_BAKE_BUDGET_MS}`,
      `tiles:${DIVE_BAKE_BUDGET_MS}`,
    ]);
    expect(landed).toBe(2);
    expect(pump.isBaked).toBe(true);
    expect(scheduler.pendingCallCount).toBe(0);
  });

  it('is baked only once every baker is', () => {
    const log: string[] = [];
    expect(new DiveBakePump([countingBaker('planet', 0, log), countingBaker('tiles', 1, log)]).isBaked).toBe(false);
    expect(new DiveBakePump([countingBaker('planet', 0, log), countingBaker('tiles', 0, log)]).isBaked).toBe(true);
  });

  it('stops baking when the dive closes', () => {
    const scheduler = new ManualScheduler();
    const pump = new DiveBakePump([countingBaker('tiles', 3, [])]);
    pump.start(scheduler, () => undefined);
    pump.cancel();
    expect(scheduler.pendingCallCount).toBe(0);
  });
});
