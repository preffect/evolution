// The dive's bakes in slices (docs/rendering/opening-dive.md §4, the mockup's `pump` on its timer): a slice every
// interval on the injected scheduler until every baker is done, whatever the frame rate. The bakers go in order, so
// the planet's coastlines (on screen first) bake before the upper bands' tiles. A slice that finishes a bake calls
// `onBaked`, so a still view draws it.

import type { CancelDeferredCall, Scheduler } from '@evolution/shared';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_BAKE_START_DELAY_MS } from '../constants';

/** Something the dive bakes in slices: the planet's coastlines, the upper bands' tiles. */
export interface DiveBaker {
  /** Bakes for about `budgetMs`; `true` when a bake finished in it. */
  pumpBakes(budgetMs: number): boolean;
  readonly isBaked: boolean;
}

/** A queue of bakes stepped for a budget on a clock (the kelp's, the slime's), as the pump's baker. */
export function queueBaker(
  queue: { pump(budgetMs: number, nowMs: () => number): boolean; readonly isBaked: boolean },
  nowMs: () => number,
): DiveBaker {
  return {
    pumpBakes: (budgetMs) => queue.pump(budgetMs, nowMs),
    get isBaked() {
      return queue.isBaked;
    },
  };
}

export class DiveBakePump {
  private cancelSlice: CancelDeferredCall | null = null;

  constructor(private readonly bakers: readonly DiveBaker[]) {}

  /** Every baker done: the dive can fall through the bands without meeting a placeholder. */
  get isBaked(): boolean {
    return this.bakers.every((baker) => baker.isBaked);
  }

  start(scheduler: Scheduler, onBaked: () => void): void {
    const slice = (): void => {
      this.cancelSlice = null;
      const baker = this.bakers.find((candidate) => !candidate.isBaked);
      if (baker === undefined) return;
      if (baker.pumpBakes(DIVE_BAKE_BUDGET_MS)) onBaked();
      if (!this.isBaked) this.cancelSlice = scheduler.after(DIVE_BAKE_INTERVAL_MS, slice);
    };
    this.cancelSlice = scheduler.after(DIVE_BAKE_START_DELAY_MS, slice);
  }

  cancel(): void {
    this.cancelSlice?.();
    this.cancelSlice = null;
  }
}
