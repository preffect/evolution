// The planet's coastline bakes (docs/rendering/opening-dive.md §4, the mockup's `bakeGlobal` and `bakeRegional`): the
// Natural Earth rings filled into a land mask and turned into signed distance textures the planet's shader reads
// (`signed-distance.ts`). The world's is equirectangular; the Salish region's covers its rings' box at the region's
// own scale, for the coast from about 30 km down. Each is a generator, so the dive bakes it in slices.
//
// It reaches `d3-geo`, so it loads with the dive in its lazy chunk (`dive-macro-band.ts`), never with the game.

import { geoArea, geoEquirectangular, geoPath } from 'd3-geo';
import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  DIVE_PLANET_REGION_BAKE_WIDTH_PX,
  DIVE_PLANET_WORLD_BAKE_PX,
  DIVE_PLANET_WORLD_PREVIEW_BAKE_PX,
  EARTH_RADIUS_M,
} from '../../constants';
import { DEGREES_PER_TURN, HALF, degreesToRadians } from '../../geometry';
import { LandRaster } from './land-raster';
import { bakeSignedDistance, type CoastSegment } from './signed-distance';

/** One coastline ring: `[longitude, latitude]` pairs in degrees, closed. */
export type DiveCoastRing = readonly (readonly [number, number])[];

/** A finished bake: RGBA texels of signed distance, and how many metres one texel spans on the ground. */
export interface DivePlanetBake {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly metresPerTexel: number;
}

/** The region's bake covers this box, in degrees. */
export interface DiveRegionBox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export type DivePlanetBakeJob = Generator<void, DivePlanetBake>;

/** The GeoJSON shapes `d3` is handed: one polygon per ring. */
interface Polygon {
  readonly type: 'Polygon';
  readonly coordinates: number[][][];
}
interface Feature {
  readonly type: 'Feature';
  readonly properties: null;
  readonly geometry: Polygon;
}
interface FeatureCollection {
  readonly type: 'FeatureCollection';
  readonly features: Feature[];
}

/** What the dive bakes for its planet, in the order it is needed: the world's quick bake, the world's, the region's. */
export interface DivePlanetBakePlan {
  readonly regionBox: DiveRegionBox;
  worldPreview(): DivePlanetBakeJob;
  world(): DivePlanetBakeJob;
  region(): DivePlanetBakeJob;
}

const LONGITUDE_HALF_RANGE = DEGREES_PER_TURN * HALF;
const LATITUDE_RANGE = LONGITUDE_HALF_RANGE;
const LATITUDE_TOP = LATITUDE_RANGE * HALF;
/** Rings drawn into the land mask between yields. */
const FEATURES_PER_SLICE = 32;
/** The equirectangular path's resampling, in texels (`precision(.2)`). */
const WORLD_PATH_PRECISION = 0.2;
/** A ring wound the wrong way covers more than a hemisphere: `d3` takes it as the whole sphere less the land. */
const HEMISPHERE_STERADIANS = RADIANS_PER_FULL_TURN;

/** The rings as polygons wound the way `d3` takes land (`toFeature`). */
function landFeatures(rings: readonly DiveCoastRing[]): FeatureCollection {
  const features = rings.map((ring): Feature => {
    const polygon = (coordinates: DiveCoastRing): Feature => ({
      type: 'Feature',
      properties: null,
      geometry: { type: 'Polygon', coordinates: [coordinates.map(([longitude, latitude]) => [longitude, latitude])] },
    });
    const feature = polygon(ring);
    return geoArea(feature) > HEMISPHERE_STERADIANS ? polygon([...ring].reverse()) : feature;
  });
  return { type: 'FeatureCollection', features };
}

/** The box the region's rings cover (`regionBox`). */
export function diveRegionBox(rings: readonly DiveCoastRing[]): DiveRegionBox {
  const points = rings.flat();
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}

/** The ring's consecutive pairs as segments through `toTexel`, those `isCoast` keeps. */
function segmentsOf(
  rings: readonly DiveCoastRing[],
  toTexel: (point: readonly [number, number]) => readonly [number, number],
  isCoast: (start: readonly [number, number], end: readonly [number, number]) => boolean,
): CoastSegment[] {
  const segments: CoastSegment[] = [];
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      const start = ring[index - 1]!;
      const end = ring[index]!;
      if (!isCoast(start, end)) continue;
      const [fromX, fromY] = toTexel(start);
      const [toX, toY] = toTexel(end);
      segments.push({ fromX, fromY, toX, toY });
    }
  }
  return segments;
}

