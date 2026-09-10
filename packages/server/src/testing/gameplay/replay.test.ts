import { describe, expect, it } from 'vitest';
import type { StateHash } from '@evolution/shared';
import { ScenarioDivergenceError } from './errors.js';
import { player, scenarioPlayerId } from './players.js';
import { indexByTick, type ReplayCheckpoint, type ScenarioReplay } from './replay-format.js';
import { assertDeterministic, findFirstDivergence, playersOfReplay, replayScenario, verifyReplay } from './replay.js';
import { targetPoint, type ScriptContext } from './scripts.js';
import { toyAdapter, toyScenario, type ToyFixture, type ToySnapshot } from './toy-adapter.js';

const SEED = 42;
const OTHER_SEED = 43;
const PATCH_TICK = 3;
/** Run plus replay of 24 000 inputs takes well under a second when the log is indexed once. */
const LINEAR_REPLAY_TIMEOUT_MS = 2000;

function recordedRun() {
  return toyScenario('recorded')
    .seed(SEED)
    .players(2)
    .playerJoinsAt(4)
    .playerLeavesAt(6, 1)
    .hashEvery(1)
    .atTick(2, player(0).does(targetPoint(SEED + 10, 0)))
    .atTick(PATCH_TICK)
    .place({ playerIndex: 0, at: { x: 0, y: 0 } })
    .atTick(5, player(2).does(targetPoint(0, 0)))
    .advance(8)
    .run();
}

function checkpoint(tick: number, hash: string): ReplayCheckpoint {
  return { tick, hash: hash as StateHash };
}

describe('replayScenario / verifyReplay', () => {
  it('reproduces every checkpoint and the final hash of a recording', () => {
    const run = recordedRun();
    const verdict = verifyReplay(run.replay, toyAdapter);
    expect(verdict.divergence).toBeNull();
    expect(verdict.finalHash).toBe(run.finalHash);
    expect(verdict.checkpoints).toEqual(run.checkpoints);
  });

  it('diverges from tick 0 when the recording is replayed on another seed', () => {
    const tampered: ScenarioReplay<ToyFixture> = { ...recordedRun().replay, seed: OTHER_SEED };
    const verdict = replayScenario(tampered, toyAdapter);
    expect(verdict.divergence?.tick).toBe(0);
    expect(verdict.divergence?.lastAgreedTick).toBeNull();
    expect(() => verifyReplay(tampered, toyAdapter)).toThrow(ScenarioDivergenceError);
    expect(() => verifyReplay(tampered, toyAdapter)).toThrow(
      /diverged \(seed 43\): first differing checkpoint at tick 0/,
    );
  });

  it('names the exact tick when an input is missing from the recording', () => {
    const replay = recordedRun().replay;
    const tampered: ScenarioReplay<ToyFixture> = {
      ...replay,
      inputs: replay.inputs.filter((input) => input.tick !== 2),
    };
    const verdict = replayScenario(tampered, toyAdapter);
    expect(verdict.divergence).toMatchObject({ tick: 2, lastAgreedTick: 1 });
  });

  it('replays scheduled fixtures and names the tick when a patch is missing', () => {
    const replay = recordedRun().replay;
    expect(replay.patches).toEqual([{ tick: PATCH_TICK, fixture: { playerIndex: 0, at: { x: 0, y: 0 } } }]);
    const tampered: ScenarioReplay<ToyFixture> = { ...replay, patches: [] };
    expect(replayScenario(tampered, toyAdapter).divergence).toMatchObject({
      tick: PATCH_TICK,
      lastAgreedTick: PATCH_TICK - 1,
    });
  });

  it('rebuilds the player list from the roster and the joins', () => {
    const players = playersOfReplay(recordedRun().replay);
    expect(players.map((member) => [member.playerIndex, member.playerId, member.joinTick])).toEqual([
      [0, scenarioPlayerId(0), 0],
      [1, scenarioPlayerId(1), 0],
      [2, scenarioPlayerId(2), 4],
    ]);
  });

  it(
    'replays a per-tick input log in time linear in the log (a per-step rescan took 3 s at this size)',
    { timeout: LINEAR_REPLAY_TIMEOUT_MS },
    () => {
      const ticks = 12_000;
      const run = toyScenario('per-tick inputs')
        .seed(SEED)
        .players(2)
        .from(1, player(0).does(targetPoint(0, 0)))
        .from(1, player(1).does(targetPoint(0, 0)))
        .advance(ticks)
        .run();
      expect(run.replay.inputs).toHaveLength(2 * ticks);
      expect(verifyReplay(run.replay, toyAdapter).divergence).toBeNull();
    },
  );
});

