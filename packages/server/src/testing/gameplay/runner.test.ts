import { describe, expect, it } from 'vitest';
import { createScriptedStrategy } from './bots.js';
import { ScenarioAssertionError } from './errors.js';
import type { ScenarioView } from './expectations.js';
import { createMemoryReplaySink } from './replay-sink.js';
import { createScenarioDsl, player, scenarioPlayerId } from './scenario.js';
import { targetPoint, targetRadiiEast } from './scripts.js';
import { toyAdapter, toyScenario, type ToySnapshot } from './toy-adapter.js';

const SEED = 42;
const TICKS = 5;

function xOf(playerIndex: number): (view: ScenarioView<ToySnapshot>) => number | undefined {
  return (view) => view.cell(playerIndex)?.x;
}

function presentPlayers(view: ScenarioView<ToySnapshot>): string[] {
  return Object.keys(view.snapshot.cells);
}

describe('runScenario', () => {
  it('sees the initial state at tick 0 and applies an input in the step it is stamped with', () => {
    toyScenario('input timing')
      .seed(SEED)
      .players(1)
      .atTick(3, player(0).does(targetPoint(SEED + 10, 0)))
      .advance(TICKS)
      .expect('x at tick 0', xOf(0))
      .atTick(0)
      .toBe(SEED)
      .expect('x before the input', xOf(0))
      .atTick(2)
      .toBe(SEED)
      .expect('x after the input step', xOf(0))
      .atTick(3)
      .toBe(SEED + 1)
      .expect('x at the end', xOf(0))
      .atEnd()
      .toBe(SEED + 3)
      .run();
  });

  it('re-evaluates "target N radii east" from the current centre every tick', () => {
    const run = toyScenario('radii east')
      .seed(SEED)
      .players(1)
      .from(1, player(0).does(targetRadiiEast(5)))
      .advance(10)
      .expect('x', xOf(0))
      .atEnd()
      .toBeCloseTo(SEED + 10, 1e-9)
      .run();
    expect(run.replay.inputs).toHaveLength(10);
    expect(run.replay.inputs[0]).toEqual({
      tick: 1,
      playerId: scenarioPlayerId(0),
      input: { targetX: SEED + 50, targetY: 0, sequence: 1 },
    });
    expect(run.replay.inputs.at(-1)?.input).toEqual({ targetX: SEED + 59, targetY: 0, sequence: 10 });
  });

  it('applies fixtures before tick 1', () => {
    toyScenario('fixture')
      .seed(SEED)
      .players(1)
      .place({ playerId: scenarioPlayerId(0), at: { x: 7, y: 7 } })
      .expect('x', xOf(0))
      .atTick(0)
      .toBe(7)
      .run();
  });

  it('adds a late joiner before its step and removes a leaver before its step', () => {
    toyScenario('membership')
      .seed(SEED)
      .players(1)
      .playerJoinsAt(3)
      .playerLeavesAt(5, 0)
      .advance(TICKS)
      .expect('players before the join', presentPlayers)
      .atTick(2)
      .toEqual(['player_0'])
      .expect('players after the join', presentPlayers)
      .atTick(3)
      .toEqual(['player_0', 'player_1'])
      .expect('players after the leave', presentPlayers)
      .atTick(5)
      .toEqual(['player_1'])
      .run();
  });

  it('records the join and the leave in the replay at the ticks they applied', () => {
    const run = toyScenario('membership log')
      .seed(SEED)
      .players(1)
      .playerJoinsAt(3)
      .playerLeavesAt(5, 0)
      .advance(TICKS)
      .run();
    expect(run.replay.membership.map((event) => [event.tick, event.kind, event.playerId])).toEqual([
      [3, 'join', 'player_1'],
      [5, 'leave', 'player_0'],
    ]);
    expect(run.replay.roster.map((member) => member.playerId)).toEqual(['player_0']);
  });

  it('checkpoints tick 0, every hashEvery ticks and the final tick', () => {
    const run = toyScenario('checkpoints').seed(SEED).players(1).hashEvery(2).advance(TICKS).run();
    expect(run.checkpoints.map((checkpoint) => checkpoint.tick)).toEqual([0, 2, 4, 5]);
    expect(run.finalHash).toBe(run.checkpoints.at(-1)?.hash);
    expect(run.replay.finalTick).toBe(TICKS);
  });

  it('asks a bot to decide on its stride only', () => {
    let decisions = 0;
    const strategy = createScriptedStrategy<ToySnapshot>('counting', () => {
      decisions += 1;
      return null;
    });
    toyScenario('bot stride').seed(SEED).players(1).bot(0, strategy, 2).advance(TICKS).run();
    expect(decisions).toBe(3);
  });

  it('reports every failed expectation with the seed, the tick and both values, and stores the replay', () => {
    const sink = createMemoryReplaySink();
    const scenario = createScenarioDsl(toyAdapter, { replaySink: sink });
    const failing = scenario('two misses')
      .seed(SEED)
      .players(1)
      .advance(TICKS)
      .expect('x', xOf(0))
      .atTick(2)
      .toBe(0)
      .expect('x close', xOf(0))
      .atEnd()
      .toBeCloseTo(0, 0.5)
      .expect('x holds', xOf(0))
      .atTick(1)
      .toBe(SEED);
    expect(() => failing.run()).toThrow(ScenarioAssertionError);
    try {
      failing.run();
    } catch (error) {
      const assertion = error as ScenarioAssertionError;
      expect(assertion.failures.map((failure) => failure.tick)).toEqual([2, TICKS]);
      expect(assertion.message).toContain('Scenario "two misses" failed (seed 42)');
      expect(assertion.message).toContain('at tick 2: x\n    expected 0, got 42');
      expect(assertion.message).toContain('expected 0 ± 0.5, got 42 (off by 42)');
    }
    expect(sink.replays).toHaveLength(2);
    expect(sink.replays[0]?.finalTick).toBe(TICKS);
  });
});
