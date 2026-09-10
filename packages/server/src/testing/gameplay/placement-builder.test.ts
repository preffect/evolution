import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import { PLACED_KIND, type PlacedFixture } from './fixtures.js';
import { FixtureScheduler, isPlacedCell, type FixtureRegistry } from './placement-builder.js';
import { eastOfCellOf, insideCellOf, ZONE } from './placement.js';

const PLAYER_COUNT = 2;

/** A registry that remembers what was registered at which tick and which players were required. */
function recordingRegistry() {
  const registered: { tick: number; fixture: PlacedFixture }[] = [];
  const required: number[] = [];
  const registry: FixtureRegistry<PlacedFixture, string> = {
    register: (tick, fixture) => {
      registered.push({ tick, fixture });
      return 'builder';
    },
    requirePlayer: (playerIndex) => {
      required.push(playerIndex);
      if (playerIndex >= PLAYER_COUNT) {
        throw new ScenarioSetupError(`player ${playerIndex} does not exist`);
      }
    },
    fixtures: () => registered.map((entry) => entry.fixture),
  };
  return { registry, registered, required };
}

describe('isPlacedCell', () => {
  it('recognises a placed cell record and nothing else', () => {
    expect(isPlacedCell({ kind: PLACED_KIND.cell })).toBe(true);
    expect(isPlacedCell({ kind: PLACED_KIND.mote })).toBe(false);
    expect(isPlacedCell(null)).toBe(false);
    expect(isPlacedCell('cell')).toBe(false);
  });
});

describe('FixtureScheduler', () => {
  it('stamps every placement with its tick and hands the builder back', () => {
    const { registry, registered } = recordingRegistry();
    const scheduler = new FixtureScheduler(3, registry);
    expect(scheduler.placeCell({ playerIndex: 0, mass: 100 })).toBe('builder');
    expect(scheduler.placeMote({ moteKind: 'algae', eastOfFirstCellWu: 10 })).toBe('builder');
    expect(scheduler.placeFragment({ tag: 'sensory', at: insideCellOf(1) })).toBe('builder');
    expect(registered.map((entry) => [entry.tick, entry.fixture.kind, entry.fixture.at])).toEqual([
      [3, PLACED_KIND.cell, ZONE.broth],
      [3, PLACED_KIND.mote, eastOfCellOf(0, 10)],
      [3, PLACED_KIND.fragment, insideCellOf(1)],
    ]);
  });

  it('requires the placed cell player and any player an anchor names', () => {
    const { registry, required } = recordingRegistry();
    const scheduler = new FixtureScheduler(0, registry);
    scheduler.placeCell({ playerIndex: 1, mass: 20, at: eastOfCellOf(0, 10) });
    expect(required).toEqual([1, 0]);
    expect(() => scheduler.placeMote({ moteKind: 'algae', at: insideCellOf(PLAYER_COUNT) })).toThrow(
      ScenarioSetupError,
    );
  });

  it('passes any adapter fixture through as it is', () => {
    const { registry, registered } = recordingRegistry();
    const fixture: PlacedFixture = { kind: PLACED_KIND.mote, moteKind: 'algae', variant: null, at: ZONE.vent };
    new FixtureScheduler(7, registry).place(fixture);
    expect(registered).toEqual([{ tick: 7, fixture }]);
  });
});
