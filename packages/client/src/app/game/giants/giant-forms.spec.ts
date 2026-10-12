// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GIANT_SPECIES } from '@evolution/shared';
import { giantFormTraitId } from './giant-forms';

describe('giantFormTraitId (docs/ecology/giants.md §3.5.11)', () => {
  it('names the form each giant is drawn as', () => {
    expect(giantFormTraitId(GIANT_SPECIES.amoeba)).toBe('amoeba_pseudopods');
    expect(giantFormTraitId(GIANT_SPECIES.paramecium)).toBe('paramecium_cilia');
    expect(giantFormTraitId(GIANT_SPECIES.diatom)).toBe('diatom_shell');
  });
});
