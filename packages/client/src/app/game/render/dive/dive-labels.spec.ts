// @vitest-environment node
// The dive's labels (docs/rendering/opening-dive.md §5): place names on the turning planet, things in the world in
// metres, the fade over each range and the mockup's placement rules.

import { describe, expect, it } from 'vitest';
import { DIVE_GEO_LABELS, DIVE_WORLD_LABELS } from '../constants';
import { diveCameraAt, diveGlobeRotation } from './dive-camera';
import {
  diveGeoLabelFade,
  diveLabelAlpha,
  diveLabelPlacements,
  placeDiveLabel,
  stackDiveLabels,
  type DiveLabelPlacement,
} from './dive-labels';

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
    expect(texts).toContain('EURASIA');
    expect(texts).not.toContain('NORTH AMERICA');
  });

  it('pins a place name to the planet: Victoria lies 1 km west and 5 km north of the focus', () => {
    // 0.013° of longitude west (959 m) and 0.044° of latitude north (4.9 km), at 33.2 m a px (39.8 km over 1200 px).
    const victoria = labelsAt(4.6).find((label) => label.text.startsWith('FUTURE VICTORIA'));
    expect(victoria).toBeDefined();
    expect(600 - victoria!.dotX).toBeCloseTo(29, 0);
    expect(337.5 - victoria!.dotY).toBeCloseTo(149, 0);
  });

  it('pins a world label in metres round the focus, faded by the planar world’s weight', () => {
    const dish = labelsAt(-3.8, 0.5).find((label) => label.text.startsWith('THE DISH'));
    expect(dish).toBeDefined();
    expect(dish!.dotX).toBeCloseTo(600, DIGITS);
    expect(dish!.alpha).toBeCloseTo(0.5 * diveLabelAlpha({ nearZoom: -4.9, farZoom: -3.75 }, -3.8), DIGITS);
  });

  it('shows nothing where no label’s range is', () => {
    expect(labelsAt(-1.0)).toEqual([]);
  });
});

describe('placeDiveLabel', () => {
  const camera = diveCameraAt(0, VIEWPORT);
  const blade = (x: number, y: number) => ({ text: 'Blade', alpha: 1, dot: { x, y } });

  it('sets the text right of and above its dot', () => {
    const placed = placeDiveLabel(camera, blade(100, 200));
    expect(placed).toMatchObject({ dotX: 100, dotY: 200, boxX: 106, boxY: 177 });
  });

  it('flips the text left of its dot at the right edge', () => {
    const placed = placeDiveLabel(camera, blade(1180, 200));
    expect(placed.boxX).toBeLessThan(1180 - 'Blade'.length * 8.5);
  });

  it('keeps the text below the top edge, and below the readout in its corner', () => {
    expect(placeDiveLabel(camera, blade(600, 0)).boxY).toBe(16 - 13);
    expect(placeDiveLabel(camera, blade(100, 40)).boxY).toBe(120);
    expect(placeDiveLabel(camera, blade(450, 40)).boxY).toBe(40 - 10 - 13);
  });

  it('keeps clear of the readout’s longest line, 408 px wide on the 1280 stage, until it is measured', () => {
    // A box starting at 390 px was clear of the old 360 px keep-out but sat over "40 µm" (ticket #805).
    expect(placeDiveLabel(camera, blade(386, 40)).boxY).toBe(120);
  });

  it('keeps clear of the readout’s measured box instead, once there is one', () => {
    const readout = { right: 300, bottom: 150 };
    expect(placeDiveLabel(camera, blade(200, 40), readout).boxY).toBe(150);
    expect(placeDiveLabel(camera, blade(320, 40), readout).boxY).toBe(40 - 10 - 13);
  });
});

describe('stackDiveLabels', () => {
  const labelAt = (text: string, boxX: number, boxY: number): DiveLabelPlacement => ({
    text,
    alpha: 1,
    dotX: boxX,
    dotY: boxY,
    boxX,
    boxY,
  });

  it('moves the lower of two overlapping labels down under the other, keeping their order and dots', () => {
    const stacked = stackDiveLabels([labelAt('THE DISH', 100, 52), labelAt('DIATOM', 120, 50)]);
    expect(stacked.map((label) => label.text)).toEqual(['THE DISH', 'DIATOM']);
    expect(stacked[1]!.boxY).toBe(50);
    expect(stacked[0]!.boxY).toBe(50 + 18 + 2);
    expect(stacked[0]!.dotY).toBe(52);
  });

  it('stacks labels on one line one under another, the first one first', () => {
    const stacked = stackDiveLabels([labelAt('A', 10, 120), labelAt('B', 10, 120), labelAt('C', 10, 120)]);
    expect(stacked.map((label) => label.boxY)).toEqual([120, 140, 160]);
  });

  it('leaves labels apart from each other where they are, side by side or a box and a gap apart', () => {
    const apart = [labelAt('THE DISH', 100, 50), labelAt('DIATOM', 300, 50), labelAt('THE DISH', 100, 70)];
    expect(stackDiveLabels(apart)).toEqual(apart);
  });

  it('never lets the dish and diatom labels land on one spot through the handoff (−3.9 to −4.1)', () => {
    for (const viewport of [VIEWPORT, { width: 362, height: 453 }]) {
      for (let zoom = -3.9; zoom >= -4.1; zoom -= 0.025) {
        const boxes = diveLabelPlacements({
          camera: diveCameraAt(zoom, viewport),
          globeRotation: diveGlobeRotation(zoom),
          worldWeight: 1,
        });
        expect(stackDiveLabels(boxes)).toEqual(boxes);
        const tops = boxes.map((label) => `${Math.round(label.boxX)},${Math.round(label.boxY)}`);
        expect(new Set(tops).size).toBe(tops.length);
      }
    }
  });
});

describe('the labels’ words', () => {
  it('keep every unit in lower case: a capital mu reads as M, and 40 µm as 40 MM', () => {
    for (const label of [...DIVE_GEO_LABELS, ...DIVE_WORLD_LABELS]) {
      expect(label.text).not.toMatch(/\u039C|\b(MM|CM|KM)\b/);
      expect(label.text).toBe(label.text.replace(/µ(?!m)/g, ''));
    }
  });
});
