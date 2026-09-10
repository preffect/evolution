import { describe, expect, it } from 'vitest';
import { CELL_STAGE, createTestCellView } from '@evolution/shared';
import { HALO_KIND } from '../constants';
import { summariseCellTraits } from './cell-traits';

describe('summariseCellTraits', () => {
  it('reads the tiered counts from the trait tables', () => {
    const view = createTestCellView({
      stage: CELL_STAGE.eukaryote,
      traits: [
        { traitId: 'cilia', tier: 2 },
        { traitId: 'cell_wall', tier: 3 },
        { traitId: 'ribosomes', tier: 1 },
        { traitId: 'cytoskeleton', tier: 3 },
        { traitId: 'nuclear_envelope', tier: 1 },
      ],
    });
    const summary = summariseCellTraits(view);
    expect(summary.ciliaCount).toBe(36);
    expect(summary.wallScale).toBe(2.5);
    expect(summary.speckleDensity).toBe(20);
    expect(summary.filamentCount).toBe(19);
    expect(summary.hasNucleus).toBe(true);
    expect(summary.isTaut).toBe(true);
    expect(summary.haloKind).toBe(HALO_KIND.default);
    expect(summary.tintMix).toBe(0);
    expect(summary.wobble.amplitude).toBe(0);
  });

  it('gives the protocell its halo and wobble and a chloroplast its halo and tint', () => {
    const protocell = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.protocell, traits: [] }));
    expect(protocell.isProtocell).toBe(true);
    expect(protocell.haloKind).toBe(HALO_KIND.protocell);
    expect(protocell.wobble.mode).toBe(2);
    const green = summariseCellTraits(createTestCellView({ traits: [{ traitId: 'chloroplast', tier: 1 }] }));
    expect(green.haloKind).toBe(HALO_KIND.trait);
    expect(green.tintMix).toBe(0.2);
    const specialised = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.specialised }));
    expect(specialised.wobble.mode).toBe(3);
  });

  it('folds the preview trait in at tier I without overriding an owned tier', () => {
    const view = createTestCellView({ traits: [{ traitId: 'cilia', tier: 3 }] });
    expect(summariseCellTraits(view, 'toxin_vacuole').tierOf('toxin_vacuole')).toBe(1);
    expect(summariseCellTraits(view, 'cilia').tierOf('cilia')).toBe(3);
    expect(summariseCellTraits(view).tierOf('toxin_vacuole')).toBe(0);
  });
});
