import { describe, expect, it } from 'vitest';
import { ScenarioDivergenceError } from './errors.js';
import { scenarioPlayerId } from './players.js';
import { assertDeterministic } from './replay.js';
import { toyAdapter, toyScenario, type ToySnapshot } from './toy-adapter.js';

const SEED = 42;
/** Each run's target sits this far past the previous run's, so every pair of runs differs by it. */
const TARGET_STEP_PER_RUN = 10;

/** A bot on player 1 whose one target depends on which run built it; `runsBuilt` counts the factory calls. */
function targetByRun(targetOfRun: (run: number) => number) {
  const counter = { runsBuilt: 0 };
  const definition = toyScenario('target by run')
    .seed(SEED)
    .players(2)
    .hashEvery(1)
    .bot(1, () => {
      counter.runsBuilt += 1;
      const targetX = targetOfRun(counter.runsBuilt);
      return { name: 'target-by-run', decide: () => ({ targetX, targetY: 0 }) };
    })
    .advance(3)
    .build();
  return { counter, definition };
}

describe('assertDeterministic on a divergence', () => {
  it('names the first differing path and both values when two runs differ in one cell target', async () => {
    const { counter, definition } = targetByRun((run) => SEED + run * TARGET_STEP_PER_RUN);
    const error = await assertDeterministic(definition, toyAdapter).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScenarioDivergenceError);
    const { divergence, snapshots, message } = error as ScenarioDivergenceError;
    // Both cells move one unit toward their targets, so x agrees and only the target differs.
    expect(divergence.tick).toBe(1);
    expect(counter.runsBuilt).toBe(4);
    expect(snapshots?.wasReproduced).toBe(true);
    expect(snapshots?.firstDifference).toEqual({ path: '$.cells.player_1.targetX', expected: 72, actual: 82 });
    expect((snapshots?.expectedSnapshot as ToySnapshot).tick).toBe(divergence.tick);
    expect((snapshots?.actualSnapshot as ToySnapshot).cells[scenarioPlayerId(1)]?.targetX).toBe(82);
    expect(message).toContain('first differing path at tick 1: $.cells.player_1.targetX\n    expected 72, got 82');
  });

  it('says so when the re-runs to the divergent tick agree', async () => {
    const { definition } = targetByRun((run) => (run === 2 ? SEED + 1 : SEED));
    const error = (await assertDeterministic(definition, toyAdapter).catch(
      (caught: unknown) => caught,
    )) as ScenarioDivergenceError;
    expect(error.snapshots).toMatchObject({ wasReproduced: false, firstDifference: null });
    expect(error.message).toContain('did not reproduce the divergence');
  });
});
