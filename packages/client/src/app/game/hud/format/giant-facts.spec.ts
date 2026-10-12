// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES } from '@evolution/shared';
import { formRealLifeLine, isFormTrait } from './form-facts';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from './giant-facts';

/** The terse rule the form lines keep (docs/ui/input-and-onboarding.md §5): one short line, no full stop. */
const REAL_LIFE_LINE_MAX_CHARS = 64;
const SPECIES = Object.values(GIANT_SPECIES);

describe('the giants’ names and real-life lines (docs/ecology/giants.md §3.5.11, §3.5.12)', () => {
  it('names each species with the spec’s display name, every one different', () => {
    expect(GIANT_DISPLAY_NAME_BY_SPECIES).toEqual({
      [GIANT_SPECIES.amoeba]: 'Giant amoeba',
      [GIANT_SPECIES.paramecium]: 'Paramecium',
      [GIANT_SPECIES.diatom]: 'Giant diatom',
    });
    expect(new Set(SPECIES.map((species) => GIANT_DISPLAY_NAME_BY_SPECIES[species])).size).toBe(SPECIES.length);
  });

  it('keeps each line short, in the coach pill’s style, and about the real organism', () => {
    for (const species of SPECIES) {
      const line = GIANT_REAL_LIFE_LINES[species];
      expect(line.length).toBeLessThanOrEqual(REAL_LIFE_LINE_MAX_CHARS);
      expect(line.endsWith('.')).toBe(false);
      expect(line.startsWith('Real ')).toBe(true);
    }
  });

  it('teaches something the giant’s own form popup did not', () => {
    for (const species of SPECIES) {
      const form = DEFAULT_BALANCE.giants.GIANT_BUILDS_BY_SPECIES[species].find((owned) => isFormTrait(owned.traitId));
      const formLine = form === undefined ? null : formRealLifeLine(form.traitId);
      expect(formLine).not.toBeNull();
      expect(GIANT_REAL_LIFE_LINES[species]).not.toBe(formLine);
    }
  });
});