describe('indexByTick', () => {
  it('buckets events by tick in log order', () => {
    const indexed = indexByTick([
      { tick: 2, id: 'a' },
      { tick: 1, id: 'b' },
      { tick: 2, id: 'c' },
    ]);
    expect([...indexed.entries()]).toEqual([
      [
        2,
        [
          { tick: 2, id: 'a' },
          { tick: 2, id: 'c' },
        ],
      ],
      [1, [{ tick: 1, id: 'b' }]],
    ]);
    expect(indexed.get(3)).toBeUndefined();
  });
});

describe('findFirstDivergence', () => {
  it('returns null for equal checkpoint lists', () => {
    const checkpoints = [checkpoint(0, 'a'), checkpoint(5, 'b')];
    expect(findFirstDivergence(checkpoints, [...checkpoints])).toBeNull();
  });

  it('reports the first differing hash and the last agreed tick', () => {
    const expected = [checkpoint(0, 'a'), checkpoint(5, 'b'), checkpoint(10, 'c')];
    const actual = [checkpoint(0, 'a'), checkpoint(5, 'x'), checkpoint(10, 'c')];
    expect(findFirstDivergence(expected, actual)).toEqual({
      tick: 5,
      expectedHash: 'b',
      actualHash: 'x',
      lastAgreedTick: 0,
    });
  });

  it('treats a missing checkpoint on either side as a divergence', () => {
    expect(findFirstDivergence([checkpoint(0, 'a'), checkpoint(5, 'b')], [checkpoint(0, 'a')])).toEqual({
      tick: 5,
      expectedHash: 'b',
      actualHash: '(no checkpoint)',
      lastAgreedTick: 0,
    });
    expect(findFirstDivergence([], [checkpoint(0, 'a')])).toMatchObject({ tick: 0, expectedHash: '(no checkpoint)' });
  });
});

describe('assertDeterministic', () => {
  it('passes when two runs agree on every checkpoint', () => {
    const definition = toyScenario('stable').seed(SEED).players(1).hashEvery(1).advance(4).build();
    expect(assertDeterministic(definition, toyAdapter).replay.finalTick).toBe(4);
  });

  it('passes for a stateful strategy and one that draws from its own stream: each run starts fresh', () => {
    const huntWithMemory = () => {
      let lastTarget = 0;
      return {
        name: 'hunt-with-memory',
        decide: () => {
          lastTarget += 1;
          return { targetX: lastTarget, targetY: 0 };
        },
      };
    };
    const wander = () => ({
      name: 'wander',
      decide: (context: ScriptContext<ToySnapshot>) => ({
        targetX: context.random.nextInt(0, 100),
        targetY: 0,
      }),
    });
    const definition = toyScenario('stateful bots')
      .seed(SEED)
      .players(2)
      .hashEvery(1)
      .bot(0, huntWithMemory, 3)
      .bot(1, wander)
      .advance(30)
      .build();
    const run = assertDeterministic(definition, toyAdapter);
    expect(
      run.replay.inputs.filter((input) => input.playerId === scenarioPlayerId(0)).map((input) => input.input),
    ).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((target, index) => ({ targetX: target, targetY: 0, sequence: index + 1 })),
    );
  });

  it('throws at the first differing checkpoint when a script draws from outside the seed', () => {
    let callsAcrossRuns = 0;
    const definition = toyScenario('unseeded')
      .seed(SEED)
      .players(1)
      .hashEvery(1)
      .from(1, {
        playerIndex: 0,
        script: (): { targetX: number; targetY: number } => {
          callsAcrossRuns += 1;
          return { targetX: SEED + callsAcrossRuns, targetY: 0 };
        },
      })
      .advance(3)
      .build();
    expect(() => assertDeterministic(definition, toyAdapter)).toThrow(ScenarioDivergenceError);
  });

  it('throws for a strategy instance shared across runs through a factory that returns the same object', () => {
    let lastTarget = 0;
    const shared = { name: 'shared', decide: () => ({ targetX: (lastTarget += 1), targetY: 0 }) };
    const definition = toyScenario('shared instance')
      .seed(SEED)
      .players(1)
      .hashEvery(1)
      .bot(0, () => shared)
      .advance(3)
      .build();
    expect(() => assertDeterministic(definition, toyAdapter)).toThrow(ScenarioDivergenceError);
  });
});
