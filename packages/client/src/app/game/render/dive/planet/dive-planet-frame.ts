// The planet shader's frame (docs/rendering/opening-dive.md §4, the mockup's `Globe.draw`): what it is told each frame,
// worked out from the dive's camera, and the TypeScript reference of where a pixel lands on the Earth. Far out the
// shader ray-casts an orthographic sphere that matches `d3.geoOrthographic` turned by the dive's rotation, so the
// labels (`dive-labels.ts`) and the coast in metres sit on it; close in it draws plane metres round the focus.
// `divePlanetEarthPointAt` is the shader's `main` term for term, which is how a spec pins the labels to the sphere.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  DIVE_FOCUS_DEGREES,
  DIVE_PLANET_CLOUD_FADE,
  DIVE_PLANET_CROWN_FADE,
  DIVE_PLANET_LAND_EDGE_FADE,
  DIVE_PLANET_PLANE_BELOW_ZOOM,
  DIVE_PLANET_REGION_DETAIL_FADE,
  DIVE_PLANET_RELIEF_EXAGGERATION,
  DIVE_PLANET_RELIEF_FADE,
  DIVE_PLANET_SUN_DIRECTION,
  EARTH_RADIUS_M,
  type DivePlanetFade,
} from '../../constants';
import { HALF, degreesToRadians, smoothstep } from '../../geometry';
import type { DiveCamera } from '../dive-camera';

export interface DivePlanetFrameInputs {
  readonly camera: DiveCamera;
  /** The planet's rotation as d3 takes it, `[λ, φ]` degrees (`diveGlobeRotation`). */
  readonly globeRotation: readonly [number, number];
  readonly timeSeconds: number;
  /** The planet's render texels per CSS px. */
  readonly ratio: number;
  readonly isRegionReady: boolean;
  /** How far the world's full bake has come up over its quick one, 0 → 1 (`DiveGlobeCrossfade`). */
  readonly worldFineWeight: number;
}

/** What the shader is told each frame; each field is one uniform (`DIVE_PLANET_UNIFORM`). */
export interface DivePlanetFrame {
  readonly resolutionPx: readonly [number, number];
  /** The Earth's radius in render pixels. */
  readonly radiusPx: number;
  readonly metresPerPixel: number;
  /** 1 below `DIVE_PLANET_PLANE_BELOW_ZOOM`, where the shader draws plane metres round the focus. */
  readonly isPlane: number;
  readonly timeSeconds: number;
  readonly landEdge: number;
  readonly clouds: number;
  readonly regionDetail: number;
  readonly crowns: number;
  readonly reliefExaggeration: number;
  /** The view's axes (out of the screen, right, up) on the Earth: column-major, as a `mat3` takes it. */
  readonly viewToEarth: Float32Array;
  readonly isRegionReady: number;
  readonly worldFineWeight: number;
}

/** A point on the Earth in radians. */
export interface EarthPoint {
  readonly longitude: number;
  readonly latitude: number;
}

/** A `mat3`'s rows and columns. */
const MAT3_DIMENSION = 3;

/** The sun, normalised: the shader's light (`sun`). */
export const DIVE_PLANET_SUN: readonly [number, number, number] = ((): readonly [number, number, number] => {
  const { x, y, z } = DIVE_PLANET_SUN_DIRECTION;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
})();

/** The focus in radians, `[λ, φ]` (`uC`). */
export const DIVE_PLANET_FOCUS_RADIANS: readonly [number, number] = [
  degreesToRadians(DIVE_FOCUS_DEGREES.longitude),
  degreesToRadians(DIVE_FOCUS_DEGREES.latitude),
];

/** The focus as a unit vector on the Earth (`eC`): the clouds keep clear of it. */
export const DIVE_PLANET_FOCUS_EARTH: readonly [number, number, number] = [
  Math.cos(DIVE_PLANET_FOCUS_RADIANS[1]) * Math.cos(DIVE_PLANET_FOCUS_RADIANS[0]),
  Math.cos(DIVE_PLANET_FOCUS_RADIANS[1]) * Math.sin(DIVE_PLANET_FOCUS_RADIANS[0]),
  Math.sin(DIVE_PLANET_FOCUS_RADIANS[1]),
];

/** The ground a texel of a `width`-texel equirectangular world bake spans at the equator, in metres. */
export function diveWorldTexelMetres(width: number): number {
  return (RADIANS_PER_FULL_TURN * EARTH_RADIUS_M) / width;
}

export function isDivePlanetPlane(zoom: number): boolean {
  return zoom < DIVE_PLANET_PLANE_BELOW_ZOOM;
}

function faded(fade: DivePlanetFade, zoom: number): number {
  return smoothstep(fade.fromZoom, fade.toZoom, zoom);
}

/**
 * The view's axes on the Earth for d3's rotation `[λ, φ]` (`uInv`): M = Ry(φ)·Rz(λ) takes the Earth to the view, and
 * its transpose, column-major, is its rows.
 */
