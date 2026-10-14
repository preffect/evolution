// @vitest-environment node
// Where the planet draws the Salish region's own land (docs/rendering/opening-dive.md §4, ticket #817): full round
// the focus, gone before the region's box ends, and never shaped like the box. The mockup feathered the box itself,
// so from about 2,300 km down to 1,000 km its relief and dry side read as a soft rectangle against the world's green.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIVE_FOCUS_DEGREES, DIVE_SALISH_RINGS_URL } from '../../constants';
import { repoPath } from '../../../../../testing/repo-document';
import { diveRegionBox, type DiveCoastRing, type DiveRegionBox } from './dive-planet-bakes';
import { DIVE_REGION_DETAIL_MASK_SOURCE, diveRegionDetailMask } from './dive-planet-region-mask';
import { DIVE_PLANET_FRAGMENT_SOURCE } from './dive-planet-shader';

/** The edge noise at its two extremes and between. */
const WARP_NOISES = [0, 0.5, 1] as const;
const SAMPLES_PER_SIDE = 40;
/** A line parallel to the box's east edge, inside it, where the mockup's feather had not begun. */
const NEAR_EDGE = 0.85;

/** The box unit of a distance from the box's middle (0 → 1), each way. */
function unitOf(fromMiddle: number): number {
  return (fromMiddle + 1) / 2;
}

function regionBox(): DiveRegionBox {
  const path = repoPath(`packages/client/src/${DIVE_SALISH_RINGS_URL}`);
  return diveRegionBox(JSON.parse(readFileSync(path, 'utf8')) as DiveCoastRing[]);
}

describe('the region detail mask', () => {
  it('is full at the focus, whatever the edge noise', () => {
    const box = regionBox();
    const focusUnit: [number, number] = [
      (DIVE_FOCUS_DEGREES.longitude - box.west) / (box.east - box.west),
      (box.north - DIVE_FOCUS_DEGREES.latitude) / (box.north - box.south),
    ];
    for (const noise of WARP_NOISES) expect(diveRegionDetailMask(focusUnit, noise), `noise ${noise}`).toBe(1);
  });

  it('is gone on and past the box’s edge, whatever the edge noise', () => {
    for (const noise of WARP_NOISES) {
      for (let step = 0; step <= SAMPLES_PER_SIDE; step += 1) {
        const along = step / SAMPLES_PER_SIDE;
        for (const point of [
          [0, along],
          [1, along],
          [along, 0],
          [along, 1],
          [-0.1, along],
          [along, 1.1],
        ] as const) {
          expect(diveRegionDetailMask(point, noise), `${point.join(',')} noise ${noise}`).toBe(0);
        }
      }
    }
  });

  it('has no straight edge: along a line by the box’s edge it fades out toward the corner', () => {
    const middle = diveRegionDetailMask([unitOf(NEAR_EDGE), unitOf(0)], 0);
    const corner = diveRegionDetailMask([unitOf(NEAR_EDGE), unitOf(NEAR_EDGE)], 0);
    expect(middle).toBeGreaterThan(0);
    expect(corner).toBe(0);
  });

  it('lets the noise move its edge, so the edge is ragged', () => {
    const edge: [number, number] = [unitOf(0.8), unitOf(0)];
    expect(diveRegionDetailMask(edge, 0) - diveRegionDetailMask(edge, 1)).toBeGreaterThan(0.25);
  });

  it('is what the planet shader weighs the region’s land by, apart from its coast', () => {
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(DIVE_REGION_DETAIL_MASK_SOURCE);
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain('detailWeight = regionDetailMask(ru, ');
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toMatch(/land = mix\(land, mix\(land, rc \* shade, \w+\), detailWeight\);/);
  });
});
