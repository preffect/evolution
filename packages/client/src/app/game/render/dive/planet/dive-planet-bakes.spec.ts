// @vitest-environment node
// The planet's coastline bakes (docs/rendering/opening-dive.md §4) over small rings: the world's equirectangular bake
// with its rings cut at the antimeridian, and the region's over its own box, whose clipped edges are not coast.

import { describe, expect, it } from 'vitest';
import { DIVE_PLANET_REGION_BAKE_WIDTH_PX, DIVE_PLANET_WORLD_PREVIEW_BAKE_PX, EARTH_RADIUS_M } from '../../constants';
import { createDivePlanetBakePlan, diveRegionBox, type DiveCoastRing, type DivePlanetBake } from './dive-planet-bakes';
import { decodeSignedDistance } from './signed-distance';

function finished(job: Generator<void, DivePlanetBake>): DivePlanetBake {
  for (let step = job.next(); ; step = job.next()) if (step.done === true) return step.value;
}

/** A closed box ring, anticlockwise on the map (as Natural Earth winds land). */
function box(west: number, south: number, east: number, north: number): DiveCoastRing {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/** The texel of the world bake at a longitude and latitude. */
function worldTexel(bake: DivePlanetBake, longitude: number, latitude: number): number {
  const column = Math.floor(((longitude + 180) / 360) * bake.width);
  const row = Math.floor(((90 - latitude) / 180) * bake.height);
  return row * bake.width + column;
}

describe('diveRegionBox', () => {
  it('is the extent of the region’s rings', () => {
    expect(diveRegionBox([box(-125, 47, -122, 49), box(-121, 46, -120, 48)])).toEqual({
      west: -125,
      south: 46,
      east: -120,
      north: 49,
    });
  });
});

describe('the world’s quick bake', () => {
  const continent = box(-20, -10, 40, 30);
  const islands = box(170, -20, 190, -10).map(([longitude, latitude]) => [
    longitude > 180 ? longitude - 360 : longitude,
    latitude,
  ]) as DiveCoastRing;

  it('is land inside the rings and sea outside, the distance growing from the coast', () => {
    const bake = finished(createDivePlanetBakePlan([continent], [continent]).worldPreview());
    expect([bake.width, bake.height]).toEqual([
      DIVE_PLANET_WORLD_PREVIEW_BAKE_PX.width,
      DIVE_PLANET_WORLD_PREVIEW_BAKE_PX.height,
    ]);
    expect(bake.metresPerTexel).toBeCloseTo((2 * Math.PI * EARTH_RADIUS_M) / bake.width, 6);
    expect(decodeSignedDistance(bake.data, worldTexel(bake, 10, 10))).toBeGreaterThan(20);
    expect(decodeSignedDistance(bake.data, worldTexel(bake, -100, 10))).toBeLessThan(-50);
    expect(Math.abs(decodeSignedDistance(bake.data, worldTexel(bake, 40, 10)))).toBeLessThan(1.5);
  });

  it('cuts a ring across the antimeridian there, so it never smears land round the planet', () => {
    const bake = finished(createDivePlanetBakePlan([islands], [continent]).worldPreview());
    expect(decodeSignedDistance(bake.data, worldTexel(bake, 179, -15))).toBeGreaterThan(0);
    expect(decodeSignedDistance(bake.data, worldTexel(bake, -179, -15))).toBeGreaterThan(0);
    expect(decodeSignedDistance(bake.data, worldTexel(bake, 0, -15))).toBeLessThan(-50);
  });
});

describe('the region’s bake', () => {
  it('covers the region’s box at its own scale, and takes the box’s clipped edges for land, not coast', () => {
    // A wide, low box keeps the bake small: 10° by half a degree.
    const region = box(-125, 48, -115, 48.5);
    const bake = finished(createDivePlanetBakePlan([region], [region]).region());
    const expectedHeight = Math.round(
      (DIVE_PLANET_REGION_BAKE_WIDTH_PX * 0.5) / (10 * Math.cos((48.25 * Math.PI) / 180)),
    );
    expect([bake.width, bake.height]).toEqual([DIVE_PLANET_REGION_BAKE_WIDTH_PX, expectedHeight]);
    expect(bake.metresPerTexel).toBeCloseTo(((0.5 * Math.PI) / 180) * (EARTH_RADIUS_M / expectedHeight), 6);
    // The whole box is land and none of its edges is coast: even the corner texel is far inland.
    expect(decodeSignedDistance(bake.data, 0)).toBeGreaterThan(500);
  });
});
