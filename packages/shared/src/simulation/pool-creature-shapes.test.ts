// docs/game-design/phases.md §14.6.3, §14.6.4: the nematode is a chain of circles inside its bounding radius, the
// landmark is drawn and collided at the footprint's radius, and the copepod sweeps one strip of its lane per tick.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import { TICK_HZ } from '../constants/network.js';
import { POOL_CREATURE_SPECIES, type CopepodLaneView, type PoolCreatureView } from '../types/pool.js';
import { radiusForMass } from './mass-curves.js';
import {
  cellRadiusOf,
  copepodHeadAt,
  copepodStripAt,
  copepodStripBounds,
  nematodeBoundingRadius,
  nematodeSegmentCentres,
  nematodeSegmentRadius,
} from './pool-creature-shapes.js';
import { distanceBetween } from './vector-math.js';

const CLOSE_DIGITS = 9;
const { NEMATODE_LENGTH, NEMATODE_THICKNESS, NEMATODE_SEGMENT_COUNT, COPEPOD_SPEED, COPEPOD_LANE_WIDTH } =
  DEFAULT_BALANCE.poolCreatures;
const CENTRE = { x: 100, y: 50 };
/** A pass heading due east from the west rim, its head at the start on tick 600. */
const LANE: CopepodLaneView = { startX: -3_000, startY: 200, directionX: 1, directionY: 0, startedAtTick: 600 };
const PER_TICK = COPEPOD_SPEED / TICK_HZ;
const MASS = 480;

/** The defaults with the creatures' leaves `patch` writes. */
function withCreatures(patch: (creatures: BalanceConfig['poolCreatures']) => void): BalanceConfig {
  const patched = structuredClone(DEFAULT_BALANCE);
  patch(patched.poolCreatures);
  return patched;
}

function creature(species: PoolCreatureView['species'], isLandmark = false): PoolCreatureView {
  return { species, isLandmark, headingRadians: 0 };
}

describe('the nematode’s chain', () => {
  it('lays NEMATODE_SEGMENT_COUNT circles of half its thickness, tail to head along its heading, centred on it', () => {
    const centres = nematodeSegmentCentres(CENTRE, 0, DEFAULT_BALANCE);
    const reach = NEMATODE_LENGTH / 2 - NEMATODE_THICKNESS / 2;
    expect(nematodeSegmentRadius(DEFAULT_BALANCE)).toBe(NEMATODE_THICKNESS / 2);
    expect(centres).toHaveLength(NEMATODE_SEGMENT_COUNT);
    expect(centres[0]!.x).toBeCloseTo(CENTRE.x - reach, CLOSE_DIGITS);
    expect(centres.at(-1)!.x).toBeCloseTo(CENTRE.x + reach, CLOSE_DIGITS);
    for (const centre of centres) expect(centre.y).toBeCloseTo(CENTRE.y, CLOSE_DIGITS);
    const gaps = centres.slice(1).map((centre, index) => distanceBetween(centres[index]!, centre));
    for (const gap of gaps) expect(gap).toBeCloseTo((2 * reach) / (NEMATODE_SEGMENT_COUNT - 1), CLOSE_DIGITS);
  });

  it('keeps every circle inside its bounding radius, the end rims touching it, at any heading', () => {
    const bound = nematodeBoundingRadius(DEFAULT_BALANCE);
    expect(bound).toBe(NEMATODE_LENGTH / 2);
    const centres = nematodeSegmentCentres(CENTRE, 2.3, DEFAULT_BALANCE);
    const rims = centres.map((centre) => distanceBetween(CENTRE, centre) + nematodeSegmentRadius(DEFAULT_BALANCE));
    for (const rim of rims) expect(rim).toBeLessThanOrEqual(bound + 1e-9);
    expect(Math.max(...rims)).toBeCloseTo(bound, CLOSE_DIGITS);
  });

  it('turns with its heading: a quarter turn lays it tail south, head north', () => {
    const centres = nematodeSegmentCentres(CENTRE, Math.PI / 2, DEFAULT_BALANCE);
    for (const centre of centres) expect(centre.x).toBeCloseTo(CENTRE.x, CLOSE_DIGITS);
    expect(centres[0]!.y).toBeLessThan(CENTRE.y);
    expect(centres.at(-1)!.y).toBeGreaterThan(CENTRE.y);
  });

  it('reads the live balance: a patched count and length lay a different chain, and one circle sits on the centre', () => {
    const longer = withCreatures((creatures) => {
      creatures.NEMATODE_LENGTH = 2 * NEMATODE_LENGTH;
      creatures.NEMATODE_SEGMENT_COUNT = 3;
    });
    expect(nematodeSegmentCentres(CENTRE, 0, longer).map((centre) => centre.x)).toEqual([
      CENTRE.x - (NEMATODE_LENGTH - NEMATODE_THICKNESS / 2),
      CENTRE.x,
      CENTRE.x + (NEMATODE_LENGTH - NEMATODE_THICKNESS / 2),
    ]);
    expect(
      nematodeSegmentCentres(
        CENTRE,
        0,
        withCreatures((creatures) => (creatures.NEMATODE_SEGMENT_COUNT = 1)),
      ),
    ).toEqual([CENTRE]);
  });
});

