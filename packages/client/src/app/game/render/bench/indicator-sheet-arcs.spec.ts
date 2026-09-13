import { describe, expect, it } from 'vitest';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import {
  DANGER,
  DNA,
  DNA_RING_STROKE_PX,
  ESCAPE_ARC_STROKE_PX,
  INDICATOR_SHEET,
  LADDER_BACKING_PX,
  LADDER_UNLOCK_RING_STROKE_PX,
  LEVEL_GOLD,
} from '../constants';
import { dnaRingRadiusPx, ladderOrbitRadiusPx, unlockRingRadiusPx } from '../effects/own-cell-geometry';
import { dnaRingSamples, escapeSample, indicatorSheetArcs, sampleOrbitLayout } from './indicator-sheet-arcs';

const SHEET = INDICATOR_SHEET.arcs;

describe('indicatorSheetArcs', () => {
  it('draws the DNA ring at every review fill on the 17 px floor and the 44.9 px max-mass ring, at a 4 px stroke', () => {
    const fills = dnaRingSamples().filter((arc) => arc.colour === DNA);
    expect(fills.map((arc) => arc.sweep)).toEqual([...SHEET.dnaFills, ...SHEET.dnaFills]);
    expect(new Set(fills.map((arc) => arc.radiusPx))).toEqual(new Set([17, dnaRingRadiusPx(102)]));
    expect(dnaRingRadiusPx(102)).toBeCloseTo(44.9, 1);
    for (const arc of fills) expect(arc.strokePx).toBe(DNA_RING_STROKE_PX);
  });

  it('merges the orbit backings into one band at 32 px and rings both full counters in gold', () => {
    const layout = sampleOrbitLayout();
    expect(layout.backings).toHaveLength(1);
    const { arcs, sprites } = indicatorSheetArcs(createTestRenderTextures().indicators);
    expect(arcs.filter((arc) => arc.strokePx === LADDER_BACKING_PX)).toHaveLength(1);
    const unlockRings = arcs.filter((arc) => arc.colour === LEVEL_GOLD);
    expect(unlockRings).toHaveLength(2);
    for (const arc of unlockRings) {
      expect(arc.radiusPx).toBe(unlockRingRadiusPx());
      expect(arc.strokePx).toBe(LADDER_UNLOCK_RING_STROKE_PX);
    }
    expect(sprites).toHaveLength(layout.ghosts.length + layout.pipBlocks.length);
  });

  it('draws the escape arc on the 126 px orbit of a max-mass cell over its track, and fits the mesh', () => {
    const escape = escapeSample().filter((arc) => arc.colour === DANGER);
    expect(escape.map((arc) => arc.sweep)).toEqual([1, SHEET.escapeFill]);
    for (const arc of escape) {
      expect(arc.radiusPx).toBe(ladderOrbitRadiusPx(102));
      expect(arc.strokePx).toBe(ESCAPE_ARC_STROKE_PX);
    }
    expect(ladderOrbitRadiusPx(102)).toBeCloseTo(126.2, 1);
    expect(indicatorSheetArcs(createTestRenderTextures().indicators).arcs.length).toBeLessThanOrEqual(SHEET.capacity);
  });
});
