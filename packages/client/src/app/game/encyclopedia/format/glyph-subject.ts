// Which glyph an entry wears, pure (docs/ui/encyclopedia.md §11.3): a trait's is `<app-trait-glyph>` (#312), keyed by
// the catalog trait id; a giant cell's is `<app-giant-glyph>`, its form's trait glyph in the giant's own palette,
// since the giant is that form drawn large (tickets #831, #846); and every other subject's is `<app-subject-glyph>`
// (#391), keyed by the entry id itself. The split is the entry id's grammar (§12.2) and nothing else, so a row and a
// tile never disagree about it.

import type { GiantSpecies, TraitId } from '@evolution/shared';
import type { SubjectEntryId } from '../../render/svg-glyph';
import { ENTRY_ID_SEPARATOR, ENTRY_SUBJECT, type EntryId, type EntryIdOf } from '../model/entry-id';

export const GLYPH_SUBJECT = { trait: 'trait', giant: 'giant', subject: 'subject' } as const;

export type EncyclopediaGlyphSubject =
  | { readonly kind: typeof GLYPH_SUBJECT.trait; readonly traitId: TraitId }
  | { readonly kind: typeof GLYPH_SUBJECT.giant; readonly species: GiantSpecies }
  | { readonly kind: typeof GLYPH_SUBJECT.subject; readonly entryId: SubjectEntryId };

const TRAIT_ENTRY_ID_PREFIX = `${ENTRY_SUBJECT.trait}${ENTRY_ID_SEPARATOR}`;
const GIANT_ENTRY_ID_PREFIX = `${ENTRY_SUBJECT.giant}${ENTRY_ID_SEPARATOR}`;

/** Narrows on the id's own subject, so the last arm is `SubjectEntryId` — exactly what the subject glyph takes. */
function isTraitEntryId(entryId: EntryId): entryId is EntryIdOf<typeof ENTRY_SUBJECT.trait> {
  return entryId.startsWith(TRAIT_ENTRY_ID_PREFIX);
}

function isGiantEntryId(entryId: EntryId): entryId is EntryIdOf<typeof ENTRY_SUBJECT.giant> {
  return entryId.startsWith(GIANT_ENTRY_ID_PREFIX);
}

/**
 * The glyph `entryId` wears. A trait entry's id is `trait:<TraitId>` by construction (§12.2), so its tail *is* the
 * catalog id; `glyph-subject.spec.ts` walks the whole registry to hold that, since the cast cannot.
 */
export function glyphSubjectOf(entryId: EntryId): EncyclopediaGlyphSubject {
  if (isTraitEntryId(entryId)) {
    return { kind: GLYPH_SUBJECT.trait, traitId: entryId.slice(TRAIT_ENTRY_ID_PREFIX.length) as TraitId };
  }
  if (isGiantEntryId(entryId)) {
    return { kind: GLYPH_SUBJECT.giant, species: entryId.slice(GIANT_ENTRY_ID_PREFIX.length) as GiantSpecies };
  }
  return { kind: GLYPH_SUBJECT.subject, entryId };
}
