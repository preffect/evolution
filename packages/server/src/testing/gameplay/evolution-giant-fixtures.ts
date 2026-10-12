// The placed giant (docs/ecology/acceptance.md §8.2, docs/ecology/giants.md §3.5.15 `placeGiant`): the species' seat
// (`WILD_CELL_COUNT` + its place in `GIANT_SPECIES_ORDER`, created on demand, since placing anything vacates the
// seeded seats) seats its cell at the resolved anchor at `bornMass + grownMass` with that growth, at rest with no
// target or sprint counters as a respawn leaves it, and the row's heading. A cell the seat already had is withdrawn
// without detritus, as `.placeWildCell` withdraws one. The cell is seated through the simulation's own
// `seatGiantCell`, so it carries its species, its build and its level. No stream is drawn.

import { isGiantSpecies, GIANT_SPECIES_ORDER, type Vec2 } from '@evolution/shared';
import { clearedGiantSeatOf, seatGiantCell } from '../../game/wild/giant-seats.js';
import { setSeatHeading } from '../../game/wild/wild-wander.js';
import type { CellRecord } from '../../game/world/entities.js';
import type { WorldState } from '../../game/world/world-state.js';
import { ScenarioSetupError } from './errors.js';
import type { PlacedGiant } from './fixtures.js';

/** Seats the fixture's giant at `centre` (the anchor, resolved by the caller against the world). */
export function applyPlacedGiant(world: WorldState, fixture: PlacedGiant, centre: Vec2): CellRecord {
  const { species } = fixture;
  if (!isGiantSpecies(species)) {
    throw new ScenarioSetupError(`"${species}" is not a giant species (${GIANT_SPECIES_ORDER.join(', ')})`);
  }
  const seat = clearedGiantSeatOf(world, species);
  setSeatHeading(seat, fixture.heading);
  return seatGiantCell(world, seat, { centre, bornMass: fixture.bornMass, grownMass: fixture.grownMass });
}
