import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS_PER_GAME, createTestSessionConfig, type StateHash } from '@evolution/shared';
import { NO_WORLD_PERCEPTION } from '../../game/bots/perception.js';
import type { ScenarioAdapter } from './adapter.js';
import { createScriptedStrategy } from './bots.js';
import { ScenarioSetupError } from './errors.js';
import { AT_END } from './expectations.js';
import { PLACED_KIND, type PlacedFixture } from './fixtures.js';
import { eastOfCellOf, insideCellOf, ZONE } from './placement.js';
import { player, scenarioPlayerId } from './players.js';
import { createScenarioDsl, DEFAULT_HASH_EVERY_TICKS } from './scenario.js';
import { idle, targetPoint } from './scripts.js';
import { toyScenario } from './toy-adapter.js';

/** An adapter whose fixtures are the design's placed entities, for the placement builders. */
const placingAdapter: ScenarioAdapter<unknown, unknown, PlacedFixture> = {
  name: 'placing',
  perception: NO_WORLD_PERCEPTION,
  createModule: () => {
    throw new Error('never run');
  },
  readSnapshot: () => null,
  hashState: () => '0' as StateHash,
  toInput: (playerCommand) => playerCommand,
  locateCell: () => undefined,
  applyFixture: () => {},
};
const placingScenario = createScenarioDsl(placingAdapter);