export function divePlanetViewToEarth(rotation: readonly [number, number]): Float32Array {
  const lambda = degreesToRadians(rotation[0]);
  const phi = degreesToRadians(rotation[1]);
  const [cosLambda, sinLambda, cosPhi, sinPhi] = [Math.cos(lambda), Math.sin(lambda), Math.cos(phi), Math.sin(phi)];
  const matrix = new Float32Array(MAT3_DIMENSION * MAT3_DIMENSION);
  matrix.set([
    cosPhi * cosLambda,
    -cosPhi * sinLambda,
    -sinPhi,
    sinLambda,
    cosLambda,
    0,
    sinPhi * cosLambda,
    -sinPhi * sinLambda,
    cosPhi,
  ]);
  return matrix;
}

/** The planet's render size in pixels: the view at `ratio`, at least one pixel each way. */
export function divePlanetResolutionPx(camera: DiveCamera, ratio: number): readonly [number, number] {
  return [
    Math.max(1, Math.round(camera.viewport.width * ratio)),
    Math.max(1, Math.round(camera.viewport.height * ratio)),
  ];
}

export function divePlanetFrame(inputs: DivePlanetFrameInputs): DivePlanetFrame {
  const { camera, ratio } = inputs;
  const zoom = camera.zoom;
  const pixelsPerMetre = camera.pixelsPerMetre * ratio;
  return {
    resolutionPx: divePlanetResolutionPx(camera, ratio),
    radiusPx: EARTH_RADIUS_M * pixelsPerMetre,
    metresPerPixel: pixelsPerMetre > 0 ? 1 / pixelsPerMetre : 0,
    isPlane: isDivePlanetPlane(zoom) ? 1 : 0,
    timeSeconds: inputs.timeSeconds,
    landEdge: faded(DIVE_PLANET_LAND_EDGE_FADE, zoom),
    clouds: faded(DIVE_PLANET_CLOUD_FADE, zoom),
    regionDetail: faded(DIVE_PLANET_REGION_DETAIL_FADE, zoom),
    crowns: faded(DIVE_PLANET_CROWN_FADE, zoom),
    reliefExaggeration:
      DIVE_PLANET_RELIEF_EXAGGERATION.near +
      (DIVE_PLANET_RELIEF_EXAGGERATION.far - DIVE_PLANET_RELIEF_EXAGGERATION.near) *
        faded(DIVE_PLANET_RELIEF_FADE, zoom),
    viewToEarth: divePlanetViewToEarth(inputs.globeRotation),
    isRegionReady: inputs.isRegionReady ? 1 : 0,
    worldFineWeight: inputs.worldFineWeight,
  };
}

/** `matrix · vector` for a column-major `mat3`, as GLSL multiplies. */
function times(matrix: Float32Array, vector: readonly [number, number, number]): [number, number, number] {
  const product: [number, number, number] = [0, 0, 0];
  for (let row = 0; row < MAT3_DIMENSION; row += 1) {
    for (let column = 0; column < MAT3_DIMENSION; column += 1) {
      product[row] = product[row]! + matrix[column * MAT3_DIMENSION + row]! * vector[column]!;
    }
  }
  return product;
}

/**
 * Where the render pixel `fragmentPx` lands on the Earth, as the shader's `main` finds it; `fragmentPx` is from the
 * render's centre, x right and y up. `null` off the sphere (space).
 */
export function divePlanetEarthPointAt(
  frame: DivePlanetFrame,
  fragmentPx: readonly [number, number],
): EarthPoint | null {
  const [focusLongitude, focusLatitude] = DIVE_PLANET_FOCUS_RADIANS;
  if (frame.isPlane === 1) {
    const [east, north] = [fragmentPx[0] * frame.metresPerPixel, fragmentPx[1] * frame.metresPerPixel];
    return {
      latitude: focusLatitude + north / EARTH_RADIUS_M,
      longitude: focusLongitude + east / (EARTH_RADIUS_M * Math.cos(focusLatitude)),
    };
  }
  const [x, y] = [fragmentPx[0] / frame.radiusPx, fragmentPx[1] / frame.radiusPx];
  const radiusSquared = x * x + y * y;
  if (radiusSquared > 1) return null;
  const [earthX, earthY, earthZ] = times(frame.viewToEarth, [Math.sqrt(1 - radiusSquared), x, y]);
  return { latitude: Math.asin(Math.min(1, Math.max(-1, earthZ))), longitude: Math.atan2(earthY, earthX) };
}

/** A CSS px point of the view (from its top-left, y down) as the shader's fragment offset at `ratio`. */
export function divePlanetFragmentOf(
  camera: DiveCamera,
  ratio: number,
  point: { x: number; y: number },
): [number, number] {
  return [(point.x - camera.viewport.width * HALF) * ratio, (camera.viewport.height * HALF - point.y) * ratio];
}
