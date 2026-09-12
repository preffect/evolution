// docs/RENDERING.md §9: every form has unit area within 0.5 %, the sheet-04 aspects, the diatom is rigid.

import { describe, expect, it } from 'vitest';
import { FORM_ID } from '../../constants';
import { BLOB_FORM, FORM_PROFILES, formFor, formTraitOf, normalisedArea, pseudopodCount } from './form-profiles';

describe('form profiles', () => {
  it('draws the blob for no form trait and for an unregistered one', () => {
    expect(formFor(null)).toBe(BLOB_FORM);
    expect(formFor('cilia')).toBe(BLOB_FORM);
    expect(BLOB_FORM.profileAt(1)).toBeNull();
    expect(formTraitOf([{ traitId: 'cilia' }, { traitId: 'diatom_shell' }])).toBe('diatom_shell');
    expect(formTraitOf([{ traitId: 'cilia' }])).toBeNull();
  });

  it('carries the sheet-04 aspects per tier', () => {
    expect([1, 2, 3].map((tier) => formFor('paramecium_cilia').aspectAt(tier as 1 | 2 | 3))).toEqual([1.6, 1.8, 2.0]);
    expect(formFor('euglena_eyespot').aspectAt(1)).toBe(3.1);
    expect(formFor('stentor_trumpet').aspectAt(2)).toBe(0.51);
    expect(formFor('diatom_shell').aspectAt(3)).toBe(1);
    expect(formFor('diatom_shell').isRigid).toBe(true);
    expect(formFor('amoeba_pseudopods').id).toBe(FORM_ID.amoeba);
  });

  it('grows 2 / 3 / 4 pseudopods on the amoeba and none elsewhere', () => {
    expect([1, 2, 3].map((tier) => pseudopodCount(formFor('amoeba_pseudopods'), tier as 1 | 2 | 3))).toEqual([2, 3, 4]);
    expect(pseudopodCount(formFor('paramecium_cilia'), 3)).toBe(0);
  });

  it('holds every registered form (and the blob) to unit area within 0.5 %', () => {
    expect(normalisedArea(null)).toBe(1);
    for (const definition of FORM_PROFILES.values()) {
      for (const tier of [1, 2, 3] as const) {
        expect(Math.abs(normalisedArea(definition.profileAt(tier)) - 1)).toBeLessThan(0.005);
      }
    }
    const ellipse = { evaluate: (delta: number) => ({ value: Math.SQRT2 * Math.abs(Math.cos(delta)), derivative: 0 }) };
    expect(normalisedArea(ellipse)).toBeCloseTo(1, 6);
  });
});
