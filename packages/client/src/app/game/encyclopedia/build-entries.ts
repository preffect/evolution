// The entry definitions, joined from content and the balance's structure (docs/architecture/encyclopedia.md §12.2):
// catalog order inside each subject, subjects in `ENTRY_SUBJECT` order. Titles of traits are catalog names, tier
// sections one per row of `TRAIT_TIERS` (structure, never patched), previews built from ids. It reads no number;
// `registry.ts` calls it once with `DEFAULT_BALANCE`. #361 and #362 add their subjects here.

import {
  CELL_KIND,
  FIRST_TIER,
  tierOfRowIndex,
  type BalanceConfig,
  type OwnedTrait,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../render/preview/preview-spec';
import { DNA_TAG_ENTRY_CONTENT, dnaTagFacts } from './content/dna-tag-entries';
import { STAGE_ENTRY_CONTENT, stageFacts } from './content/stage-entries';
import { TRAIT_ENTRY_CONTENT, traitFacts } from './content/trait-entries';
import type { EntryDefinition, SectionDefinition } from './model/entry';
import { ENTRY_SUBJECT, entryIdOf } from './model/entry-id';

export const TIER_SECTION_KEY_PREFIX = 'tier_';
const NO_SECTIONS: readonly SectionDefinition[] = [];
const NO_EXTRA_FACTS: EntryDefinition['facts'] = [];

/** `tier_2`: the key of a trait's tier section and its deep-link anchor. */
export function tierSectionKey(tier: TraitTier): string {
  return `${TIER_SECTION_KEY_PREFIX}${tier}`;
}

/**
 * The tier a section key names, or `null` for a written section (`aerobic`) and for anything the prefix does not
 * start. It reads the keys this file writes, so the two stay one rule: the entry page turns a trait's sections into
 * the Effects by tier columns and has nothing else to go on — a `ResolvedSection` carries its key, not its tier.
 */
export function tierOfSectionKey(key: string): TraitTier | null {
  if (!key.startsWith(TIER_SECTION_KEY_PREFIX)) return null;
  const tier = Number(key.slice(TIER_SECTION_KEY_PREFIX.length));
  return Number.isInteger(tier) && tier >= FIRST_TIER ? (tier as TraitTier) : null;
}

function cellPreview(traits: readonly OwnedTrait[]): PreviewSpec {
  return { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.player, traits, motion: PREVIEW_MOTION.swimming };
}

function tierSections(balance: BalanceConfig, traitId: TraitId): readonly SectionDefinition[] {
  const bodies = TRAIT_ENTRY_CONTENT[traitId].tierBodies;
  return balance.traits.TRAIT_TIERS[traitId].map((_tierRow, index) => {
    const tier = tierOfRowIndex(index);
    const body = bodies[index];
    if (body === undefined) throw new Error(`The trait ${traitId} has no prose for tier ${tier}`);
    return {
      key: tierSectionKey(tier),
      heading: '',
      body,
      facts: [],
      preview: cellPreview([{ traitId, tier }]),
      tier: { traitId, tier },
    };
  });
}

function traitEntries(balance: BalanceConfig): readonly EntryDefinition[] {
  return balance.traits.TRAIT_CATALOG.map((row) => {
    const content = TRAIT_ENTRY_CONTENT[row.id];
    return {
      id: entryIdOf(ENTRY_SUBJECT.trait, row.id),
      title: row.name,
      summary: content.summary,
      facts: [...traitFacts(row.id), ...(content.extraFacts ?? NO_EXTRA_FACTS)],
      sections: tierSections(balance, row.id),
      seeAlso: content.seeAlso,
      preview: cellPreview([{ traitId: row.id, tier: FIRST_TIER }]),
    };
  });
}

/** A stage is previewed as a cell owning its first gate trait; the starting stage owns nothing. */
function stageEntries(balance: BalanceConfig): readonly EntryDefinition[] {
  return balance.ladder.STAGE_ORDER.map((stage) => ({
    id: entryIdOf(ENTRY_SUBJECT.stage, stage),
    title: STAGE_ENTRY_CONTENT[stage].title,
    summary: STAGE_ENTRY_CONTENT[stage].summary,
    facts: stageFacts(stage),
    sections: NO_SECTIONS,
    seeAlso: STAGE_ENTRY_CONTENT[stage].seeAlso,
    preview: cellPreview(
      balance.ladder.STAGE_GATE_TRAITS[stage].slice(0, 1).map((traitId) => ({ traitId, tier: FIRST_TIER })),
    ),
  }));
}

function dnaTagEntries(balance: BalanceConfig): readonly EntryDefinition[] {
  return balance.progression.DNA_TAGS.map((tag) => ({
    id: entryIdOf(ENTRY_SUBJECT.dnaTag, tag),
    title: DNA_TAG_ENTRY_CONTENT[tag].title,
    summary: DNA_TAG_ENTRY_CONTENT[tag].summary,
    facts: dnaTagFacts(tag),
    sections: NO_SECTIONS,
    seeAlso: [],
    preview: { scene: PREVIEW_SCENE.dnaFragment, tag },
  }));
}

export function buildEntryDefinitions(balance: BalanceConfig): readonly EntryDefinition[] {
  return [...stageEntries(balance), ...traitEntries(balance), ...dnaTagEntries(balance)];
}
