// @vitest-environment node
// The planet's render resolution (docs/rendering/opening-dive.md §4): the mockup's caps under the upper bands' ratio.

import { describe, expect, it } from 'vitest';
import { divePlanetRatioAt } from './dive-planet-resolution';

describe('divePlanetRatioAt', () => {
  it('draws the sphere at up to 1.5× and the forest under the shore at 1×, never past the upper bands’ ratio', () => {
    expect(divePlanetRatioAt(7, 2)).toBe(1.5);
    expect(divePlanetRatioAt(7, 1)).toBe(1);
    expect(divePlanetRatioAt(4, 2)).toBe(1);
    // The governor's canvas at 0.6: the planet follows it down.
    expect(divePlanetRatioAt(7, 0.6)).toBe(0.6);
  });
});
