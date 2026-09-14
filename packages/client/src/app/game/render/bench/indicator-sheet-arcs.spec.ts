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
import { ARC_CAP } from '../effects/arc-instance';
import { dnaRingRadiusPx, ladderOrbitRadiusPx, unlockRingRadiusPx } from '../effects/own-cell-geometry';
import { dnaRingSamples, escapeSample, indicatorSheetArcs, sampleOrbitLayout } from './indicator-sheet-arcs';

const SHEET = INDICATOR_SHEET.arcs;

describe('indicatorSheetArcs', () => {
  it('draws the DNA ring at every review fill on the 17 px floor and the 44.9 px max-mass ring, at a 4 px round-capped stroke', () => {
    const fills = dnaRingSamples().filter((arc) => arc.colour === DNA);
    expect(fills.map((arc) => arc.sweep)).toEqual([...SHEET.dnaFills, ...SHEET.dnaFills]);
    expect(new Set(fills.map((arc) => arc.radiusPx))).toEqual(new Set([17, dnaRingRadiusPx(102)]));
    expect(dnaRingRadiusPx(102)).toBeCloseTo(44.9, 1);
    for (const arc of fills) {
      expect(arc.strokePx).toBe(DNA_RING_STROKE_PX);
      expect(arc.cap).toBe(ARC_CAP.round);
    }
  });

  it('merges the backings around the envelope ghost at 32 px, keeps the 24 px prokaryote’s two apart, all butt-ended', () => {
    const [withGhost, prokaryote] = SHEET.orbitSamples.map(sampleOrbitLayout);
    expect(withGhost!.backings).toHaveLength(1);
    expect(prokaryote!.backings).toHaveLength(2);
    const { arcs, sprites } = indicatorSheetArcs(createTestRenderTextures().indicators);
    const backings = arcs.filter((arc) => arc.strokePx === LADDER_BACKING_PX);
    expect(backings).toHaveLength(3);
    for (const arc of backings) expect(arc.cap).toBe(ARC_CAP.butt);
    const unlockRings = arcs.filter((arc) => arc.colour === LEVEL_GOLD);
    expect(unlockRings).toHaveLength(4);
    for (const arc of unlockRings) {
      expect(arc.radiusPx).toBe(unlockRingRadiusPx());
      expect(arc.strokePx).toBe(LADDER_UNLOCK_RING_STROKE_PX);
    }
    const placed = [withGhost!, prokaryote!].reduce(
      (sum, layout) => sum + layout.ghosts.length + layout.pipBlocks.length,
      0,
    );
    expect(sprites).toHaveLength(placed);
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