function* bakeOf(
  raster: LandRaster,
  segments: readonly CoastSegment[],
  metresPerTexel: number,
): Generator<void, DivePlanetBake> {
  const mask = yield* raster.fill();
  const data = yield* bakeSignedDistance(mask, raster.width, raster.height, segments);
  return { width: raster.width, height: raster.height, data, metresPerTexel };
}

/** The world at `width × height`, equirectangular, its rings cut at the antimeridian by `d3` (`bakeGlobal`). */
function* worldBake(
  land: FeatureCollection,
  rings: readonly DiveCoastRing[],
  size: { readonly width: number; readonly height: number },
): DivePlanetBakeJob {
  const { width, height } = size;
  const raster = new LandRaster(width, height);
  const projection = geoEquirectangular()
    .scale(width / RADIANS_PER_FULL_TURN)
    .translate([width * HALF, height * HALF])
    .precision(WORLD_PATH_PRECISION);
  const path = geoPath(projection, raster);
  for (let index = 0; index < land.features.length; index += 1) {
    path(land.features[index]!);
    if (index % FEATURES_PER_SLICE === FEATURES_PER_SLICE - 1) yield;
  }
  const toTexel = ([longitude, latitude]: readonly [number, number]): readonly [number, number] => [
    ((longitude + LONGITUDE_HALF_RANGE) / DEGREES_PER_TURN) * width,
    ((LATITUDE_TOP - latitude) / LATITUDE_RANGE) * height,
  ];
  // A segment that wraps round the antimeridian is not coast.
  const segments = segmentsOf(rings, toTexel, (start, end) => Math.abs(end[0] - start[0]) < LONGITUDE_HALF_RANGE);
  return yield* bakeOf(raster, segments, (RADIANS_PER_FULL_TURN * EARTH_RADIUS_M) / width);
}

/** The region's texel rows: its width over the box's shape at its middle latitude (`RS_H`). */
function regionBakeHeight(box: DiveRegionBox): number {
  const middleLatitude = degreesToRadians((box.south + box.north) * HALF);
  const aspect = (box.north - box.south) / ((box.east - box.west) * Math.cos(middleLatitude));
  return Math.round(DIVE_PLANET_REGION_BAKE_WIDTH_PX * aspect);
}

/** The region over its box, filled nonzero; the box's clipped edges are not coast (`bakeRegional`). */
function* regionBake(rings: readonly DiveCoastRing[], box: DiveRegionBox): DivePlanetBakeJob {
  const width = DIVE_PLANET_REGION_BAKE_WIDTH_PX;
  const height = regionBakeHeight(box);
  const toTexel = ([longitude, latitude]: readonly [number, number]): readonly [number, number] => [
    ((longitude - box.west) / (box.east - box.west)) * width,
    ((box.north - latitude) / (box.north - box.south)) * height,
  ];
  const raster = new LandRaster(width, height);
  for (const ring of rings) {
    ring.forEach((point, index) => {
      const [x, y] = toTexel(point);
      if (index === 0) raster.moveTo(x, y);
      else raster.lineTo(x, y);
    });
  }
  const isBoxEdge = (start: readonly [number, number], end: readonly [number, number]): boolean =>
    (start[0] === end[0] && (start[0] === box.west || start[0] === box.east)) ||
    (start[1] === end[1] && (start[1] === box.south || start[1] === box.north));
  const segments = segmentsOf(rings, toTexel, (start, end) => !isBoxEdge(start, end));
  return yield* bakeOf(raster, segments, (degreesToRadians(box.north - box.south) * EARTH_RADIUS_M) / height);
}

export function createDivePlanetBakePlan(
  worldRings: readonly DiveCoastRing[],
  salishRings: readonly DiveCoastRing[],
): DivePlanetBakePlan {
  const land = landFeatures(worldRings);
  const regionBox = diveRegionBox(salishRings);
  return {
    regionBox,
    worldPreview: () => worldBake(land, worldRings, DIVE_PLANET_WORLD_PREVIEW_BAKE_PX),
    world: () => worldBake(land, worldRings, DIVE_PLANET_WORLD_BAKE_PX),
    region: () => regionBake(salishRings, regionBox),
  };
}
