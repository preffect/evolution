import { describe, expect, it } from 'vitest';
import type { StateHash } from '@evolution/shared';
import { ScenarioDivergenceError } from './errors.js';
import type { ReplayCheckpoint, ScenarioReplay } from './replay-format.js';
import { assertDeterministic, findFirstDivergence, playersOfReplay, replayScenario, verifyReplay } from './replay.js';
import { player, scenarioPlayerId } from './scenario.js';
import { targetPoint } from './scripts.js';
import { toyAdapter, toyScenario, type ToyFixture } from './toy-adapter.js';

const SEED = 42;
const OTHER_SEED = 43;

function recordedRun() {
  return toyScenario('recorded')
    .seed(SEED)
    .players(2)
    .playerJoinsAt(4)
    .playerLeavesAt(6, 1)
    .hashEvery(1)
    .atTick(2, player(0).does(targetPoint(SEED + 10, 0)))
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

  it('rebuilds the player list from the roster and the joins', () => {
    const players = playersOfReplay(recordedRun().replay);
    expect(players.map((member) => [member.playerIndex, member.playerId, member.joinTick])).toEqual([
      [0, scenarioPlayerId(0), 0],
      [1, scenarioPlayerId(1), 0],
      [2, scenarioPlayerId(2), 4],
    ]);
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

  it('throws at the first differing checkpoint when a script draws from outside the seed', () => {
    let callsAcrossRuns = 0;
    const definition = toyScenario('unseeded')
      .seed(SEED)
      .players(1)
      .hashEvery(1)
      .from(1, {
        playerIndex: 0,
        script: () => {
          callsAcrossRuns += 1;
          return { targetX: SEED + callsAcrossRuns, targetY: 0 };
        },
      })
      .advance(3)
      .build();
    expect(() => assertDeterministic(definition, toyAdapter)).toThrow(ScenarioDivergenceError);
  });
});
