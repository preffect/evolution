// The measuring tool the glyph specs trust, measured itself. `glyph-bounds.ts` shipped asserting something other than
// what it claimed — it read a circle through path data whose arcs run between the horizontal extremes, so the top and
// bottom of every disc went unmeasured and seven drawings that the medallion crops passed the guard. A harness that
// is never tested is a guard that can quietly stop guarding, so each way it can be blind has a case here.

import { describe, expect, it } from 'vitest';
import { circle, ellipse, path, GLYPH_ROLE, type GlyphLayer } from '../app/game/render/svg-glyph';
import { GLYPH_CENTRE } from '../app/game/render/constants/trait-glyph-layers';
import { layerReach, pathPoints, shapeReach } from './glyph-bounds';

/** Decimal places a sampled reach is held to: a hundredth of a unit is below a pixel at every glyph size. */
const DECIMALS = 2;
/** One decimal place, where the case is about which extreme was found rather than about sampling accuracy. */
const ROUGH = 1;

function furthestFromCentre(pathData: string): number {
  return Math.max(...pathPoints(pathData).map((point) => Math.hypot(point[0] - GLYPH_CENTRE, point[1] - GLYPH_CENTRE)));
}

describe('shapeReach', () => {
  it.each([
    ['right', GLYPH_CENTRE + 20, GLYPH_CENTRE],
    ['left', GLYPH_CENTRE - 20, GLYPH_CENTRE],
    ['below', GLYPH_CENTRE, GLYPH_CENTRE + 20],
    ['above', GLYPH_CENTRE, GLYPH_CENTRE - 20],
  ])('measures a circle offset to the %s, not only the axis its path data runs along', (_side, centreX, centreY) => {
    // The bug: `shapePathData` draws a circle as two arcs between its horizontal extremes, so a disc pushed up or
    // down used to measure as though it had no height at all.
    expect(shapeReach(circle(centreX, centreY, 10))).toBeCloseTo(30, DECIMALS);
  });

  it('measures an ellipse round its whole boundary, the long axis whichever way it points', () => {
    expect(shapeReach(ellipse(GLYPH_CENTRE, GLYPH_CENTRE, 5, 25))).toBeCloseTo(25, DECIMALS);
    expect(shapeReach(ellipse(GLYPH_CENTRE, GLYPH_CENTRE, 25, 5))).toBeCloseTo(25, DECIMALS);
  });

  it('adds a layer’s offset before measuring, since the pool is drawn down and right of its body', () => {
    const radius = 10;
    expect(shapeReach(circle(GLYPH_CENTRE, GLYPH_CENTRE, radius), 3, 4)).toBeCloseTo(radius + 5, DECIMALS);
  });
});

describe('pathPoints', () => {
  it('walks an arc instead of jumping it, so an extreme between two endpoints is not missed', () => {
    // A half circle from (50, 20) to (70, 20). Its endpoints are 30.0 and 36.1 from the medallion's centre, so
    // endpoint-only measurement reads 36.1 whichever way it bulges. Swept up, the arc really reaches 41.6 — which is
    // not its apex (60, 10) at 41.2 but a point along the way, so walking it is what finds the true maximum.
    expect(furthestFromCentre('M50 20 A10 10 0 0 1 70 20')).toBeCloseTo(41.62, ROUGH);
  });

  it('follows the sweep flag, so the bulge is found on the side the arc actually goes', () => {
    // The same chord swept the other way bulges down to (60, 30), which is nearer the centre than its own endpoint:
    // reading 36.1 here is right, and reading it above would have been the blind spot.
    expect(furthestFromCentre('M50 20 A10 10 0 0 0 70 20')).toBeCloseTo(36.06, ROUGH);
  });

  it('keeps an arc-drawn circle’s left and right extremes when its endpoints are vertical', () => {
    // `subject-glyphs-tags.ts` draws the sensory pupil exactly this way: two arcs meeting top and bottom.
    const pupil = `M${GLYPH_CENTRE} ${GLYPH_CENTRE - 6} A6 6 0 1 0 ${GLYPH_CENTRE} ${GLYPH_CENTRE + 6} A6 6 0 1 0 ${GLYPH_CENTRE} ${GLYPH_CENTRE - 6}`;
    expect(furthestFromCentre(pupil)).toBeCloseTo(6, DECIMALS);
  });

  it('restores the cursor to the subpath start on Z, so a relative command after it starts from the right place', () => {
    expect(pathPoints('M10 10 h10 v10 Z l5 5').at(-1)).toEqual([15, 15]);
  });

  it('follows a relative arc, which is how a baked circle or ellipse is written', () => {
    // A circle of radius 12 about (50, 25): 37 from the centre at its top, but only 27.7 at either endpoint.
    expect(furthestFromCentre('M38 25 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z')).toBeCloseTo(37, ROUGH);
  });

  it('counts a curve’s control points, which its curve is guaranteed to stay inside', () => {
    expect(pathPoints('M0 0 Q10 40 20 0')).toContainEqual([10, 40]);
  });

  it('reads a run of argument sets under one command letter', () => {
    expect(pathPoints('M0 0 L10 0 20 0 30 0')).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ]);
  });
});

describe('layerReach', () => {
  it('adds half the stroke, since a stroke straddles the line it is drawn on', () => {
    const layer: GlyphLayer = {
      role: GLYPH_ROLE.body,
      shape: circle(GLYPH_CENTRE, GLYPH_CENTRE, 30),
      stroke: { colour: '#000000', width: 4, opacity: 1 },
    };
    expect(layerReach(layer)).toBeCloseTo(32, DECIMALS);
  });

  it('never under-reports a drawing the medallion would crop', () => {
    // The shape the old measurement passed: a disc pushed up, whose top is what leaves the frame.
    const cropped: GlyphLayer = { role: GLYPH_ROLE.detail, shape: circle(GLYPH_CENTRE, 25, 20) };
    expect(layerReach(cropped)).toBeCloseTo(45, DECIMALS);
  });

  it('measures a path shape too, so a hand-written drawing is held to the same budget', () => {
    const layer: GlyphLayer = { role: GLYPH_ROLE.signature, shape: path('M50 50 L50 88') };
    expect(layerReach(layer)).toBeCloseTo(38, DECIMALS);
  });
});
