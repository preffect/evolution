// docs/RENDERING.md §9: every form has unit area within 0.5 %; the blob is the default.

import { describe, expect, it } from 'vitest';
import { BLOB_FORM, FORM_PROFILES, formFor, normalisedArea } from './form-profiles';

describe('form profiles', () => {
  it('draws the blob for no form trait and for an unregistered one', () => {
    expect(formFor(null)).toBe(BLOB_FORM);
    expect(formFor('cilia')).toBe(BLOB_FORM);
    expect(BLOB_FORM.profile).toBeNull();
  });

  it('holds every registered form (and the blob) to unit area within 0.5 %', () => {
    expect(normalisedArea(null)).toBe(1);
    for (const definition of Object.values(FORM_PROFILES)) {
      expect(Math.abs(normalisedArea(definition.profile) - 1)).toBeLessThan(0.005);
    }
    const ellipse = { evaluate: (delta: number) => ({ value: Math.SQRT2 * Math.abs(Math.cos(delta)), derivative: 0 }) };
    expect(normalisedArea(ellipse)).toBeCloseTo(1, 6);
  });
});
