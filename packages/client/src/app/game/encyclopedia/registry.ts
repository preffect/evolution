// The encyclopedia's registry (docs/architecture/encyclopedia.md §12.2): every entry definition, assembled once at
// module load from `DEFAULT_BALANCE`'s structure (catalog rows and walk orders, which a patch never changes), and the
// pure lookups over it. Every number is read from the `FactContext` a caller passes, never from here.

import { DEFAULT_BALANCE } from '@evolution/shared';
import { buildEntryDefinitions } from './build-entries';
import { categoryOf, type EncyclopediaCategory } from './model/categories';
import type { EntryDefinition, EntryLink, ResolvedEntry, ResolvedGroup } from './model/entry';
import { splitEntryReference, type EntryId } from './model/entry-id';
import type { FactContext } from './model/fact';
import { CATEGORY_GROUPS } from './model/groups';
import { entryGroup, resolveEntryDefinition, type EntryLookup } from './resolve-entry';

export const ENCYCLOPEDIA_ENTRIES: readonly EntryDefinition[] = buildEntryDefinitions(DEFAULT_BALANCE);

export const ENTRY_BY_ID: ReadonlyMap<EntryId, EntryDefinition> = new Map(
  ENCYCLOPEDIA_ENTRIES.map((definition) => [definition.id, definition]),
);

export function entryById(entryId: EntryId): EntryDefinition {
  const definition = ENTRY_BY_ID.get(entryId);
  if (definition === undefined) throw new Error(`The encyclopedia has no entry ${entryId}`);
  return definition;
}

export function entryTitle(entryId: EntryId): string {
  return entryById(entryId).title;
}

/** Whether `reference` names an entry, or a section of one (`trait:cell_wall#tier_2`). */
export function isEntryReference(reference: string): boolean {
  const { entryId, sectionKey } = splitEntryReference(reference);
  const definition = ENTRY_BY_ID.get(entryId as EntryId);
  if (definition === undefined) return false;
  return sectionKey === null || definition.sections.some((section) => section.key === sectionKey);
}

const REGISTRY_LOOKUP: EntryLookup = { titleOf: entryTitle, isReference: isEntryReference };

export function resolveEntry(entryId: EntryId, context: FactContext): ResolvedEntry {
  return resolveEntryDefinition(entryById(entryId), context, REGISTRY_LOOKUP);
}

function linkOf(definition: EntryDefinition): EntryLink {
  return { entryId: definition.id, title: definition.title };
}

/** The category's non-empty groups in walk order, each with its entries in registry order; one `null` group when ungrouped. */
export function entriesIn(category: EncyclopediaCategory): readonly ResolvedGroup[] {
  const definitions = ENCYCLOPEDIA_ENTRIES.filter((definition) => categoryOf(definition.id) === category);
  const groups = CATEGORY_GROUPS[category];
  if (groups.length === 0) return definitions.length === 0 ? [] : [{ group: null, entries: definitions.map(linkOf) }];
  return groups
    .map((group) => ({
      group,
      entries: definitions.filter((definition) => entryGroup(definition.id, DEFAULT_BALANCE) === group).map(linkOf),
    }))
    .filter((resolvedGroup) => resolvedGroup.entries.length > 0);
}
