// The Effects by tier table of a trait's entry page (docs/ui/encyclopedia.md §11.4), pure: one column per `tier_n`
// section, one row per modifier any of them sets. The unit is in the row's name and each cell holds the bare figure
// (#858), both halves of the one split `formatModifierParts` makes; the tier numerals and the sections come from
// `entry-view.ts`, which the lens's tier switch is built from too.

import type { TraitTier } from '@evolution/shared';
import {
  ENCYCLOPEDIA_TIER_CAPTION_PREFIX,
  ENCYCLOPEDIA_TIER_IDENTITY_TEXT,
  ENCYCLOPEDIA_TIER_UNIT_CLOSE,
  ENCYCLOPEDIA_TIER_UNIT_OPEN,
} from '../encyclopedia-constants';
import type { ResolvedFact, ResolvedSection } from '../model/entry';
import { NO_FACT_LINKS, tierNumeral, tierSectionsOf, type EncyclopediaFactRow } from './entry-view';

/** The Effects by tier table (§11.4): one column per `tier_n` section, one row per modifier key any of them sets. */
export interface EncyclopediaTierTable {
  /** `You own II`, or empty outside a round: the header cell over the noun column. */
  readonly caption: string;
  /** The tier numerals, in tier order. */
  readonly columns: readonly string[];
  /** Plain value rows: a tier's effect is a figure, never a link, so every row's `links` is empty. */
  readonly rows: readonly EncyclopediaFactRow[];
  /** The owned tier's column, tinted accent; `null` when the round does not have the trait. */
  readonly highlightColumn: number | null;
}

/**
 * A modifier's noun as the tier table writes it: §11.4's `Mass decay`, from the `mass decay` the trait cards read
 * inside a sentence (`+15 % speed`). One place, so the two never drift into two spellings of one effect.
 */
export function factNameFromNoun(noun: string): string {
  return `${noun.slice(0, 1).toUpperCase()}${noun.slice(1)}`;
}

/**
 * A tier row's name (§11.4, #858): the noun, then the unit its cells' bare figures are in, `In sunlight (mass / s)`.
 * The unit is the modifier's own, so it is the same in every tier; a unit with no header form adds nothing.
 */
export function tierRowName(fact: ResolvedFact): string {
  const name = factNameFromNoun(fact.label);
  const unit = fact.parts?.unit ?? '';
  return unit === '' ? name : `${name}${ENCYCLOPEDIA_TIER_UNIT_OPEN}${unit}${ENCYCLOPEDIA_TIER_UNIT_CLOSE}`;
}

/** The fact a tier section sets for a row's modifier; `undefined` where the tier leaves it at identity. */
function tierFactOf(section: ResolvedSection, key: string): ResolvedFact | undefined {
  return section.facts.find((candidate) => candidate.key === key);
}

/**
 * A tier's cell for a row: its bare figure, or the identity mark where the tier leaves the modifier alone. A fact
 * without a split reads whole, as `tierRowName` then leaves the unit out of the name, so the row never loses it.
 */
function tierCellText(section: ResolvedSection, key: string): string {
  const tierFact = tierFactOf(section, key);
  if (tierFact === undefined) return ENCYCLOPEDIA_TIER_IDENTITY_TEXT;
  return tierFact.parts?.figure ?? tierFact.text;
}

/** The union of the modifier keys the tier sections carry, in the order the sections first name each one. */
function modifierKeysOf(sections: readonly ResolvedSection[]): readonly ResolvedFact[] {
  const byKey = new Map<string, ResolvedFact>();
  for (const section of sections) {
    for (const fact of section.facts) if (!byKey.has(fact.key)) byKey.set(fact.key, fact);
  }
  return [...byKey.values()];
}

/**
 * The tier table, or `null` for an entry with no tier section — which is every entry but a trait, and a trait whose
 * tiers all sit at identity, where §11.4 says a table with no rows is left out rather than drawn empty.
 */
export function tierTableFor(
  sections: readonly ResolvedSection[],
  ownedTier: TraitTier | null,
): EncyclopediaTierTable | null {
  const tiers = tierSectionsOf(sections);
  const rows: EncyclopediaFactRow[] = modifierKeysOf(tiers.map((column) => column.section)).map((fact) => ({
    rowId: fact.key,
    name: tierRowName(fact),
    values: tiers.map((column) => tierCellText(column.section, fact.key)),
    effects: tiers.map((column) => tierFactOf(column.section, fact.key)?.effect ?? null),
    links: NO_FACT_LINKS,
  }));
  if (rows.length === 0) return null;
  const ownedColumn = tiers.findIndex((column) => column.tier === ownedTier);
  return {
    caption: ownedTier === null ? '' : `${ENCYCLOPEDIA_TIER_CAPTION_PREFIX}${tierNumeral(ownedTier)}`,
    columns: tiers.map((column) => tierNumeral(column.tier)),
    rows,
    highlightColumn: ownedColumn < 0 ? null : ownedColumn,
  };
}
