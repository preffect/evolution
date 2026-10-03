// A bake queue's pump (docs/rendering/opening-dive.md §4, ticket #801): steps for about a budget of milliseconds on the
// dive's clock, as the mockup's `pump` did, for the shore's tiles and its levels alike.

/**
 * What one step of a queue did: nothing left to do, a step taken, a step that finished a bake, or nothing to do here
 * while another thread bakes (`shore-bake-thread.ts`).
 */
export type PumpStep = 'idle' | 'stepped' | 'finished' | 'waiting';

/** What a level's bake yields while the worker has it: nothing to do on the page yet. */
export const SHORE_BAKE_WAITING = 'waiting';

/** A bake step: one taken (nothing), or `SHORE_BAKE_WAITING` while another thread bakes. */
export type ShoreBakeStep = void | typeof SHORE_BAKE_WAITING;

/** Steps until the budget is spent or the queue is idle; `true` when a step finished a bake. */
export function pumpFor(budgetMs: number, nowMs: () => number, step: () => PumpStep): boolean {
  const startedMs = nowMs();
  let hasFinished = false;
  while (nowMs() - startedMs < budgetMs) {
    const result = step();
    if (result === 'idle' || result === 'waiting') break;
    if (result === 'finished') hasFinished = true;
  }
  return hasFinished;
}

/** A queue of bakes stepped a few milliseconds at a time: the tiles and the levels both are one. */
export abstract class SteppedQueue {
  /** Bakes for about `budgetMs` on `nowMs`; `true` when a bake finished, so a still view draws once more. */
  pump(budgetMs: number, nowMs: () => number): boolean {
    return pumpFor(budgetMs, nowMs, () => this.step());
  }

  /** One step and no more: a worker's loop, which needs no budget since it never holds a frame up. */
  advance(): PumpStep {
    return this.step();
  }

  /** One step of the bake under way, starting the next one when none is. */
  protected abstract step(): PumpStep;
}
