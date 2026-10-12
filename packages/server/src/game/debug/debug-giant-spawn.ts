// `debug_spawn(gameId, 'giant', x, y, { species, mass? })` (docs/architecture/debug-mcp.md §8, docs/ecology/giants.md
// §3.5.15): places, or replaces, that species' giant at the point, whether or not `GIANT_SPECIES_IN_DISH` seats it,
// in the species' own seat (`WILD_CELL_COUNT` + its place in `GIANT_SPECIES_ORDER`). `mass` is the born mass, with no
// growth; left out, it is drawn from the species' range. Either way a fresh heading is drawn, and both draws come from
// the `giants` stream, resumed and written back here, so the recorded patch replays to the same giant. A replaced
// giant leaves without detritus, its engulfs aborted, as a fixture's replacement does.

import { GIANT_SPECIES_ORDER, RANDOM_STREAM, isGiantSpecies, type GiantSpecies } from '@evolution/shared';
import { EXACT_SNAPSHOT_VALUES } from '../serialize/quantize.js';
import { toCellView } from '../serialize/serialize.js';
import { clearedGiantSeatOf, drawGiantLife, seatGiantCell } from '../wild/giant-seats.js';
import { withStream } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { DebugRequestError } from './debug-request-error.js';
import type { SpawnRequest } from './simulation-debug-handle.js';

/** The `debug_spawn` kind that seats a giant. */
export const GIANT_SPAWN_KIND = 'giant';

function requireSpecies(value: unknown): GiantSpecies {
  if (!isGiantSpecies(value)) {
    throw new DebugRequestError(`A giant needs a "species" param (one of ${GIANT_SPECIES_ORDER.join(', ')})`);
  }
  return value;
}

/** The requested born mass, `undefined` to draw one; a mass that is not a positive number is refused. */
function requestedBornMass(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new DebugRequestError(`A giant's "mass" is a positive number of mass, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Seats the requested species' giant at the request's point; answers its cell view. */
export function spawnGiantForDebug(world: WorldState, request: SpawnRequest): unknown {
  const species = requireSpecies(request.params.species);
  const requestedMass = requestedBornMass(request.params.mass);
  const seat = clearedGiantSeatOf(world, species);
  const cell = withStream(world, RANDOM_STREAM.giants, (random) => {
    const drawnMass = drawGiantLife(seat, random, world.balance);
    const bornMass = requestedMass ?? drawnMass;
    return seatGiantCell(world, seat, { centre: { x: request.x, y: request.y }, bornMass, grownMass: 0 });
  });
  return toCellView(cell, EXACT_SNAPSHOT_VALUES);
}