describe('scenario builder', () => {
  it('requires a seed', () => {
    expect(() => toyScenario('no seed').players(1).build()).toThrow(ScenarioSetupError);
    expect(() => toyScenario('no seed').players(1).build()).toThrow(/no seed/);
  });

  it('builds the definition with defaults: room-max players, 600-tick checkpoints, zero ticks', () => {
    const definition = toyScenario('defaults').seed(42).players(2).build();
    expect(definition).toMatchObject({
      name: 'defaults',
      config: createTestSessionConfig({ maxPlayers: MAX_PLAYERS_PER_GAME, seed: 42 }),
      totalTicks: 0,
      hashEveryTicks: DEFAULT_HASH_EVERY_TICKS,
      fixtures: [],
      scheduledFixtures: [],
      scripts: [],
      captures: [],
      expectations: [],
    });
  });

  it('numbers players, ids and names by index and stamps joins and leaves', () => {
    const { players } = toyScenario('roster')
      .seed(42)
      .players(2)
      .playerJoinsAt(10)
      .playerLeavesAt(20, 1)
      .advance(20)
      .build();
    expect(players.map((member) => [member.playerId, member.playerName, member.joinTick, member.leaveTick])).toEqual([
      [scenarioPlayerId(0), 'Player 0', 0, null],
      [scenarioPlayerId(1), 'Player 1', 0, 20],
      [scenarioPlayerId(2), 'Player 2', 10, null],
    ]);
    expect(players.map((member) => member.avatarIndex)).toEqual([0, 1, 2]);
  });

  it('merges config overrides and accumulates advance()', () => {
    const definition = toyScenario('config')
      .seed(42)
      .players(1)
      .config({ maxPlayers: 2 })
      .advance(10)
      .advance(5)
      .build();
    expect(definition.config).toEqual(createTestSessionConfig({ maxPlayers: 2, seed: 42 }));
    expect(definition.totalTicks).toBe(15);
  });

  it('turns atTick, from, between, every and bot into schedule windows', () => {
    const strategy = createScriptedStrategy('idle', idle);
    const { scripts } = toyScenario('schedule')
      .seed(42)
      .players(2)
      .playerJoinsAt(4)
      .atTick(3, player(0).does(idle))
      .from(10, player(1).does(idle))
      .between(20, 30, player(0).does(idle))
      .every(30, player(1).does(idle), 7)
      .bot(0, strategy, 5)
      .bot(2, strategy)
      .advance(30)
      .build();
    expect(
      scripts.map(({ playerIndex, fromTick, toTick, everyTicks }) => [playerIndex, fromTick, toTick, everyTicks]),
    ).toEqual([
      [0, 3, 3, 1],
      [1, 10, null, 1],
      [0, 20, 30, 1],
      [1, 7, null, 30],
      [0, 1, null, 5],
      [2, 4, null, 1],
    ]);
  });

  it('rejects scripts for unknown players, inputs at tick 0, bad counts and a leave before the join', () => {
    expect(() => toyScenario('bad').seed(42).players(1).atTick(1, player(3).does(idle))).toThrow(
      /player 3 does not exist/,
    );
    expect(() => toyScenario('bad').seed(42).players(1).atTick(0, player(0).does(idle))).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).players(1).advance(-1)).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).players(1).hashEvery(0)).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).players(1).playerLeavesAt(5, 4)).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).playerJoinsAt(0)).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).players(0)).toThrow(/at least 1/);
    expect(() => toyScenario('bad').seed(42).players(1.5)).toThrow(ScenarioSetupError);
    expect(() => toyScenario('bad').seed(42).players(1).playerJoinsAt(5).playerLeavesAt(5, 1)).toThrow(
      /cannot leave at tick 5: it joins at tick 5/,
    );
  });

  it('registers expectations and captures with their tick and label', () => {
    const { expectations, captures } = toyScenario('expectations')
      .seed(42)
      .players(1)
      .advance(5)
      .expect('x', () => 1)
      .atTick(3)
      .toBe(1)
      .expect('list', () => [1])
      .atEnd()
      .toEqual([1])
      .expect('near', () => 1.05)
      .atTick(4)
      .toBeCloseTo(1, 0.1)
      .expect('big', () => 9)
      .atTick(5)
      .toSatisfy((value) => value > 5, 'greater than 5')
      .expect('bounded', () => 72)
      .atTick(5)
      .toBeBetween(70, 74)
      .capture('mass', () => 3)
      .atTick(2)
      .capture('final', () => 4)
      .atEnd()
      .build();
    expect(expectations.map((expectation) => [expectation.tick, expectation.label])).toEqual([
      [3, 'x'],
      [AT_END, 'list'],
      [4, 'near'],
      [5, 'big'],
      [5, 'bounded'],
    ]);
    expect(expectations.every((expectation) => expectation.match(expectation.select(null as never)).isMatch)).toBe(
      true,
    );
    expect(captures.map((capture) => [capture.tick, capture.label])).toEqual([
      [2, 'mass'],
      [AT_END, 'final'],
    ]);
  });

  it('rejects an expectation or a capture at a negative or fractional tick', () => {
    const builder = toyScenario('bad tick').seed(42).players(1);
    expect(() => builder.expect('x', () => 1).atTick(-1)).toThrow(ScenarioSetupError);
    expect(() => builder.expect('x', () => 1).atTick(0.5)).toThrow(ScenarioSetupError);
    expect(() => builder.capture('x', () => 1).atTick(-1)).toThrow(ScenarioSetupError);
  });

  it('places cells, motes and fragments by the ECOLOGY §8 convention, as anchors', () => {
    const { fixtures } = placingScenario('E9')
      .seed(42)
      .players(2)
      .placeCell({ playerIndex: 0, mass: 100 })
      .placeCell({ playerIndex: 1, mass: 20, eastOfFirstCellWu: 10 })
      .placeMote({ moteKind: 'algae', at: insideCellOf(0) })
      .placeFragment({ tag: 'sensory', at: { x: 1, y: 2 } })
      .build();
    expect(fixtures.map((fixture) => [fixture.kind, fixture.at])).toEqual([
      [PLACED_KIND.cell, ZONE.broth],
      [PLACED_KIND.cell, eastOfCellOf(0, 10)],
      [PLACED_KIND.mote, insideCellOf(0)],
      [PLACED_KIND.fragment, { kind: 'point', at: { x: 1, y: 2 } }],
    ]);
  });

  it('schedules a placement with atTick(T) and keeps setup placement the default', () => {
    const { fixtures, scheduledFixtures } = placingScenario('E15')
      .seed(42)
      .players(1)
      .placeCell({ playerIndex: 0, mass: 20, traits: ['nucleoid'] })
      .atTick(1)
      .placeMote({ moteKind: 'bacterium', variant: 'photosynthetic', at: insideCellOf(0) })
      .atTick(2)
      .placeMote({ moteKind: 'bacterium', variant: 'photosynthetic', eastOfFirstCellWu: 0 })
      .advance(5)
      .build();
    expect(fixtures.map((fixture) => fixture.kind)).toEqual([PLACED_KIND.cell]);
    expect(scheduledFixtures.map(({ tick, fixture }) => [tick, fixture.kind, fixture.at])).toEqual([
      [1, PLACED_KIND.mote, insideCellOf(0)],
      [2, PLACED_KIND.mote, eastOfCellOf(0, 0)],
    ]);
  });

  it('refuses to place a cell, or anchor to a cell, for a player that does not exist', () => {
    expect(() => placingScenario('E9').seed(42).players(1).placeCell({ playerIndex: 1, mass: 20 })).toThrow(
      ScenarioSetupError,
    );
    expect(() =>
      placingScenario('E9')
        .seed(42)
        .players(1)
        .placeMote({ moteKind: 'algae', at: insideCellOf(1) }),
    ).toThrow(ScenarioSetupError);
    expect(() => placingScenario('E9').seed(42).players(1).atTick(0)).toThrow(ScenarioSetupError);
  });

  it('keeps the script a player was given, built fresh per run', () => {
    const script = targetPoint(1, 2);
    const { scripts } = toyScenario('script').seed(42).players(1).atTick(1, player(0).does(script)).advance(1).build();
    expect(scripts[0]?.createScript()).toBe(script);
  });

  it('builds a fresh strategy instance each time a bot script is created', () => {
    let built = 0;
    const { scripts } = toyScenario('bot')
      .seed(42)
      .players(1)
      .bot(0, () => {
        built += 1;
        return { name: 'counting', decide: () => null };
      })
      .advance(1)
      .build();
    scripts[0]?.createScript();
    scripts[0]?.createScript();
    expect(built).toBe(2);
  });
});
