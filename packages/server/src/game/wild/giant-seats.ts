// The giant seats (docs/ecology/giants.md §3.5.9, §3.5.15): one seat per species of `GIANT_SPECIES_IN_DISH`, read once
// at world creation, numbered after the wild seats by the species' place in the fixed `GIANT_SPECIES_ORDER`
// (`WILD_CELL_COUNT` + i), so a giant seated by `debug_spawn` or a fixture has the same seat whether or not the list
// names it. A giant's cell is placed by the giant clearance (`GIANT_MIN_PLAYER_DISTANCE_WU` from every player cell,
// `GIANT_MIN_GIANT_DISTANCE_WU` from every other giant, `GIANT_MIN_CELL_DISTANCE_WU` from every other cell, through
// `findSafeSpawnPoint` and its farthest-candidate fallback) at a born mass drawn uniform on its species' range, with no
// growth and its build. Every draw is from the `giants` stream, in this order: the born mass, the first heading, then
// the placement candidates, so a giant never shifts a mote, a wild cell's draw or a player's spawn.

import {
  GIANT_SPECIES_ORDER,
  RANDOM_STREAM,
  type BalanceConfig,
  type GiantSpecies,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { findSafeSpawnPoint, nearestCellDistance, type SpawnClearance } from '../simulation/spawn-placement.js';
import { withdrawCell } from '../session/death.js';
import { isPlayerCell, type CellRecord, type GiantSeatRecord } from '../world/entities.js';
import { cellOfSeat } from '../world/lookups.js';
import type { LiveStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { applyGiantBuild, giantBuildOf, giantLevelOf } from './giant-build.js';
import { bornSeatedCell, createSeatMindRecord } from './seat-mind.js';
import { drawWildHeading, setSeatHeading } from './wild-wander.js';

/** The seat a species' giant always sits in: after the wild seats, by its place in `GIANT_SPECIES_ORDER`. */
export function giantSeatNumber(species: GiantSpecies, balance: BalanceConfig): number {
  return balance.wildCells.WILD_CELL_COUNT + GIANT_SPECIES_ORDER.indexOf(species);
}

export function createGiantSeatRecord(species: GiantSpecies, balance: BalanceConfig): GiantSeatRecord {
  return { ...createSeatMindRecord(giantSeatNumber(species, balance)), species, bornMass: 0 };
}

/** The species' seat, created on demand and kept in seat order: what world creation, a fixture and a debug spawn seat. */
export function giantSeatOf(world: WorldState, species: GiantSpecies): GiantSeatRecord {
  const existing = world.giantSeats.find((seat) => seat.species === species);
  if (existing !== undefined) {
    return existing;
  }
  const seat = createGiantSeatRecord(species, world.balance);
  world.giantSeats.push(seat);
  world.giantSeats.sort((left, right) => left.seatNumber - right.seatNumber);
  return seat;
}

/**
 * The species' seat cleared for a new giant: created on demand, and a cell it already had withdrawn without detritus,
 * its engulfs aborted (what a fixture's and a debug request's replacement share).
 */
export function clearedGiantSeatOf(world: WorldState, species: GiantSpecies): GiantSeatRecord {
  const seat = giantSeatOf(world, species);
  const previous = cellOfSeat(world, seat);
  if (previous !== undefined) {
    withdrawCell(world, previous);
  }
  return seat;
}

/** `min(nearest player − 1 500, nearest other giant − 1 500, nearest other cell − 450)` (giants.md §3.5.9). */
export const giantSpawnClearance: SpawnClearance = (point, cells, balance) => {
  const { giants } = balance;
  const giantCells = cells.filter((cell) => cell.giantSpecies !== null);
  return Math.min(
    nearestCellDistance(point, cells.filter(isPlayerCell)) - giants.GIANT_MIN_PLAYER_DISTANCE_WU,
    nearestCellDistance(point, giantCells) - giants.GIANT_MIN_GIANT_DISTANCE_WU,
    nearestCellDistance(point, cells) - giants.GIANT_MIN_CELL_DISTANCE_WU,
  );
};

/** `MIN + (MAX − MIN) × u` for a unit draw `u`: uniform on the species' born range (giants.md §3.5.3). */
export function giantBornMass(unit: number, species: GiantSpecies, balance: BalanceConfig): number {
  const minimum = balance.giants.GIANT_BORN_MASS_MIN_BY_SPECIES[species];
  const maximum = balance.giants.GIANT_BORN_MASS_MAX_BY_SPECIES[species];
  return minimum + (maximum - minimum) * unit;
}

/** Where a giant's new cell goes and how heavy: the stream's choice in play, a fixture's or a debug request's otherwise. */
export interface GiantSeating {
  readonly centre: Vec2;
  readonly bornMass: number;
  /** Growth above the born mass; 0 for every placement but a fixture's. */
  readonly grownMass: number;
}

/**
 * Seats a fresh cell for `seat` at `seating`: the born mass, the countdown to its next decision tick, the cell at
 * `bornMass + grownMass` with that growth (`fullMass` = mass: no wound), its species and its build. The heading is left
 * as it is: the placement draws one, a fixture sets its own.
 */
export function seatGiantCell(world: WorldState, seat: GiantSeatRecord, seating: GiantSeating): CellRecord {
  const mass = seating.bornMass + seating.grownMass;
  seat.bornMass = seating.bornMass;
  const level = giantLevelOf(giantBuildOf(seat.species, world.balance));
  const cell = bornSeatedCell(world, seat, { centre: seating.centre, mass, level });
  seat.grownMass = seating.grownMass;
  cell.giantSpecies = seat.species;
  setCellMass(cell, mass, world.balance);
  applyGiantBuild(cell, seat.species, world.balance);
  world.cells.push(cell);
  return cell;
}

/** A fresh born mass and heading for the seat from the `giants` stream; answers the born mass. */
export function drawGiantLife(seat: GiantSeatRecord, random: RandomSource, balance: BalanceConfig): number {
  const bornMass = giantBornMass(random.nextFloat(), seat.species, balance);
  setSeatHeading(seat, drawWildHeading(random));
  return bornMass;
}

/** Places (or respawns) the seat's giant from the `giants` stream: born mass, heading, then a point by the clearance. */
export function placeGiantCell(world: WorldState, seat: GiantSeatRecord, streams: LiveStreams): CellRecord {
  const random = streams[RANDOM_STREAM.giants];
  const bornMass = drawGiantLife(seat, random, world.balance);
  const centre = findSafeSpawnPoint(random, world.cells, world.balance, giantSpawnClearance);
  return seatGiantCell(world, seat, { centre, bornMass, grownMass: 0 });
}

/**
 * World creation: a seat for each species `GIANT_SPECIES_IN_DISH` names, in seat order (a species named twice is one
 * seat), after the players and before the wild seats, so the wild placement's threat clearance keeps every wild cell
 * clear of the giants (giants.md §3.5.9).
 */
export function createGiantSeats(world: WorldState, streams: LiveStreams): void {
  const inDish = world.balance.giants.GIANT_SPECIES_IN_DISH;
  for (const species of GIANT_SPECIES_ORDER.filter((candidate) => inDish.includes(candidate))) {
    placeGiantCell(world, giantSeatOf(world, species), streams);
  }
}
