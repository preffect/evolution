// The proving scenarios (#75): the framework against the template's echo module before any
// rule exists. Two pass (inputs echo, late join; each hash-equal across two runs and replayable)
// and two fail on purpose to show what the failure output carries: the seed, the tick and the
// divergence. The real tables (E*, G*, P*, T*) arrive with #102 on the Evolution adapter.

import { describe, expect, it } from 'vitest';
import {
  ScenarioAssertionError,
  ScenarioDivergenceError,
  createMemoryReplaySink,
  createScenarioDsl,
  echoAdapter,
  echoScenario,
  echoedInput,
  player,
  targetPoint,
  verifyReplay,
  type EchoInput,
  type EchoSnapshot,
  type ScenarioView,
} from '../gameplay/index.js';

const SEED = 42;
const TICKS = 10;
const INPUT_TICK = 3;
const LATE_INPUT_TICK = 7;
const JOIN_TICK = 5;

function inputOf(playerIndex: number): (view: ScenarioView<EchoSnapshot>) => EchoInput | null {
  return (view) => echoedInput(view.snapshot, view.playerId(playerIndex));
}

function roster(view: ScenarioView<EchoSnapshot>): string[] {
  return Object.keys(view.snapshot.players);
}

describe('echo module scenarios', () => {
  it('echoes the latest input per player from the tick it was applied, identically across two runs', () => {
    const run = echoScenario('inputs echo')
      .seed(SEED)
      .players(2)
      .atTick(INPUT_TICK, player(0).does(targetPoint(10, 20)))
      .atTick(INPUT_TICK, player(1).does(targetPoint(1, 2)))
      .atTick(LATE_INPUT_TICK, player(1).does(targetPoint(3, 4)))
      .advance(TICKS)
      .expect('players start with no input', roster)
      .atTick(0)
      .toEqual(['player_0', 'player_1'])
      .expect('player 0 before the input', inputOf(0))
      .atTick(INPUT_TICK - 1)
      .toBeNull()
      .expect('player 0 echo', inputOf(0))
      .atTick(INPUT_TICK)
      .toEqual({ targetX: 10, targetY: 20, sequence: 1 })
      .expect('player 1 first echo', inputOf(1))
      .atTick(INPUT_TICK)
      .toEqual({ targetX: 1, targetY: 2, sequence: 1 })
      .expect('player 1 latest echo', inputOf(1))
      .atEnd()
      .toEqual({ targetX: 3, targetY: 4, sequence: 2 })
      .runDeterministic();
    expect(verifyReplay(run.replay, echoAdapter).finalHash).toBe(run.finalHash);
  });

  it('adds a late joiner before its step and echoes its input afterwards', () => {
    const run = echoScenario('late join')
      .seed(SEED)
      .players(2)
      .playerJoinsAt(JOIN_TICK)
      .atTick(LATE_INPUT_TICK, player(2).does(targetPoint(5, 5)))
      .advance(TICKS)
      .expect('roster before the join', roster)
      .atTick(JOIN_TICK - 1)
      .toEqual(['player_0', 'player_1'])
      .expect('roster after the join', roster)
      .atTick(JOIN_TICK)
      .toEqual(['player_0', 'player_1', 'player_2'])
      .expect('joiner has no input yet', inputOf(2))
      .atTick(JOIN_TICK)
      .toBeNull()
      .expect('joiner echo', inputOf(2))
      .atTick(LATE_INPUT_TICK)
      .toEqual({ targetX: 5, targetY: 5, sequence: 1 })
      .runDeterministic();
    expect(run.replay.membership).toEqual([
      { tick: JOIN_TICK, kind: 'join', playerId: 'player_2', playerName: 'Player 2', avatarIndex: 2 },
    ]);
    expect(verifyReplay(run.replay, echoAdapter).divergence).toBeNull();
  });
});

describe('echo module scenarios that fail on purpose', () => {
  it('reports the seed, the tick and the divergence when an expectation misses', () => {
    const sink = createMemoryReplaySink();
    const scenario = createScenarioDsl(echoAdapter, { replaySink: sink });
    const failing = scenario('wrong echo')
      .seed(SEED)
      .players(1)
      .atTick(INPUT_TICK, player(0).does(targetPoint(10, 20)))
      .advance(TICKS)
      .expect('player 0 echo', inputOf(0))
      .atTick(INPUT_TICK)
      .toEqual({ targetX: 99, targetY: 20, sequence: 1 });
    expect(() => failing.run()).toThrow(ScenarioAssertionError);
    expect(() => failing.run()).toThrow(
      'Scenario "wrong echo" failed (seed 42):\n' +
        '  at tick 3: player 0 echo\n' +
        '    expected {"targetX":99,"targetY":20,"sequence":1}, got {"targetX":10,"targetY":20,"sequence":1}',
    );
    expect(sink.replays).toHaveLength(2);
    expect(sink.replays[0]?.inputs).toEqual([
      { tick: INPUT_TICK, playerId: 'player_0', input: { targetX: 10, targetY: 20, sequence: 1 } },
    ]);
  });

  it('reports the first differing checkpoint when a script draws from outside the seed', () => {
    let callsAcrossRuns = 0;
    const diverging = echoScenario('unseeded script')
      .seed(SEED)
      .players(1)
      .hashEvery(1)
      .atTick(INPUT_TICK, {
        playerIndex: 0,
        script: () => {
          callsAcrossRuns += 1;
          return { targetX: callsAcrossRuns, targetY: 0 };
        },
      })
      .advance(TICKS);
    expect(() => diverging.runDeterministic()).toThrow(ScenarioDivergenceError);
    expect(() => diverging.runDeterministic()).toThrow(
      /Scenario "unseeded script" diverged \(seed 42\): first differing checkpoint at tick 3: expected [0-9a-f]{16}, got [0-9a-f]{16} \(identical through tick 2\)/,
    );
  });
});
