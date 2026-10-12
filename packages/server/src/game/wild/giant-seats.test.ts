// docs/ecology/giants.md §3.5.9 and docs/ecology/acceptance.md §8.2 G1: the giant seats (numbered by species order),
// the born-mass draw, the giant clearance, what a seated giant looks like, and the world seated on the default
// balance, whose `GIANT_SPECIES_IN_DISH` is all three species (giants.md §3.5.17): the giants first, the wild seats
// clear of them.
import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  GIANT_SPECIES,
  GIANT_SPECIES_ORDER,
  RANDOM_STREAM,
  SERVER_RANDOM_STREAM_LABELS,
  createSeededRandomFromState,
  distanceBetween,
  type BalanceConfig,
  type GiantSpecies,
  type Vec2,
} from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { isInsideAnyCell } from '../simulation/spawn-point.js';
import { drawSpawnCandidate, spawnReach, threatClearance } from '../simulation/spawn-placement.js';
import { isPlayerCell, type CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { giantBuildOf, giantLevelOf } from './giant-build.js';
import {
  createGiantSeats,
  giantBornMass,
  giantSeatNumber,
  giantSeatOf,
  giantSpawnClearance,
  placeGiantCell,
  seatGiantCell,
} from './giant-seats.js';
import { decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';

const { giants, wildCells, world: worldBalance } = DEFAULT_BALANCE;
/** A placement draws the born mass and the heading before its candidates. */
const LIFE_DRAWS = 2;

const SPECIES_IN_DISH_LEAF = 'GIANT_SPECIES_IN_DISH';
const WILD_COUNT_LEAF = 'WILD_CELL_COUNT';

function balanceSeating(species: readonly GiantSpecies[]): BalanceConfig {
  return { ...DEFAULT_BALANCE, giants: { ...giants, [SPECIES_IN_DISH_LEAF]: species } };
}

/** Between the player rule's 600 wu and the giant rule's 1 500 wu. */
const NEIGHBOUR_DISTANCE_WU = 1000;

/** The only cell in the dish: an amoeba of 1 000 (a threat to the player rule) at `centre`. */
function seatAmoebaAlone(world: WorldState, centre: Vec2): CellRecord {
  world.cells = [];
  return seatGiantCell(world, giantSeatOf(world, GIANT_SPECIES.amoeba), { centre, bornMass: 1000, grownMass: 0 });
}

/** The world's player cell (no threat to the player rule) moved to `centre`. */
function movePlayer(world: WorldState, centre: Vec2): CellRecord {
  return Object.assign(world.cells[0]!, centre);
}

describe('giantSeatNumber and giantSeatOf', () => {
  it('numbers the seats after the wild seats by the fixed species order: 24, 25, 26', () => {
    expect(GIANT_SPECIES_ORDER.map((species) => giantSeatNumber(species, wildCells.WILD_CELL_COUNT))).toEqual([
      24, 25, 26,
    ]);
  });

  it('creates a species seat once and keeps the list in seat order, whatever order they are asked for', () => {
    const world = createTestWorld();
    const diatom = giantSeatOf(world, GIANT_SPECIES.diatom);
    const amoeba = giantSeatOf(world, GIANT_SPECIES.amoeba);
    expect(giantSeatOf(world, GIANT_SPECIES.diatom)).toBe(diatom);
    expect(world.giantSeats).toEqual([amoeba, diatom]);
    expect([amoeba.seatNumber, diatom.seatNumber]).toEqual([24, 26]);
    expect(world.wildSeats).toEqual([]);
  });

  it('numbers from the wild count the world was created with, not a count patched since', () => {
    const world = createTestWorld();
    world.balance = {
      ...DEFAULT_BALANCE,
      wildCells: { ...wildCells, [WILD_COUNT_LEAF]: wildCells.WILD_CELL_COUNT + 6 },
    };
    expect(giantSeatOf(world, GIANT_SPECIES.paramecium).seatNumber).toBe(25);
  });
});

describe('giantBornMass', () => {
  it('is uniform on the species range: the minimum at 0, the midpoint at 0.5', () => {
    expect(giantBornMass(0, GIANT_SPECIES.paramecium, DEFAULT_BALANCE)).toBe(900);
    expect(giantBornMass(0.5, GIANT_SPECIES.paramecium, DEFAULT_BALANCE)).toBe(1100);
    expect(giantBornMass(0.5, GIANT_SPECIES.diatom, DEFAULT_BALANCE)).toBe(1250);
  });
});

describe('giantSpawnClearance', () => {
  it('is the smallest of the player, giant and cell clearances', () => {
    const world = createTestWorld();
    const player = world.cells[0]!;
    const from = (eastWu: number) => ({ x: player.x + eastWu, y: player.y });
    expect(giantSpawnClearance(from(1000), world.cells, DEFAULT_BALANCE)).toBeCloseTo(-500, 6);
    const giant = seatGiantCell(world, giantSeatOf(world, GIANT_SPECIES.amoeba), {
      centre: from(3000),
      bornMass: 1000,
      grownMass: 0,
    });
    // 300 wu from the giant, 3 300 from the player: the giant rule binds.
    expect(giantSpawnClearance(from(3300), world.cells, DEFAULT_BALANCE)).toBeCloseTo(300 - 1500, 6);
    giant.giantSpecies = null; // the same cell as a plain wild cell: only the 450 wu cell rule
    expect(giantSpawnClearance(from(3300), world.cells, DEFAULT_BALANCE)).toBeCloseTo(300 - 450, 6);
    expect(giantSpawnClearance(from(3300), [], DEFAULT_BALANCE)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('seatGiantCell', () => {
  it('seats a wild-kind cell with the species, its build and born mass plus growth, at rest, drawing nothing', () => {
    const world = createTestWorld();
    world.tick = 100;
    const seat = giantSeatOf(world, GIANT_SPECIES.amoeba);
    const before = JSON.stringify(world.random);
    const cell = seatGiantCell(world, seat, { centre: { x: 1500, y: 0 }, bornMass: 1400, grownMass: 50 });
    expect(JSON.stringify(world.random)).toBe(before);
    expect(cell).toMatchObject({
      kind: CELL_KIND.wild,
      playerId: null,
      organismId: cell.id,
      giantSpecies: GIANT_SPECIES.amoeba,
      x: 1500,
      y: 0,
      mass: 1450,
      level: 7,
      stage: CELL_STAGE.specialised,
      isStarving: false,
      targetX: null,
      velocityX: 0,
      sprintRemainingTicks: 0,
    });
    expect(cell.traits).toEqual(giants.GIANT_BUILDS_BY_SPECIES.giant_amoeba);
    expect(seat).toMatchObject({ cellId: cell.id, bornMass: 1400, grownMass: 50, fullMass: 1450, respawnInTicks: 0 });
    expect(seat.decideInTicks).toBe(ticksUntilDecision(100, 24, decisionIntervalTicks(DEFAULT_BALANCE)));
    expect(world.cells.at(-1)).toBe(cell);
  });
});

describe('placeGiantCell', () => {
  it('draws the born mass, then the heading, then the candidates, from the giants stream alone', () => {
    const world = createTestWorld();
    const seat = giantSeatOf(world, GIANT_SPECIES.diatom);
    const giantsBefore = world.random[RANDOM_STREAM.giants];
    const expectedMass = giantBornMass(
      createSeededRandomFromState(giantsBefore).nextFloat(),
      GIANT_SPECIES.diatom,
      DEFAULT_BALANCE,
    );
    const context = createTestStepContext(world);
    const cell = placeGiantCell(world, seat, context.streams);
    expect(seat.bornMass).toBeCloseTo(expectedMass, 10);
    expect([cell.mass, seat.grownMass, seat.fullMass]).toEqual([seat.bornMass, 0, seat.bornMass]);
    expect(Math.hypot(seat.headingX, seat.headingY)).toBeCloseTo(1, 10);
    // At least one candidate, two draws each, after the life's two draws.
    expect(context.streams[RANDOM_STREAM.giants].getState().position).toBeGreaterThanOrEqual(LIFE_DRAWS + 2);
    for (const label of SERVER_RANDOM_STREAM_LABELS.filter((other) => other !== RANDOM_STREAM.giants)) {
      expect(context.streams[label].getState(), label).toEqual(world.random[label]);
    }
    expect(distanceBetween(cell, world.cells[0]!)).toBeGreaterThanOrEqual(giants.GIANT_MIN_PLAYER_DISTANCE_WU);
  });

  // The player rule (600 wu from a threat) would take the first candidate here; the giant rule must not, whatever the
  // seed draws, since the neighbour is put 1 000 wu from where that candidate falls.
  it.each([
    { neighbour: 'another giant', minimumWu: giants.GIANT_MIN_GIANT_DISTANCE_WU, place: seatAmoebaAlone },
    { neighbour: 'a player cell', minimumWu: giants.GIANT_MIN_PLAYER_DISTANCE_WU, place: movePlayer },
  ])('skips a first candidate 1 000 wu from $neighbour, inside the giant clearance', ({ minimumWu, place }) => {
    const world = createTestWorld();
    const stream = createSeededRandomFromState(world.random[RANDOM_STREAM.giants]);
    for (let draw = 0; draw < LIFE_DRAWS; draw += 1) {
      stream.nextFloat();
    }
    const firstCandidate = drawSpawnCandidate(stream, DEFAULT_BALANCE);
    const neighbour = place(world, { x: firstCandidate.x + NEIGHBOUR_DISTANCE_WU, y: firstCandidate.y });
    expect(threatClearance(firstCandidate, world.cells, DEFAULT_BALANCE)).toBeGreaterThanOrEqual(0);
    const cell = placeGiantCell(world, giantSeatOf(world, GIANT_SPECIES.diatom), createTestStepContext(world).streams);
    expect({ x: cell.x, y: cell.y }).not.toEqual(firstCandidate);
    expect(distanceBetween(cell, neighbour)).toBeGreaterThanOrEqual(minimumWu);
  });
});

describe('createGiantSeats', () => {
  it('seats no giant on a balance whose list is empty', () => {
    const world = createTestWorld({ balance: balanceSeating([]), hasWildSeats: true });
    expect(world.giantSeats).toEqual([]);
    expect(world.cells.filter((cell) => cell.giantSpecies !== null)).toEqual([]);
  });

  it('seats one giant a species in seat order, whatever order and repeats the list has', () => {
    const world = createTestWorld({ balance: balanceSeating([]) });
    world.balance = balanceSeating([GIANT_SPECIES.diatom, GIANT_SPECIES.amoeba, GIANT_SPECIES.diatom]);
    createGiantSeats(world, createTestStepContext(world).streams);
    expect(world.giantSeats.map((seat) => [seat.species, seat.seatNumber])).toEqual([
      [GIANT_SPECIES.amoeba, 24],
      [GIANT_SPECIES.diatom, 26],
    ]);
  });
});

/** The farthest-candidate fallback is pinned: none of seed 42's giants and wild cells needs it. */
describe('createWorld on the default balance, which seats all three giants (G1)', () => {
  const world = createTestWorld({ hasWildSeats: true, isFilled: true });
  const giantCells = world.cells.filter((cell) => cell.giantSpecies !== null);
  const wild = world.cells.filter((cell) => !isPlayerCell(cell) && cell.giantSpecies === null);
  const player = world.cells.find(isPlayerCell)!;

  it('seats exactly three giants, one a species, and the 24 wild cells with no species', () => {
    expect(giantCells.map((cell) => cell.giantSpecies)).toEqual([...GIANT_SPECIES_ORDER]);
    expect(giantCells.every((cell) => cell.kind === CELL_KIND.wild)).toBe(true);
    expect(wild).toHaveLength(wildCells.WILD_CELL_COUNT);
    expect(world.giantSeats.map((seat) => seat.cellId)).toEqual(giantCells.map((cell) => cell.id));
  });

  it('gives each giant its born mass in range, no growth, no starving, its level, stage and build', () => {
    for (const [index, cell] of giantCells.entries()) {
      const seat = world.giantSeats[index]!;
      const species = seat.species;
      expect(cell.mass).toBe(seat.bornMass);
      expect(seat.bornMass).toBeGreaterThanOrEqual(giants.GIANT_BORN_MASS_MIN_BY_SPECIES[species]);
      expect(seat.bornMass).toBeLessThan(giants.GIANT_BORN_MASS_MAX_BY_SPECIES[species]);
      expect([seat.grownMass, cell.isStarving]).toEqual([0, false]);
      expect(cell.level).toBe(giantLevelOf(giantBuildOf(species, DEFAULT_BALANCE)));
      expect(cell.stage).toBe(CELL_STAGE.specialised);
      expect(cell.traits).toEqual(giants.GIANT_BUILDS_BY_SPECIES[species]);
    }
  });

  it('keeps every giant 1 500 wu from the player and from each other, inside the placement disc', () => {
    for (const [index, cell] of giantCells.entries()) {
      expect(distanceBetween(cell, player)).toBeGreaterThanOrEqual(giants.GIANT_MIN_PLAYER_DISTANCE_WU);
      expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(spawnReach(DEFAULT_BALANCE));
      for (const other of giantCells.slice(index + 1)) {
        expect(distanceBetween(cell, other)).toBeGreaterThanOrEqual(giants.GIANT_MIN_GIANT_DISTANCE_WU);
      }
    }
  });

  it('keeps every wild centre SAFE_SPAWN_RADIUS from every giant: the giants were placed first', () => {
    const tooClose = wild.filter((cell) =>
      giantCells.some((giant) => distanceBetween(cell, giant) < worldBalance.SAFE_SPAWN_RADIUS),
    );
    expect(tooClose).toEqual([]);
  });

  it('lays no mote inside any giant', () => {
    expect(world.food.length).toBeGreaterThan(0);
    const inside = (cells: readonly CellRecord[]) =>
      [...world.food, ...world.dnaFragments].filter((mote) => isInsideAnyCell(mote, cells));
    expect(inside(giantCells)).toEqual([]);
  });
});
