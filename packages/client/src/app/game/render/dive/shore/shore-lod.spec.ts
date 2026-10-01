// @vitest-environment node
// The shore's levels of detail (docs/rendering/opening-dive.md §4): one every 0.15 of zoom from where the shore fades in
// to its cut, each covering the views a step wider than its own and never shown magnified.

import { describe, expect, it } from 'vitest';
import { DIVE_SHORE_WINDOW } from '../../constants/dive';
import { SHORE_LOD } from '../../constants/dive-shore';
import {
  SHORE_LEVEL_COUNT,
  SHORE_LEVEL_OVERSIZE,
  shoreLevelAt,
  shoreLevelProgress,
  shoreLevelView,
  shoreLevelZoom,
  shoreSnapshotRatio,
} from './shore-lod';

const STAGE = { width: 830, height: 467 };

describe('the ladder of levels', () => {
  it('runs from the band’s fade-in to past its cut', () => {
    expect(SHORE_LOD.topZoom).toBe(DIVE_SHORE_WINDOW.fadeFromZoom);
    expect(SHORE_LOD.cutZoom).toBe(DIVE_SHORE_WINDOW.cutAtZoom);
    expect(shoreLevelZoom(0)).toBe(SHORE_LOD.topZoom);
    expect(shoreLevelZoom(SHORE_LEVEL_COUNT - 1)).toBeLessThanOrEqual(SHORE_LOD.cutZoom);
  });

  it('gives each zoom the level whose step it lies in, its own zoom included', () => {
    expect(shoreLevelAt(SHORE_LOD.topZoom)).toBe(0);
    expect(shoreLevelAt(shoreLevelZoom(5))).toBe(5);
    expect(shoreLevelAt(shoreLevelZoom(5) - 0.01)).toBe(5);
    expect(shoreLevelAt(shoreLevelZoom(6) + 1e-6)).toBe(5);
    expect(shoreLevelAt(99)).toBe(0);
    expect(shoreLevelAt(-99)).toBe(SHORE_LEVEL_COUNT - 1);
  });

  it('crossfades the next level in over the step: 0 at a level’s own zoom, nearly 1 at the next', () => {
    expect(shoreLevelProgress(shoreLevelZoom(3))).toBe(0);
    expect(shoreLevelProgress(shoreLevelZoom(3) - SHORE_LOD.stepZoom / 2)).toBeCloseTo(0.5, 9);
  });
});

describe('shoreLevelView', () => {
  it('covers the view at its own zoom at the scale of a step finer, so it is only ever shrunk on screen', () => {
    const level = 10;
    const view = shoreLevelView(level, STAGE, 1);
    const ownWidthM = 10 ** shoreLevelZoom(level);
    expect(view.halfWidthM * 2).toBeGreaterThanOrEqual(ownWidthM - 1e-9);
    const finestPixelsPerMetre = STAGE.width / 10 ** (shoreLevelZoom(level) - SHORE_LOD.stepZoom);
    expect(view.pixelsPerMetre).toBeCloseTo(finestPixelsPerMetre, 9);
    expect(view.screenPixelsPerMetre).toBeCloseTo(STAGE.width / ownWidthM, 9);
    expect(view.widthPx).toBe(Math.ceil(STAGE.width * SHORE_LEVEL_OVERSIZE));
    expect(view.zoom).toBe(shoreLevelZoom(level));
    expect(view.timeSeconds).toBe(0);
  });

  it('bakes at the screen’s ratio up to 1.5', () => {
    expect(shoreSnapshotRatio(1)).toBe(1);
    expect(shoreSnapshotRatio(3)).toBe(SHORE_LOD.maxDevicePixelRatio);
    expect(shoreLevelView(0, STAGE, 2).devicePixelRatio).toBe(SHORE_LOD.maxDevicePixelRatio);
  });
});
