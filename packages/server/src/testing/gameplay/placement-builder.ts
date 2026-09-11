// The placement half of the DSL (docs/TESTING.md §8.1): `.placeCell(...)` on the scenario is a
// setup fixture (applied before tick 1); `.atTick(T).placeCell(...)` schedules the same record
// to be applied between tick T − 1 and tick T. One scheduler class serves both, bound to the
// tick it stamps, so the placement convention is written once. The placed records are accepted by
// any adapter whose fixture type includes them (`PlacedFixture | Fixture`), so an adapter may add
// fixtures of its own beside them.

import { ANCHOR_KIND, type PlacementAnchor } from './placement.js';
import {
  placeCell,
  placeFragment,
  placeMote,
  PLACED_KIND,
  type PlacedCell,
  type PlacedFixture,
  type PlaceCellOptions,
  type PlaceFragmentOptions,
  type PlaceMoteOptions,
} from './fixtures.js';

/** What the scheduler needs from the scenario builder. */
export interface FixtureRegistry<Fixture, Builder> {
  /** Stores the fixture at `tick` (0 = setup) and hands the scenario builder back. */
  register(tick: number, fixture: Fixture): Builder;
  /** Throws `ScenarioSetupError` for an index the scenario has not declared. */
  requirePlayer(playerIndex: number): void;
  /** Every fixture so far, setup first then scheduled in order: what "east of the first cell" refers to. */
  fixtures(): readonly Fixture[];
}

export function isPlacedCell(fixture: unknown): fixture is PlacedCell {
  return typeof fixture === 'object' && fixture !== null && (fixture as { kind?: unknown }).kind === PLACED_KIND.cell;
}

export class FixtureScheduler<Fixture, Builder> {
  constructor(
    private readonly tick: number,
    private readonly registry: FixtureRegistry<Fixture, Builder>,
  ) {}

  /** Any adapter-specific fixture, as it is. */
  place(fixture: Fixture): Builder {
    return this.registry.register(this.tick, fixture);
  }

  placeCell(this: FixtureScheduler<PlacedFixture | Fixture, Builder>, options: PlaceCellOptions): Builder {
    this.registry.requirePlayer(options.playerIndex);
    const fixture = placeCell(options, this.firstPlacedCell());
    this.requireAnchorPlayer(fixture.at);
    return this.place(fixture);
  }

  placeMote(this: FixtureScheduler<PlacedFixture | Fixture, Builder>, options: PlaceMoteOptions): Builder {
    const fixture = placeMote(options, this.firstPlacedCell());
    this.requireAnchorPlayer(fixture.at);
    return this.place(fixture);
  }

  placeFragment(this: FixtureScheduler<PlacedFixture | Fixture, Builder>, options: PlaceFragmentOptions): Builder {
    const fixture = placeFragment(options, this.firstPlacedCell());
    this.requireAnchorPlayer(fixture.at);
    return this.place(fixture);
  }

  private firstPlacedCell(): PlacedCell | undefined {
    return (this.registry.fixtures() as readonly unknown[]).find(isPlacedCell);
  }

  /** An anchor naming a player ("inside player 3's cell") must name a declared one. */
  private requireAnchorPlayer(anchor: PlacementAnchor): void {
    if (anchor.kind === ANCHOR_KIND.insideCellOf || anchor.kind === ANCHOR_KIND.eastOfCellOf) {
      this.registry.requirePlayer(anchor.playerIndex);
    }
  }
}
