// The land's edge (docs/rendering/opening-dive.md §4): far off one stroke of bare rock; closer the rock band and its
// zones, each filled under its band's clip and, close in, its near tile cut to the band (a canvas clip of those long
// paths cost a draw ~100 ms on the CPU canvas); the zones' far and near tiles by their size on screen.

import { describe, expect, it } from 'vitest';
import { SHORE_LAND_EDGE, SHORE_ZONE_FADE, SHORE_ZONE_TILES } from '../../constants/dive-shore';
import type { FakeShoreContext } from '../../../../../testing/fake-shore-canvas';
import { testShorePaint, type TestShorePaint } from '../../../../../testing/shore-paint-builder';
import { drawLandEdge, withLandClip } from './shore-land';
import { viewRect, wholeView, zoneFill } from './shore-zone-fill';

/** Runs the land's edge to its end; answers how many steps it yielded. */
function drawAll(paint: TestShorePaint): number {
  const edge = drawLandEdge(paint);
  let steps = 0;
  while (edge.next().done !== true) steps += 1;
  return steps;
}

describe('drawLandEdge', () => {
  it('is one stroke of bare rock while the band is under 3 px across', () => {
    const paint = testShorePaint(4);
    drawAll(paint);
    const widths = paint.context.argumentsOf('stroke').map(([width]) => width);
    expect(paint.context.strokeStyle).toBe(SHORE_LAND_EDGE.simpleColour);
    expect(widths).toHaveLength(SHORE_LAND_EDGE.forestShadows.length + 1);
  });

  it('fills the rock band and the zones in steps once the band is wide enough, the wet rock last', () => {
    const paint = testShorePaint(2);
    const steps = drawAll(paint);
    expect(steps).toBeGreaterThan(1);
    expect(paint.context.clipRules).toContain('evenodd');
    expect(paint.context.strokeStyle).toBe(SHORE_LAND_EDGE.wetRock.colour);
  });

  it('cuts the near tiles to their bands instead of clipping, close in', () => {
    const paint = testShorePaint(0.6);
    drawAll(paint);
    const layers = [...paint.zoneLayers.values()];
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) expect((layer.context as FakeShoreContext).fillRules).toContain('evenodd');
    expect(paint.context.imageDraws.length).toBeGreaterThan(0);
  });
});

describe('withLandClip', () => {
  it('clips to the land with the non-zero rule and answers what it drew', () => {
    const paint = testShorePaint(2);
    expect(withLandClip(paint, () => 7)).toBe(7);
    expect(paint.context.clipRules).toEqual(['nonzero']);
    expect(paint.context.ops.at(-1)).toBe('restore');
  });
});

describe('zoneFill', () => {
  it('is the mean colour far off: one rect, no pattern, no near layer', () => {
    const paint = testShorePaint(3.5);
    paint.context.beginPath();
    expect(zoneFill(paint, 'barnacle', { alpha: 0.9, isNear: true, box: null })).toBe(0);
    expect(paint.context.count('fillRect')).toBe(1);
    expect(paint.zoneLayers.size).toBe(0);
  });

  it('answers the near tile’s strength when the caller draws it, once the tile is big enough on screen', () => {
    const paint = testShorePaint(0);
    const tile = SHORE_ZONE_TILES.barnacle.tileM * paint.view.screenPixelsPerMetre;
    expect(tile).toBeGreaterThan(SHORE_ZONE_FADE.nearToPx);
    paint.context.beginPath();
    expect(zoneFill(paint, 'barnacle', { alpha: 0.9, isNear: true, box: null, isNearLeftOut: true })).toBeCloseTo(
      0.9,
      9,
    );
    expect(paint.zoneLayers.size).toBe(0);
    expect(zoneFill(paint, 'barnacle', { alpha: 0.9, isNear: true, box: null })).toBe(0);
    expect(paint.zoneLayers.size).toBe(1);
  });

  it('draws nothing for a box off the view', () => {
    const paint = testShorePaint(1);
    const off = paint.view.halfWidthM * 10;
    expect(viewRect(paint, [off, off, off + 1, off + 1])).toBeNull();
    expect(zoneFill(paint, 'mussel', { alpha: 1, isNear: false, box: [off, off, off + 1, off + 1] })).toBe(0);
    expect(viewRect(paint, null)).toEqual(wholeView(paint));
  });
});
