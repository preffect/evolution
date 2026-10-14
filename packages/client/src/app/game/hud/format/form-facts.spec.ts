// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TRAIT_CATALOG, TRAIT_CATEGORY, type TraitDefinition, type TraitId } from '@evolution/shared';
import { FORM_REAL_LIFE_LINES, FORM_TRAIT_IDS, formRealLifeLine, isFormTrait } from './form-facts';

const CATALOG: readonly TraitDefinition[] = TRAIT_CATALOG;
/** The terse rule (docs/ui/input-and-onboarding.md §5): one short line, no full stop. */
const REAL_LIFE_LINE_MAX_CHARS = 60;

describe('the form popups’ real-life lines (docs/ui/overlays.md §3.8)', () => {
  it('has one line for each form and for nothing else', () => {
    expect(FORM_REAL_LIFE_LINES.map((row) => row.traitId).sort()).toEqual([...FORM_TRAIT_IDS].sort());
    expect(FORM_TRAIT_IDS).toHaveLength(5);
    for (const traitId of FORM_TRAIT_IDS) expect(formRealLifeLine(traitId)).not.toBeNull();
    expect(formRealLifeLine('cilia' as TraitId)).toBeNull();
  });

  it('names the catalog’s form traits as the forms, and no other trait', () => {
    const catalogForms = CATALOG.filter((trait) => trait.category === TRAIT_CATEGORY.form).map((trait) => trait.id);
    expect([...FORM_TRAIT_IDS].sort()).toEqual([...catalogForms].sort());
    for (const trait of CATALOG) expect(isFormTrait(trait.id)).toBe(catalogForms.includes(trait.id));
  });

  it('keeps each line short, in the coach pill’s style, and about the real organism', () => {
    for (const { line } of FORM_REAL_LIFE_LINES) {
      expect(line.length).toBeLessThanOrEqual(REAL_LIFE_LINE_MAX_CHARS);
      expect(line.endsWith('.')).toBe(false);
      expect(line.startsWith('Real ')).toBe(true);
    }
  });
});
