// A bake queue's pump (docs/rendering/opening-dive.md §4, ticket #801): steps for about a budget of milliseconds on the
// dive's clock, as the mockup's `pump` did, for the shore's tiles and its levels alike.

/** What one step of a queue did: nothing left to do, a step taken, or a step that finished a bake. */
export type PumpStep = 'idle' | 'stepped' | 'finished';

/** Steps until the budget is spent or the queue is idle; `true` when a step finished a bake. */
export function pumpFor(budgetMs: number, nowMs: () => number, step: () => PumpStep): boolean {
  const startedMs = nowMs();
  let hasFinished = false;
  while (nowMs() - startedMs < budgetMs) {
    const result = step();
    if (result === 'idle') break;
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

  /** One step of the bake under way, starting the next one when none is. */
  protected abstract step(): PumpStep;
}
