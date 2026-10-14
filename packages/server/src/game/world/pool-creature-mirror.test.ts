// docs/architecture/entity-model.md §2, docs/game-design/phases.md §14.6.3, §14.6.4: a creature's cell mirrors its
// seat, its radius follows its species, and only the seat is hashed.
import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  DEFAULT_BALANCE,
  FIRST_LEVEL,
  POOL_CREATURE_SPECIES,
  entityId,
  eraLandmarkRadius,
  playerId,
  radiusForMass,
} from '@evolution/shared';
import { createTestPoolCreatureSeat, seatTestPoolCreature } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { bornCellRecord, type CellIdentity } from './cell-record.js';
import { mirrorPoolCreatureSeat } from './pool-creature-mirror.js';
import { computeStateHash } from './state-hash.js';

const SEAT_POINT = { x: 650, y: 0 };
const ROTIFER_MASS = DEFAULT_BALANCE.poolCreatures.ROTIFER_MASS;
const LANDMARK_RADIUS = eraLandmarkRadius(DEFAULT_BALANCE);
const NEMATODE_BOUND = DEFAULT_BALANCE.poolCreatures.NEMATODE_LENGTH / 2;

/** A wild cell no seat has mirrored yet. */
function bareCell() {
  const id = entityId('c-1');
  const identity: CellIdentity = {
    id,
    kind: CELL_KIND.wild,
    playerId: null,
    organismId: id,
    avatarIndex: 0,
    level: FIRST_LEVEL,
  };
  return bornCellRecord(identity, SEAT_POINT, ROTIFER_MASS);
}

describe('mirrorPoolCreatureSeat', () => {
  it('copies the seat’s species, landmark flag and heading onto the cell', () => {
    const cell = bareCell();
    const seat = createTestPoolCreatureSeat({ species: POOL_CREATURE_SPECIES.didinium, headingRadians: 1.25 });
    mirrorPoolCreatureSeat(seat, cell, DEFAULT_BALANCE);
    expect(cell.poolCreature).toEqual({
      species: POOL_CREATURE_SPECIES.didinium,
      isLandmark: false,
      headingRadians: 1.25,
    });
    expect(cell.poolCreature).not.toBe(seat);
  });

  it.each([
    ['a roaming rotifer', createTestPoolCreatureSeat(), radiusForMass(ROTIFER_MASS, DEFAULT_BALANCE.growth)],
    ['the landmark', createTestPoolCreatureSeat({ isLandmark: true }), LANDMARK_RADIUS],
    ['a nematode', createTestPoolCreatureSeat({ species: POOL_CREATURE_SPECIES.nematode }), NEMATODE_BOUND],
  ])('sets the radius %s collides at', (_label, seat, radius) => {
    const cell = bareCell();
    mirrorPoolCreatureSeat(seat, cell, DEFAULT_BALANCE);
    expect(cell.radius).toBe(radius);
  });

  it('keeps a mirrored creature’s radius through a mass change, and an ordinary cell’s follows its mass', () => {
    const world = createTestWorld({ players: [{ playerId: playerId('a'), playerName: 'A', avatarIndex: 0 }] });
    const { cell: landmark } = seatTestPoolCreature(world, {
      species: POOL_CREATURE_SPECIES.rotifer,
      at: SEAT_POINT,
      mass: ROTIFER_MASS,
      isLandmark: true,
    });
    setCellMass(landmark, 2 * ROTIFER_MASS, DEFAULT_BALANCE);
    expect(landmark.radius).toBe(LANDMARK_RADIUS);
    const player = world.cells[0]!;
    setCellMass(player, 2 * ROTIFER_MASS, DEFAULT_BALANCE);
    expect(player.radius).toBe(radiusForMass(2 * ROTIFER_MASS, DEFAULT_BALANCE.growth));
  });
});

describe('the creature’s state in the hash', () => {
  function worldWithANematode() {
    const world = createTestWorld();
    const seated = seatTestPoolCreature(world, {
      species: POOL_CREATURE_SPECIES.nematode,
      at: SEAT_POINT,
      mass: ROTIFER_MASS,
    });
    return { world, ...seated };
  }

  it('is the seat’s: turning the seat’s heading moves the hash', () => {
    const base = computeStateHash(worldWithANematode().world);
    const { world, seat } = worldWithANematode();
    seat.headingRadians += 1;
    expect(computeStateHash(world)).not.toBe(base);
  });

  it('leaves the cell’s mirror out, as derived: turning only the cell’s heading leaves the hash alone', () => {
    const base = computeStateHash(worldWithANematode().world);
    const { world, cell } = worldWithANematode();
    cell.poolCreature = { ...cell.poolCreature!, headingRadians: cell.poolCreature!.headingRadians + 1 };
    expect(computeStateHash(world)).toBe(base);
  });
});
