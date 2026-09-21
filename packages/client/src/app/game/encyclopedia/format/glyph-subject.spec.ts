// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TRAIT_CATALOG } from '@evolution/shared';
import { SUBJECT_GLYPHS } from '../../glyphs/subject-glyphs';
import { TRAIT_GLYPHS } from '../../glyphs/trait-glyphs';
import type { EntryId } from '../model/entry-id';
import { ENCYCLOPEDIA_ENTRIES } from '../registry';
import { GLYPH_SUBJECT, glyphSubjectOf } from './glyph-subject';

const TRAIT_IDS: ReadonlySet<string> = new Set(TRAIT_CATALOG.map((trait) => trait.id));

describe('glyphSubjectOf (docs/ui/encyclopedia.md §11.3)', () => {
  it('sends a trait entry to the trait glyph, keyed by the catalog id its own id ends in', () => {
    expect(glyphSubjectOf('trait:mitochondrion' as EntryId)).toEqual({
      kind: GLYPH_SUBJECT.trait,
      traitId: 'mitochondrion',
    });
  });

  it('sends every other subject to the subject glyph, keyed by the entry id whole', () => {
    expect(glyphSubjectOf('bacterium:aerobic' as EntryId)).toEqual({
      kind: GLYPH_SUBJECT.subject,
      entryId: 'bacterium:aerobic',
    });
  });

  it('splits on the subject and not on the separator: a code id may hold one of its own', () => {
    expect(glyphSubjectOf('concept:world_standing' as EntryId).kind).toBe(GLYPH_SUBJECT.subject);
  });

  /**
   * The cast inside `glyphSubjectOf` cannot be checked by the compiler, so it is checked here against the shipped
   * registry: every entry the panel can draw resolves to a glyph that actually exists.
   */
  it('picks a glyph that exists for every entry in the registry', () => {
    const missing = ENCYCLOPEDIA_ENTRIES.filter((entry) => {
      const subject = glyphSubjectOf(entry.id);
      return subject.kind === GLYPH_SUBJECT.trait
        ? !TRAIT_IDS.has(subject.traitId) || TRAIT_GLYPHS[subject.traitId] === undefined
        : SUBJECT_GLYPHS[subject.entryId] === undefined;
    });
    expect(missing.map((entry) => entry.id)).toEqual([]);
    expect(ENCYCLOPEDIA_ENTRIES.length).toBeGreaterThan(0);
  });
});
