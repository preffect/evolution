// @vitest-environment node
// The dive's labels (docs/rendering/opening-dive.md §5): place names on the turning planet, things in the world in
// metres, the fade over each range and the mockup's placement rules.

import { describe, expect, it } from 'vitest';
import { diveCameraAt, diveGlobeRotation } from './dive-camera';
import { diveGeoLabelFade, diveLabelAlpha, diveLabelPlacements, placeDiveLabel } from './dive-labels';

const VIEWPORT = { width: 1200, height: 675 };
const DIGITS = 9;

function labelsAt(zoom: number, worldWeight = 1) {
  return diveLabelPlacements({
    camera: diveCameraAt(zoom, VIEWPORT),
    globeRotation: diveGlobeRotation(zoom),
    worldWeight,
  });
}

describe('diveLabelAlpha', () => {
  const range = { nearZoom: 1, farZoom: 2 };
  it('is 0 outside the range, 1 a fade inside both ends and linear between', () => {
    expect(diveLabelAlpha(range, 0.9)).toBe(0);
    expect(diveLabelAlpha(range, 2.1)).toBe(0);
    expect(diveLabelAlpha(range, 1.5)).toBe(1);
    expect(diveLabelAlpha(range, 1.09)).toBeCloseTo(0.5, DIGITS);
    expect(diveLabelAlpha(range, 1.91)).toBeCloseTo(0.5, DIGITS);
  });
});

describe('diveGeoLabelFade', () => {
  it('fades the place names out as the map gives way to the shore', () => {
    expect(diveGeoLabelFade(4.4)).toBe(1);
    expect(diveGeoLabelFade(4.15)).toBeCloseTo(0.5, DIGITS);
    expect(diveGeoLabelFade(3.9)).toBe(0);
  });
});

describe('diveLabelPlacements', () => {
  it('names the continents facing the view in orbit and none on the far side', () => {
    const texts = labelsAt(7.3).map((label) => label.text);
    expect(texts).toContain('Eurasia');
    expect(texts).not.toContain('North America');
  });

  it('pins a place name to the planet: Victoria lies 1 km west and 5 km north of the focus', () => {
    // 0.013° of longitude west (959 m) and 0.044° of latitude north (4.9 km), at 33.2 m a px (39.8 km over 1200 px).
    const victoria = labelsAt(4.6).find((label) => label.text.startsWith('Future Victoria'));
    expect(victoria).toBeDefined();
    expect(600 - victoria!.dotX).toBeCloseTo(29, 0);
    expect(337.5 - victoria!.dotY).toBeCloseTo(149, 0);
  });

  it('pins a world label in metres round the focus, faded by the planar world’s weight', () => {
    const dish = labelsAt(-3.8, 0.5).find((label) => label.text.startsWith('The dish'));
    expect(dish).toBeDefined();
    expect(dish!.dotX).toBeCloseTo(600, DIGITS);
    expect(dish!.alpha).toBeCloseTo(0.5 * diveLabelAlpha({ nearZoom: -4.9, farZoom: -3.75 }, -3.8), DIGITS);
  });

  it('shows nothing where no label’s range is', () => {
    expect(labelsAt(-6.2)).toEqual([]);
  });
});

describe('placeDiveLabel', () => {
  const camera = diveCameraAt(0, VIEWPORT);

  it('sets the text right of and above its dot', () => {
    const placed = placeDiveLabel(camera, 'Blade', 1, { x: 100, y: 200 });
    expect(placed).toMatchObject({ dotX: 100, dotY: 200, boxX: 106, boxY: 177 });
  });

  it('flips the text left of its dot at the right edge', () => {
    const placed = placeDiveLabel(camera, 'Blade', 1, { x: 1180, y: 200 });
    expect(placed.boxX).toBeLessThan(1180 - 'Blade'.length * 8.5);
  });

  it('keeps the text below the top edge', () => {
    expect(placeDiveLabel(camera, 'Blade', 1, { x: 100, y: 0 }).boxY).toBe(16 - 13);
  });
});
