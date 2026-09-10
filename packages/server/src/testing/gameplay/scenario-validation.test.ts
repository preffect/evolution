import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import { player } from './players.js';
import { idle } from './scripts.js';
import { toyScenario } from './toy-adapter.js';

const SEED = 42;
const TICKS = 5;
const PAST_END = TICKS + 1;
const PAST_END_MESSAGE = /ends at tick 5: nothing past the last advanced tick can run/;

function scenario(name: string) {
  return toyScenario(name).seed(SEED).players(2).advance(TICKS);
}

describe('build() refuses what could never run', () => {
  it('an expectation stamped past the last advanced tick', () => {
    const builder = scenario('late expectation')
      .expect('sprint inactive', () => 1)
      .atTick(PAST_END)
      .toBe(-999);
    expect(() => builder.build()).toThrow(ScenarioSetupError);
    expect(() => builder.build()).toThrow(/"sprint inactive" is stamped tick 6/);
    expect(() => builder.run()).toThrow(PAST_END_MESSAGE);
  });

  it('a capture stamped past the last advanced tick', () => {
    const builder = scenario('late capture')
      .capture('mass', () => 1)
      .atTick(PAST_END);
    expect(() => builder.build()).toThrow(/"mass" is stamped tick 6/);
  });

  it('a script window starting or ending past the last advanced tick', () => {
    expect(() => scenario('late script').atTick(PAST_END, player(0).does(idle)).build()).toThrow(
      /player 0's script starting is stamped tick 6/,
    );
    expect(() => scenario('long window').between(1, PAST_END, player(0).does(idle)).build()).toThrow(
      /player 0's script ending is stamped tick 6/,
    );
  });

  it('a join or a leave stamped past the last advanced tick', () => {
    expect(() => scenario('late join').playerJoinsAt(PAST_END).build()).toThrow(/player 2 joining is stamped tick 6/);
    expect(() => scenario('late leave').playerLeavesAt(PAST_END, 1).build()).toThrow(
      /player 1 leaving is stamped tick 6/,
    );
  });

  it('a fixture scheduled past the last advanced tick', () => {
    const builder = scenario('late fixture')
      .atTick(PAST_END)
      .place({ playerIndex: 0, at: { x: 0, y: 0 } });
    expect(() => builder.build()).toThrow(/a scheduled fixture is stamped tick 6/);
  });

  it('a script for a player who has not joined yet', () => {
    expect(() => scenario('pre-join').playerJoinsAt(3).atTick(2, player(2).does(idle)).build()).toThrow(
      /player 2's script starts at tick 2, before the player joins at tick 3/,
    );
    expect(() => scenario('pre-join stride').playerJoinsAt(3).every(2, player(2).does(idle)).build()).toThrow(
      ScenarioSetupError,
    );
  });

  it('a script for a player who has left', () => {
    expect(() => scenario('post-leave').playerLeavesAt(2, 1).atTick(4, player(1).does(idle)).build()).toThrow(
      /player 1's script starts at tick 4, but the player leaves at tick 2/,
    );
    expect(() => scenario('past leave').playerLeavesAt(3, 1).between(1, 4, player(1).does(idle)).build()).toThrow(
      /player 1's script ends at tick 4, after the player leaves at tick 3/,
    );
  });

  it('a scenario with nobody present at tick 0', () => {
    expect(() => toyScenario('empty').seed(SEED).playerJoinsAt(1).advance(1).build()).toThrow(
      /no player present at tick 0/,
    );
  });

  it('accepts everything stamped on the last tick, at the end, or exactly while the player is present', () => {
    const definition = scenario('edges')
      .playerJoinsAt(3)
      .playerLeavesAt(TICKS, 1)
      .atTick(TICKS, player(0).does(idle))
      .from(3, player(2).does(idle))
      .between(1, TICKS - 1, player(1).does(idle))
      .from(1, player(1).does(idle))
      .atTick(TICKS)
      .place({ playerIndex: 0, at: { x: 0, y: 0 } })
      .expect('x', () => 1)
      .atTick(TICKS)
      .toBe(1)
      .expect('end', () => 1)
      .atEnd()
      .toBe(1)
      .capture('c', () => 1)
      .atEnd()
      .build();
    expect(definition.totalTicks).toBe(TICKS);
  });
});
