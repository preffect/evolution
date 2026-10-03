// The Salish rings in plane metres round the focus (docs/rendering/opening-dive.md §4, ticket #801): the same
// orthographic projection the planet uses (`d3.geoOrthographic().rotate([−λ₀, −φ₀]).scale(R_EARTH)`), so the handoff
// from the planet to the shore lines up. Made once per page from the coastline file the dive loads.

import { DIVE_FOCUS_DEGREES, EARTH_RADIUS_M } from '../../constants/dive';
import {
  SHORE_COAST_ZERO_M,
  SHORE_LAND_PROBE_NORTH_M,
  SHORE_RING_MIN_COORDINATES,
} from '../../constants/dive-shore-coast';
import { degreesToRadians } from '../../geometry';
import type { DiveCoastRing } from '../planet/dive-planet-bakes';
import { POINT_STRIDE, pointCount, pointX, pointY } from './shore-points';

/** One coastline ring: `[longitude, latitude]` pairs in degrees, closed (the dive's coastline file). */
export type GeoRing = DiveCoastRing;

/** A ring in metres: flat `[x, y, …]` (x east, y south), its winding and box, and which segments are not coast. */
export interface LandRing {
  readonly points: Float64Array;
  readonly count: number;
  /** The sign of its shoelace area. */
  readonly winding: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** Its own seed: index + 1. */
  readonly id: number;
  /** 1 where segment i runs along the box the data was cut to: no surf, rock or refinement there. */
  readonly isBoxEdge: Uint8Array;
}

export interface LandRings {
  readonly rings: readonly LandRing[];
  /** +1 or −1: which side of a ring is land, calibrated on the ring through the focus. */
  readonly landSide: number;
}

interface GeoBox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/** The orthographic projection at the focus, in metres with y south; `[0, 0]` is the focus. */
export function projectToFocus(longitude: number, latitude: number): readonly [number, number] {
  const deltaLongitude = degreesToRadians(longitude - DIVE_FOCUS_DEGREES.longitude);
  const phi = degreesToRadians(latitude);
  const focusPhi = degreesToRadians(DIVE_FOCUS_DEGREES.latitude);
  const x = EARTH_RADIUS_M * Math.cos(phi) * Math.sin(deltaLongitude);
  const north =
    EARTH_RADIUS_M *
    (Math.sin(phi) * Math.cos(focusPhi) - Math.cos(phi) * Math.cos(deltaLongitude) * Math.sin(focusPhi));
  return [roundTinyToZero(x), roundTinyToZero(-north)];
}

function roundTinyToZero(metres: number): number {
  return Math.abs(metres) < SHORE_COAST_ZERO_M ? 0 : metres;
}

function boxOf(rings: readonly GeoRing[]): GeoBox {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      west = Math.min(west, longitude);
      south = Math.min(south, latitude);
      east = Math.max(east, longitude);
      north = Math.max(north, latitude);
    }
  }
  return { west, south, east, north };
}

/** The ring's points in metres, without repeats and without the closing point. */
function projectRing(ring: GeoRing): number[] {
  const points: number[] = [];
  for (const [longitude, latitude] of ring) {
    const [x, y] = projectToFocus(longitude, latitude);
    const last = pointCount(points) - 1;
    if (last >= 0 && pointX(points, last) === x && pointY(points, last) === y) continue;
    points.push(x, y);
  }
  const last = pointCount(points) - 1;
  if (last > 0 && pointX(points, 0) === pointX(points, last) && pointY(points, 0) === pointY(points, last))
    points.length -= POINT_STRIDE;
  return points;
}

function isBoxEdge(
  start: readonly [number, number] | undefined,
  end: readonly [number, number] | undefined,
  box: GeoBox,
): boolean {
  if (start === undefined || end === undefined) return false;
  const [startLongitude, startLatitude] = start;
  const [endLongitude, endLatitude] = end;
  const isMeridianEdge =
    startLongitude === endLongitude && (startLongitude === box.west || startLongitude === box.east);
  const isParallelEdge = startLatitude === endLatitude && (startLatitude === box.south || startLatitude === box.north);
  return isMeridianEdge || isParallelEdge;
}

function landRing(ring: GeoRing, index: number, box: GeoBox): LandRing | null {
  const points = projectRing(ring);
  if (points.length < SHORE_RING_MIN_COORDINATES) return null;
  const count = pointCount(points);
  let area = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const edges = new Uint8Array(count);
  for (let point = 0; point < count; point += 1) {
    const next = (point + 1) % count;
    const x = pointX(points, point);
    const y = pointY(points, point);
    area += x * pointY(points, next) - pointX(points, next) * y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    edges[point] = isBoxEdge(ring[point], ring[(point + 1) % ring.length], box) ? 1 : 0;
  }
  const winding = Math.sign(area);
  return { points: Float64Array.from(points), count, winding, minX, minY, maxX, maxY, id: index + 1, isBoxEdge: edges };
}

/** Which side is land: the ring through the focus has its land to the north (`landSide`). */
function landSideOf(rings: readonly LandRing[]): number {
  for (const ring of rings) {
    for (let point = 0; point < ring.count; point += 1) {
      if (pointX(ring.points, point) !== 0 || pointY(ring.points, point) !== 0) continue;
      const next = (point + 1) % ring.count;
      const cross = pointX(ring.points, next) * -SHORE_LAND_PROBE_NORTH_M;
      return Math.sign(cross) * ring.winding;
    }
  }
  return 1;
}

/** The coastline file's rings in metres round the focus, and which side of them is land. */
export function landRingsOf(geoRings: readonly GeoRing[]): LandRings {
  const box = boxOf(geoRings);
  const rings: LandRing[] = [];
  geoRings.forEach((ring, index) => {
    const land = landRing(ring, index, box);
    if (land !== null) rings.push(land);
  });
  return { rings, landSide: landSideOf(rings) };
}
