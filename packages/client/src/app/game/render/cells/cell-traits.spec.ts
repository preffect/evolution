import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { FORM_ID, FORM_WOBBLE_MODE, HALO_KIND, PROTOCELL_WOBBLE_AMPLITUDE, PROTOCELL_WOBBLE_MODE } from '../constants';
import { summariseCellTraits } from './cell-traits';
import { BLOB_FORM } from './forms/form-profiles';

describe('summariseCellTraits', () => {
  it('gives the protocell its halo and wobble and no nucleus or tells', () => {
    const summary = summariseCellTraits(createTestCellView({ stage: CELL_STAGE.protocell, traits: [] }));
    expect(summary.isProtocell).toBe(true);
    expect(summary.hasNucleus).toBe(false);
    expect(summary.haloKind).toBe(HALO_KIND.protocell);
    expect(summary.wobble).toEqual({ mode: PROTOCELL_WOBBLE_MODE, amplitude: PROTOCELL_WOBBLE_AMPLITUDE, hz: 0.7 });
    expect(summary).toMatchObject({ ciliaCount: 0, wallScale: 0, speckleDensity: 0, filamentCount: 0, tintMix: 0 });
    expect(summary.form).toBe(BLOB_FORM);
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

  it('reads the tiered tell counts from the trait tables (VISUAL-STYLE §4)', () => {
    const summary = summariseCellTraits(
      createTestCellView({
        stage: CELL_STAGE.eukaryote,
        traits: [
          { traitId: 'cilia', tier: 2 },
          { traitId: 'cell_wall', tier: 3 },
          { traitId: 'ribosomes', tier: 1 },
          { traitId: 'cytoskeleton', tier: 3 },
        ],
      }),
    );
    expect(summary).toMatchObject({ ciliaCount: 36, wallScale: 2.5, speckleDensity: 20, filamentCount: 19 });
    expect(summary.isTaut).toBe(true);
  });

  it('gives a chloroplast its halo and membrane tint, a toxin bladder its halo, the chloroplast winning', () => {
    const green = summariseCellTraits(
      createTestCellView({ stage: CELL_STAGE.endosymbiosis, traits: [{ traitId: 'chloroplast', tier: 1 }] }),
    );
    expect(green.haloKind).toBe(HALO_KIND.chloroplast);
    expect(green.tintMix).toBe(0.2);
    const purple = summariseCellTraits(
      createTestCellView({ stage: CELL_STAGE.eukaryote, traits: [{ traitId: 'toxin_vacuole', tier: 2 }] }),
    );
    expect(purple.haloKind).toBe(HALO_KIND.toxin);
    expect(purple.tintMix).toBe(0);
    const both = summariseCellTraits(
      createTestCellView({
        stage: CELL_STAGE.eukaryote,
        traits: [
          { traitId: 'toxin_vacuole', tier: 1 },
          { traitId: 'chloroplast', tier: 1 },
        ],
      }),
    );
    expect(both.haloKind).toBe(HALO_KIND.chloroplast);
  });

  it('resolves the form from the form trait: mode-3 wobble on a slipper, none on the rigid diatom', () => {
    const slipper = summariseCellTraits(
      createTestCellView({ stage: CELL_STAGE.specialised, traits: [{ traitId: 'paramecium_cilia', tier: 2 }] }),
    );
    expect(slipper.form.id).toBe(FORM_ID.slipper);
    expect(slipper.formTier).toBe(2);
    expect(slipper.wobble.mode).toBe(FORM_WOBBLE_MODE);
    const diatom = summariseCellTraits(
      createTestCellView({ stage: CELL_STAGE.specialised, traits: [{ traitId: 'diatom_shell', tier: 1 }] }),
    );
    expect(diatom.form.id).toBe(FORM_ID.diatom);
    expect(diatom.wobble.amplitude).toBe(0);
  });

  it('folds the preview trait in at tier I without overriding an owned tier', () => {
    const view = createTestCellView({ traits: [{ traitId: 'cilia', tier: 3 }] });
    expect(summariseCellTraits(view, 'toxin_vacuole').tierOf('toxin_vacuole')).toBe(1);
    expect(summariseCellTraits(view, 'cilia').tierOf('cilia')).toBe(3);
    expect(summariseCellTraits(view).tierOf('toxin_vacuole')).toBe(0);
    expect(summariseCellTraits(view, 'euglena_eyespot').form.id).toBe(FORM_ID.spindle);
  });
});
