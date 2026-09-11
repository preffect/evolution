import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { HALO_KIND, PROTOCELL_WOBBLE_AMPLITUDE, PROTOCELL_WOBBLE_MODE } from '../constants';
import { summariseCellTraits } from './cell-traits';

describe('summariseCellTraits', () => {
  it('gives the protocell its halo and wobble and no nucleus', () => {
    const summary = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.protocell, traits: [] }));
    expect(summary.isProtocell).toBe(true);
    expect(summary.hasNucleus).toBe(false);
    expect(summary.haloKind).toBe(HALO_KIND.protocell);
    expect(summary.wobble).toEqual({ mode: PROTOCELL_WOBBLE_MODE, amplitude: PROTOCELL_WOBBLE_AMPLITUDE, hz: 0.7 });
  });

  it('reads the nucleus from the envelope trait and stills the wobble past the protocell', () => {
    const summary = summariseCellTraits(
      createTestCellView({
        stage: CELL_STAGE.eukaryote,
        traits: [
          { traitId: 'nuclear_envelope', tier: 1 },
          { traitId: 'mitochondrion', tier: 2 },
        ],
      }),
    );
    expect(summary.isProtocell).toBe(false);
    expect(summary.hasNucleus).toBe(true);
    expect(summary.haloKind).toBe(HALO_KIND.default);
    expect(summary.wobble.amplitude).toBe(0);
    expect(summary.tierOf('mitochondrion')).toBe(2);
    expect(summary.tierOf('cilia')).toBe(0);
  });

  it('folds the preview trait in at tier I without overriding an owned tier', () => {
    const view = createTestCellView({ traits: [{ traitId: 'cilia', tier: 3 }] });
    expect(summariseCellTraits(view, 'toxin_vacuole').tierOf('toxin_vacuole')).toBe(1);
    expect(summariseCellTraits(view, 'cilia').tierOf('cilia')).toBe(3);
    expect(summariseCellTraits(view).tierOf('toxin_vacuole')).toBe(0);
  });
});
