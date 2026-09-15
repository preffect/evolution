// One entry definition to the resolved entry a page binds (docs/architecture/encyclopedia.md §12.2): every value read
// from the context's live balance and formatted, every link titled, the category, group and subject derived. Pure:
// the registry supplies the titles and the reference check, so this file never imports the registry.

import type { TraitId } from '@evolution/shared';
import { formatQuantity } from '../quantities/format-quantity';
import { QUANTITY_UNIT } from '../quantities/quantity-unit';
import { traitRowOf } from './facts/catalog-quantities';
import { DERIVED_LINK, derivedLinkTargets } from './facts/derived-links';
import { resolveFacts, resolveTierFacts, resolveTierValueFacts, type TitleOf } from './facts/resolve-fact';
import { resolveProse, type ProseScope } from './facts/resolve-prose';
import { categoryOf } from './model/categories';
import type {
  EntryDefinition,
  EntryLink,
  ResolvedEntry,
  ResolvedSection,
  ResolvedSubject,
  SectionDefinition,
} from './model/entry';
import { ENTRY_SUBJECT, splitEntryId, type EntryId } from './model/entry-id';
import type { FactContext } from './model/fact';
import { groupOf } from './model/groups';
import { PROSE_TOKEN } from './model/prose';

export interface EntryLookup {
  readonly titleOf: TitleOf;
  readonly isReference: (reference: string) => boolean;
}

function resolveSubject(entryId: EntryId, context: FactContext): ResolvedSubject {
  const { subject, codeId } = splitEntryId(entryId);
  if (subject !== ENTRY_SUBJECT.trait) return { kind: subject, codeId };
  const row = traitRowOf(context.balance, codeId as TraitId);
  return {
    kind: subject,
    traitId: row.id,
    traitCategory: row.category,
    rarity: row.rarity,
    dnaTags: row.tags,
    stage: row.stage,
    tierCount: context.balance.traits.TRAIT_TIERS[row.id].length,
  };
}

function resolveSection(section: SectionDefinition, context: FactContext, entryScope: ProseScope): ResolvedSection {
  const facts =
    section.tier === null
      ? resolveFacts(section.facts, context, entryScope.titleOf)
      : resolveTierFacts(context.balance, section.tier.traitId, section.tier.tier);
  const proseFacts =
    section.tier === null ? facts : resolveTierValueFacts(context.balance, section.tier.traitId, section.tier.tier);
  const scope: ProseScope = { ...entryScope, facts: [...proseFacts, ...entryScope.facts] };
  const heading =
    section.tier === null
      ? resolveProse(section.heading, scope)
      : [{ kind: PROSE_TOKEN.text, text: formatQuantity(section.tier.tier, QUANTITY_UNIT.tier) }];
  return { key: section.key, heading, body: resolveProse(section.body, scope), facts, preview: section.preview };
}

/** The hand-picked links, then the derived ones (a trait's requires), each entry once. */
function seeAlsoOf(definition: EntryDefinition, context: FactContext, titleOf: TitleOf): readonly EntryLink[] {
  const { subject, codeId } = splitEntryId(definition.id);
  const derived =
    subject === ENTRY_SUBJECT.trait
      ? derivedLinkTargets(context.balance, {
          id: DERIVED_LINK.traitRequires,
          argument: { traitId: codeId as TraitId },
        })
      : [];
  return [...new Set([...definition.seeAlso, ...derived])].map((entryId) => ({ entryId, title: titleOf(entryId) }));
}

export function resolveEntryDefinition(
  definition: EntryDefinition,
  context: FactContext,
  lookup: EntryLookup,
): ResolvedEntry {
  const facts = resolveFacts(definition.facts, context, lookup.titleOf);
  const scope: ProseScope = { facts, titleOf: lookup.titleOf, isReference: lookup.isReference };
  const subject = resolveSubject(definition.id, context);
  return {
    id: definition.id,
    category: categoryOf(definition.id),
    subject,
    group: groupOf(definition.id, subject.kind === ENTRY_SUBJECT.trait ? subject.traitCategory : null),
    title: definition.title,
    summary: resolveProse(definition.summary, scope),
    headline: facts[0] ?? null,
    facts,
    sections: definition.sections.map((section) => resolveSection(section, context, scope)),
    seeAlso: seeAlsoOf(definition, context, lookup.titleOf),
    preview: definition.preview,
  };
}
