// What a wild seat and a giant seat share (docs/architecture/entity-model.md §2, docs/ecology/giants.md §3.5.15): the
// `SeatMindRecord` fields at rest, and the birth of a seat's cell. A seated cell is a wild-kind cell with no player
// and no palette, born free and at rest with the seat's decision countdown restarted (`ticksUntilDecision` from
// `world.tick`, so seat n first decides on the next tick ≡ n mod the interval), no growth, no wound and no hunt: what
// a placement, a respawn and a fixture all require. The caller sets the seat's own base (the size factor or the born
// mass), folds the cell's ladder and appends it.

import { AVATAR_INDEX_MIN, CELL_KIND, ENTITY_KIND, type Vec2 } from '@evolution/shared';
import { bornCellRecord } from '../world/cell-record.js';
import type { CellRecord, SeatMindRecord } from '../world/entities.js';
import { mintEntityId } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';
import { decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';

/** A seated cell wears no player palette: the renderer keys its wild ramp off `kind`, and the index is the first. */
const SEATED_CELL_AVATAR_INDEX = AVATAR_INDEX_MIN;
/** At rest until placed: no heading and no decision pending. */
const AT_REST = 0;

/** A seat with no cell, no growth, no heading, no decision pending and no hunt. */
export function createSeatMindRecord(seatNumber: number): SeatMindRecord {
  return {
    seatNumber,
    cellId: null,
    grownMass: 0,
    fullMass: 0,
    respawnInTicks: 0,
    headingX: AT_REST,
    headingY: AT_REST,
    decideInTicks: AT_REST,
    huntPreyId: null,
    huntStartTick: AT_REST,
    givenUpPreyId: null,
    huntRestUntilTick: AT_REST,
  };
}

/** Where a seat's new cell goes, how heavy it is born and at what level. */
export interface SeatedBirth {
  readonly centre: Vec2;
  readonly mass: number;
  readonly level: number;
}

/**
 * Mints the seat's new cell at `birth` and points the seat at it: the countdown restarted, the respawn cleared, the
 * full size the born mass with no growth, the hunt forgotten. The cell is not yet in the world.
 */
export function bornSeatedCell(world: WorldState, seat: SeatMindRecord, birth: SeatedBirth): CellRecord {
  seat.decideInTicks = ticksUntilDecision(world.tick, seat.seatNumber, decisionIntervalTicks(world.balance));
  const id = mintEntityId(world, ENTITY_KIND.cell);
  const identity = {
    id,
    kind: CELL_KIND.wild,
    playerId: null,
    organismId: id,
    avatarIndex: SEATED_CELL_AVATAR_INDEX,
    level: birth.level,
  };
  const cell = bornCellRecord(identity, birth.centre, birth.mass);
  seat.cellId = id;
  seat.respawnInTicks = 0;
  seat.grownMass = 0;
  seat.fullMass = birth.mass;
  seat.huntPreyId = null;
  seat.huntStartTick = AT_REST;
  seat.givenUpPreyId = null;
  seat.huntRestUntilTick = AT_REST;
  return cell;
}
