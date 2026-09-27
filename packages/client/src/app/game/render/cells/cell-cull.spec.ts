import { describe, expect, it } from 'vitest';
import { CELL_STAGE, MOTION_CLIP } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  ENGULF_WARNING_RING_MIN_PX,
  FAR_DOT_HALO_RADII,
  FLAGELLUM_OUTER_PX,
  PSEUDOPOD_REACH,
  RELATION_RING_RADII,
  STARVING_WRINKLE_AMPLITUDE,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { EATING_CLIP_CONTEXT, clipDeformationPeak, engulfDeformationPeak } from './cell-clips';
import { CULL_DRAW_STATE, cullReachPx, cullReachRadii } from './cell-cull';
import { cellDrawExtentRadii } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';
import { peakRingBodyScale, peakRingLobeRadii } from './traced-ring-reach';

const TAILED = summariseCellTraits(
  createTestCellView({ stage: CELL_STAGE.eukaryote, traits: [{ traitId: 'simple_flagellum', tier: 3 }] }),
  null,
);
const BARE = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.prokaryote }), null);

describe('CULL_DRAW_STATE', () => {
  it('is sprinting at top speed with a clip at least as wide as the eat and the engulf peaks', () => {
    expect(CULL_DRAW_STATE).toMatchObject({ speedRatio: 1, isSprinting: true });
    const eat = clipDeformationPeak(MOTION_CLIP.eat, EATING_CLIP_CONTEXT);
    const engulf = engulfDeformationPeak();
    expect(CULL_DRAW_STATE.clip.pulse).toBeGreaterThanOrEqual(Math.max(eat.pulse, engulf.pulse));
    expect(CULL_DRAW_STATE.clip.bumpRadii).toBeGreaterThanOrEqual(Math.max(eat.bumpRadii, engulf.bumpRadii));
  });

  it('carries a starving cell’s full wrinkle on top of the widest clip, so a crinkled rim never pops in (#635)', () => {
    const engulf = engulfDeformationPeak();
    expect(CULL_DRAW_STATE.clip.bumpRadii).toBeGreaterThanOrEqual(engulf.bumpRadii + STARVING_WRINKLE_AMPLITUDE);
  });
});

const AMOEBA = summariseCellTraits(
  createTestCellView({ stage: CELL_STAGE.specialised, traits: [{ traitId: 'amoeba_pseudopods', tier: 3 }] }),
  null,
);
const PARAMECIUM = summariseCellTraits(
  createTestCellView({ stage: CELL_STAGE.specialised, traits: [{ traitId: 'paramecium_cilia', tier: 3 }] }),
  null,
);
const round = (drawnRadii: number) => ({ drawnRadii, ringBodyScale: 1, ringLobeRadii: 0 });

describe('cullReachRadii', () => {
  it('is the drawn extent in the cull state, so a sprinting tier-III tail is inside it', () => {
    expect(cullReachRadii(TAILED).drawnRadii).toBe(cellDrawExtentRadii(TAILED, CULL_DRAW_STATE).drawnRadii);
    expect(cullReachRadii(TAILED).drawnRadii).toBeGreaterThan(cullReachRadii(BARE).drawnRadii);
  });

  it('never falls under the far dot’s halo', () => {
    expect(cullReachRadii(BARE).drawnRadii).toBeGreaterThanOrEqual(FAR_DOT_HALO_RADII);
  });

  it('carries the ring’s lobes over any frame: an engulf’s arms on every cell, a pseudopod on top on an amoeba (#730)', () => {
    expect(cullReachRadii(BARE).ringLobeRadii).toBe(peakRingLobeRadii(BARE, CULL_DRAW_STATE));
    expect(cullReachRadii(BARE).ringLobeRadii).toBeGreaterThan(0);
    expect(cullReachRadii(AMOEBA).ringLobeRadii).toBeGreaterThan(cullReachRadii(BARE).ringLobeRadii + PSEUDOPOD_REACH);
  });

  it('scales the ring round the body at its widest: a sprinting blob’s front, a slipper’s nose more (#730)', () => {
    expect(cullReachRadii(BARE).ringBodyScale).toBe(peakRingBodyScale(BARE, CULL_DRAW_STATE));
    expect(cullReachRadii(BARE).ringBodyScale).toBeGreaterThan(1);
    expect(cullReachRadii(PARAMECIUM).ringBodyScale).toBeGreaterThan(cullReachRadii(BARE).ringBodyScale);
  });
});

describe('cullReachPx', () => {
  it('is the drawing on a big cell and the warning ring’s px floor on a tiny one', () => {
    expect(cullReachPx(round(3.2), 100)).toBeCloseTo(320 + FLAGELLUM_OUTER_PX * HALF, 6);
    expect(cullReachPx(round(3.2), 3)).toBe(ENGULF_WARNING_RING_MIN_PX + WARNING_RING_STROKE_PX);
  });

  it('covers a relation ring that outgrows a narrow drawing', () => {
    expect(cullReachPx(round(1), 40)).toBeGreaterThan(RELATION_RING_RADII * 40);
  });

  it('adds the ring’s lobes past its outermost line, in px of the cell', () => {
    const lobed = { drawnRadii: 1, ringBodyScale: 1, ringLobeRadii: 0.5 };
    expect(cullReachPx(lobed, 3) - cullReachPx(round(1), 3)).toBeCloseTo(1.5, 9);
  });

  it('scales the ring’s outermost line by the body before the lobes', () => {
    const scaled = { drawnRadii: 1, ringBodyScale: 1.5, ringLobeRadii: 0 };
    expect(cullReachPx(scaled, 3)).toBeCloseTo((ENGULF_WARNING_RING_MIN_PX + WARNING_RING_STROKE_PX) * 1.5, 9);
  });
});
