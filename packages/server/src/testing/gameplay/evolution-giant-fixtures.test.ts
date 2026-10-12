// docs/ecology/acceptance.md §8.2 and docs/ecology/giants.md §3.5.15 `placeGiant` on a live world: the species' seat
// (24, 25 or 26) seats its cell at the anchor at `bornMass + grownMass` with that growth, at rest and with the row's
// heading; a second placement replaces the first without detritus; an unknown species is a setup error.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES } from '@evolution/shared';
import { decisionIntervalTicks } from '../../game/wild/wild-strategy.js';
import { createTestWorld } from '../world-builders.js';
import { ScenarioSetupError } from './errors.js';
import { applyPlacedGiant } from './evolution-giant-fixtures.js';
import { placeGiant } from './fixtures.js';
import { BROTH_POINT } from './placement.js';

const NORTH = { x: 0, y: -1 };

describe('applyPlacedGiant', () => {
  it('seats the species at the centre with its growth and heading, at rest, deciding first on its seat tick', () => {
    const world = createTestWorld();
    const fixture = placeGiant(
      { species: GIANT_SPECIES.paramecium, bornMass: 900, grownMass: 40, heading: NORTH },
      undefined,
    );
    const cell = applyPlacedGiant(world, fixture, BROTH_POINT);
    const seat = world.giantSeats[0]!;
    expect(seat).toMatchObject({ seatNumber: 25, cellId: cell.id, bornMass: 900, grownMass: 40, fullMass: 940 });
    expect([seat.headingX, seat.headingY]).toEqual([NORTH.x, NORTH.y]);
    expect(seat.decideInTicks).toBe(25);
    expect(decisionIntervalTicks(DEFAULT_BALANCE)).toBeGreaterThan(25);
    expect(cell).toMatchObject({ ...BROTH_POINT, mass: 940, giantSpecies: GIANT_SPECIES.paramecium, targetX: null });
    expect([cell.velocityX, cell.velocityY, cell.sprintRemainingTicks]).toEqual([0, 0, 0]);
  });

  it('replaces the giant the seat had, leaving no detritus', () => {
    const world = createTestWorld();
    const fixture = placeGiant({ species: GIANT_SPECIES.amoeba, bornMass: 1000 }, undefined);
    const first = applyPlacedGiant(world, fixture, BROTH_POINT);
    const second = applyPlacedGiant(world, fixture, { x: 0, y: 0 });
    expect(world.cells.filter((cell) => cell.giantSpecies !== null)).toEqual([second]);
    expect(world.cells).not.toContain(first);
    expect(world.food).toEqual([]);
  });

  it('refuses a species that is not a giant', () => {
    const fixture = placeGiant({ species: 'amoeba', bornMass: 1000 }, undefined);
    expect(() => applyPlacedGiant(createTestWorld(), fixture, BROTH_POINT)).toThrow(ScenarioSetupError);
    expect(() => applyPlacedGiant(createTestWorld(), fixture, BROTH_POINT)).toThrow(/giant_amoeba/);
  });
});
