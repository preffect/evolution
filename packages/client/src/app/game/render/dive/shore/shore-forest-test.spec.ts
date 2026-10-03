// The planet's forest test (docs/rendering/opening-dive.md §3, the mockup's `glOn`): off with the planet's band, on
// far out, and close in on only where some of the view lies past the rock band, measured on the shore's test coast
// (land to the north of the focus, a wavy coast through it).

import { describe, expect, it } from 'vitest';
import { TEST_SHORE_LAND } from '../../../../../testing/shore-paint-builder';
import { diveViewAt } from '../dive-view';
import { ShoreCoast } from './shore-coast';
import { ShoreForestTest } from './shore-forest-test';

const view = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

describe('ShoreForestTest', () => {
  const subject = new ShoreForestTest(new ShoreCoast(TEST_SHORE_LAND));

  it('never shows the forest once the planet’s band has stopped, and always far out', () => {
    expect(view(1).bands.planet.isActive).toBe(false);
    expect(subject.isShown(view(1))).toBe(false);
    expect(subject.isShown(view(3))).toBe(true);
    expect(subject.isShown(view(5))).toBe(true);
  });

  it('shows it close in while part of the view lies past the rock band, and not once all of it is on the shore', () => {
    expect(subject.isShown(view(2.2))).toBe(true);
    expect(subject.isShown(view(1.4))).toBe(false);
  });
});
