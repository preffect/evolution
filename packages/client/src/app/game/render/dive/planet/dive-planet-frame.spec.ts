// @vitest-environment node
// The planet shader's frame (docs/rendering/opening-dive.md §4): the mockup's fades and scale, and the TypeScript
// reference of the shader's projection. The load-bearing guard: every place name's dot (`dive-labels.ts`, on
// d3's orthographic) lands on the shader's sphere at that very place, at every zoom the planet's names show.

import { describe, expect, it } from 'vitest';
import { DIVE_FOCUS_DEGREES, DIVE_GEO_LABELS, EARTH_RADIUS_M } from '../../constants';
import { degreesToRadians } from '../../geometry';
import { diveCameraAt, diveGlobeRotation } from '../dive-camera';
import { diveLabelPlacements } from '../dive-labels';
import {
  DIVE_PLANET_FOCUS_RADIANS,
  divePlanetEarthPointAt,
  divePlanetFragmentOf,
  divePlanetFrame,
  divePlanetResolutionPx,
  type DivePlanetFrame,
} from './dive-planet-frame';

const VIEWPORT = { width: 830, height: 467 };
/** Half a render pixel, as an angle on the sphere at orbit: the dot may be off by its rounding, not more. */
const ARC_TOLERANCE_RADIANS = 1e-3;

function frameAt(zoom: number, ratio = 1.5, globeIdleSpinDegrees = 0): DivePlanetFrame {
  return divePlanetFrame({
    camera: diveCameraAt(zoom, VIEWPORT),
    globeRotation: diveGlobeRotation(zoom, globeIdleSpinDegrees),
    timeSeconds: 2,
    ratio,
    isRegionReady: true,
    worldFineWeight: 1,
  });
}

/** The great-circle angle between two points. */
function arcBetween(first: { longitude: number; latitude: number }, second: { longitude: number; latitude: number }) {
  const cosine =
    Math.sin(first.latitude) * Math.sin(second.latitude) +
    Math.cos(first.latitude) * Math.cos(second.latitude) * Math.cos(first.longitude - second.longitude);
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

describe('divePlanetFrame', () => {
  it('holds the mockup’s fades: clouds out by 6.1, the region’s detail in by 6.1, crowns in by 3.35', () => {
    expect(frameAt(7.3)).toMatchObject({ clouds: 1, regionDetail: 0, crowns: 0, landEdge: 1, isPlane: 0 });
    expect(frameAt(6.1)).toMatchObject({ clouds: 0, regionDetail: 1 });
    expect(frameAt(4.5)).toMatchObject({ isPlane: 0, landEdge: expect.closeTo(0.352, 3) as number });
    expect(frameAt(4.4)).toMatchObject({ isPlane: 1, landEdge: 0, crowns: 0 });
    expect(frameAt(3.35).crowns).toBe(1);
    expect(frameAt(3.8).reliefExaggeration).toBe(3.4);
    expect(frameAt(6.6).reliefExaggeration).toBe(4.2);
  });

  it('scales the Earth to the camera at the render’s ratio', () => {
    const frame = frameAt(7.3, 1.5);
    const camera = diveCameraAt(7.3, VIEWPORT);
    expect(frame.radiusPx).toBeCloseTo(EARTH_RADIUS_M * camera.pixelsPerMetre * 1.5, 6);
    expect(frame.metresPerPixel).toBeCloseTo(1 / (camera.pixelsPerMetre * 1.5), 9);
    expect(frame.resolutionPx).toEqual([1245, 701]);
    expect(divePlanetResolutionPx(diveCameraAt(5, { width: 0, height: 0 }), 1)).toEqual([1, 1]);
  });
});

describe('divePlanetEarthPointAt', () => {
  it('puts every place name’s dot on the sphere at its own place, as the planet turns and spins', () => {
    let checked = 0;
    for (const spin of [0, 40]) {
      for (let zoom = 7.4; zoom >= 4.6; zoom -= 0.1) {
        const camera = diveCameraAt(zoom, VIEWPORT);
        const globeRotation = diveGlobeRotation(zoom, spin);
        const frame = frameAt(zoom, 1.5, spin);
        for (const placement of diveLabelPlacements({ camera, globeRotation, worldWeight: 0 })) {
          const label = DIVE_GEO_LABELS.find((candidate) => candidate.text === placement.text)!;
          const point = divePlanetEarthPointAt(
            frame,
            divePlanetFragmentOf(camera, 1.5, { x: placement.dotX, y: placement.dotY }),
          );
          // Two labels share a text (the Pacific): the dot is on one of them.
          const nearest = Math.min(
            ...DIVE_GEO_LABELS.filter((candidate) => candidate.text === label.text).map((candidate) =>
              arcBetween(point!, {
                longitude: degreesToRadians(candidate.longitude),
                latitude: degreesToRadians(candidate.latitude),
              }),
            ),
          );
          expect(point, placement.text).not.toBeNull();
          expect(nearest, `${placement.text} at ${zoom.toFixed(1)}`).toBeLessThan(ARC_TOLERANCE_RADIANS);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('looks at the focus once the planet has turned, and finds space off the sphere', () => {
    const frame = frameAt(6.7);
    const centre = divePlanetEarthPointAt(frame, [0, 0])!;
    expect(centre.longitude).toBeCloseTo(degreesToRadians(DIVE_FOCUS_DEGREES.longitude), 6);
    expect(centre.latitude).toBeCloseTo(degreesToRadians(DIVE_FOCUS_DEGREES.latitude), 6);
    const orbit = frameAt(7.3);
    expect(divePlanetEarthPointAt(orbit, [orbit.radiusPx * 1.01, 0])).toBeNull();
  });

  it('draws plane metres round the focus close in: north is up, a metre east is a metre on the ground', () => {
    const frame = frameAt(3, 1);
    const north = divePlanetEarthPointAt(frame, [0, 100 / frame.metresPerPixel])!;
    expect(north.latitude - DIVE_PLANET_FOCUS_RADIANS[1]).toBeCloseTo(100 / EARTH_RADIUS_M, 12);
    expect(north.longitude).toBeCloseTo(DIVE_PLANET_FOCUS_RADIANS[0], 12);
    const east = divePlanetEarthPointAt(frame, [100 / frame.metresPerPixel, 0])!;
    const metresEast =
      (east.longitude - DIVE_PLANET_FOCUS_RADIANS[0]) * EARTH_RADIUS_M * Math.cos(DIVE_PLANET_FOCUS_RADIANS[1]);
    expect(metresEast).toBeCloseTo(100, 6);
  });
});