describe('cellRadiusOf', () => {
  it('is the mass’s radius for every cell that is not a creature, and for a Didinium and a roaming rotifer', () => {
    const massRadius = radiusForMass(MASS, DEFAULT_BALANCE.growth);
    expect(cellRadiusOf({ mass: MASS, poolCreature: null }, DEFAULT_BALANCE)).toBe(massRadius);
    expect(cellRadiusOf({ mass: MASS, poolCreature: creature('didinium') }, DEFAULT_BALANCE)).toBe(massRadius);
    expect(cellRadiusOf({ mass: MASS, poolCreature: creature('rotifer') }, DEFAULT_BALANCE)).toBe(massRadius);
  });

  it('is the footprint’s radius for the landmark, whatever its mass, and follows a patched scale step', () => {
    const landmark = creature(POOL_CREATURE_SPECIES.rotifer, true);
    const footprint = DEFAULT_BALANCE.world.DISH_RADIUS / DEFAULT_BALANCE.eras.ERA_SCALE_STEP;
    expect(cellRadiusOf({ mass: MASS, poolCreature: landmark }, DEFAULT_BALANCE)).toBe(footprint);
    expect(cellRadiusOf({ mass: 1, poolCreature: landmark }, DEFAULT_BALANCE)).toBe(footprint);
    const doubled = structuredClone(DEFAULT_BALANCE);
    doubled.eras.ERA_SCALE_STEP *= 2;
    expect(cellRadiusOf({ mass: MASS, poolCreature: landmark }, doubled)).toBe(footprint / 2);
  });

  it('is the bounding radius for a nematode, whatever its mass', () => {
    const nematode = creature(POOL_CREATURE_SPECIES.nematode);
    expect(cellRadiusOf({ mass: MASS, poolCreature: nematode }, DEFAULT_BALANCE)).toBe(NEMATODE_LENGTH / 2);
    expect(cellRadiusOf({ mass: 1, poolCreature: nematode }, DEFAULT_BALANCE)).toBe(NEMATODE_LENGTH / 2);
  });
});

describe('the copepod’s pass', () => {
  it('puts the head at the start on its start tick and a second’s run along the lane a second later', () => {
    expect(copepodHeadAt(LANE, LANE.startedAtTick, DEFAULT_BALANCE)).toEqual({ x: LANE.startX, y: LANE.startY });
    const later = copepodHeadAt(LANE, LANE.startedAtTick + TICK_HZ, DEFAULT_BALANCE);
    expect(later.x).toBeCloseTo(LANE.startX + COPEPOD_SPEED, CLOSE_DIGITS);
    expect(later.y).toBeCloseTo(LANE.startY, CLOSE_DIGITS);
  });

  it('sweeps one tick’s run per tick: the strip runs from the head on the tick before to the head on the tick', () => {
    const tick = LANE.startedAtTick + 10;
    const strip = copepodStripAt(LANE, tick, DEFAULT_BALANCE);
    expect(strip.from).toEqual(copepodHeadAt(LANE, tick - 1, DEFAULT_BALANCE));
    expect(strip.to).toEqual(copepodHeadAt(LANE, tick, DEFAULT_BALANCE));
    expect(distanceBetween(strip.from, strip.to)).toBeCloseTo(PER_TICK, CLOSE_DIGITS);
    expect(strip.halfWidth).toBe(COPEPOD_LANE_WIDTH / 2);
    const next = copepodStripAt(LANE, tick + 1, DEFAULT_BALANCE);
    expect(next.from).toEqual(strip.to);
  });

  it('bounds the strip by its run grown by half the lane’s width each way, along a diagonal lane too', () => {
    const half = COPEPOD_LANE_WIDTH / 2;
    const east = copepodStripBounds({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, halfWidth: half });
    expect(east).toEqual({ minX: -half, minY: -half, maxX: 10 + half, maxY: half });
    const southWest = copepodStripBounds({ from: { x: 10, y: 10 }, to: { x: 0, y: 0 }, halfWidth: half });
    expect(southWest).toEqual({ minX: -half, minY: -half, maxX: 10 + half, maxY: 10 + half });
  });

  it('reads the live speed and lane width', () => {
    const fast = withCreatures((creatures) => {
      creatures.COPEPOD_SPEED = 2 * COPEPOD_SPEED;
      creatures.COPEPOD_LANE_WIDTH = 100;
    });
    const strip = copepodStripAt(LANE, LANE.startedAtTick + 1, fast);
    expect(distanceBetween(strip.from, strip.to)).toBeCloseTo(2 * PER_TICK, CLOSE_DIGITS);
    expect(strip.halfWidth).toBe(50);
  });
});
