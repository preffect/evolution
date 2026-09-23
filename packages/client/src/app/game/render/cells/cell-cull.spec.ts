import { describe, expect, it } from 'vitest';
import { CELL_STAGE, MOTION_CLIP } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  ENGULF_WARNING_RING_MIN_PX,
  FAR_DOT_HALO_RADII,
  FLAGELLUM_OUTER_PX,
  RELATION_RING_RADII,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { EATING_CLIP_CONTEXT, clipDeformationPeak, engulfDeformationPeak } from './cell-clips';
import { CULL_DRAW_STATE, cullReachPx, cullReachRadii } from './cell-cull';
import { cellDrawExtentRadii } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';

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
});

describe('cullReachRadii', () => {
  it('is the drawn extent in the cull state, so a sprinting tier-III tail is inside it', () => {
    expect(cullReachRadii(TAILED)).toBe(cellDrawExtentRadii(TAILED, CULL_DRAW_STATE).drawnRadii);
    expect(cullReachRadii(TAILED)).toBeGreaterThan(cullReachRadii(BARE));
  });

  it('never falls under the far dot’s halo', () => {
    expect(cullReachRadii(BARE)).toBeGreaterThanOrEqual(FAR_DOT_HALO_RADII);
  });
});

describe('cullReachPx', () => {
  it('is the drawing on a big cell and the warning ring’s px floor on a tiny one', () => {
    expect(cullReachPx(3.2, 100)).toBeCloseTo(320 + FLAGELLUM_OUTER_PX * HALF, 6);
    expect(cullReachPx(3.2, 3)).toBe(ENGULF_WARNING_RING_MIN_PX + WARNING_RING_STROKE_PX);
  });

  it('covers a relation ring that outgrows a narrow drawing', () => {
    expect(cullReachPx(1, 40)).toBeGreaterThan(RELATION_RING_RADII * 40);
  });
});
