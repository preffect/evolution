// Facts to text (docs/architecture/encyclopedia.md §12.3): a value fact through `formatQuantity` in its unit, a link
// fact as one fact per target titled by the registry, and a trait's tier facts generated from the live tier table
// through the cards' own label table, so a card and its encyclopedia page can never read differently. Pure.

import type { BalanceConfig, CellModifiers, TraitId, TraitTierModifiers } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { MODIFIER_LABELS, nonIdentityModifiers } from '../../quantities/modifier-labels';
import type { EntryLink, ResolvedFact } from '../model/entry';
import type { EntryId } from '../model/entry-id';
import { FACT_SOURCE, isLinkFact, type FactContext, type FactDefinition, type ValueFactSource } from '../model/fact';
import { readBalancePath } from './balance-path';
import { evaluateCatalogQuantity } from './catalog-quantities';
import { derivedLinkTargets } from './derived-links';
import { evaluateFormula } from './formula-table';

/** The registry's title of an entry: what a link fact and a prose link show. */
export type TitleOf = (entryId: EntryId) => string;

const FIRST_TIER = 1;

/** A value source's number over `balance`; `null` for a catalog count that does not apply to its subject. */
export function valueOfSource(source: ValueFactSource, balance: BalanceConfig): number | null {
  switch (source.kind) {
    case FACT_SOURCE.balance:
      return readBalancePath(balance, source.path);
    case FACT_SOURCE.formula:
      return evaluateFormula(balance, source.formula);
    case FACT_SOURCE.catalog:
      return evaluateCatalogQuantity(balance, source.quantity);
  }
}

function resolveFact(definition: FactDefinition, context: FactContext, titleOf: TitleOf): ResolvedFact[] {
  if (isLinkFact(definition)) {
    return derivedLinkTargets(context.balance, definition.source.link).map((entryId) => {
      const link: EntryLink = { entryId, title: titleOf(entryId) };
      return { key: definition.key, label: definition.label, text: link.title, link };
    });
  }
  const value = valueOfSource(definition.source, context.balance);
  if (value === null) return [];
  const text = formatQuantity(value, definition.unit, { presentation: definition.presentation });
  return [{ key: definition.key, label: definition.label, text, link: null }];
}

/** Every definition in order; a link fact expands to one fact per target and a fact that does not apply to none. */
export function resolveFacts(
  definitions: readonly FactDefinition[],
  context: FactContext,
  titleOf: TitleOf,
): readonly ResolvedFact[] {
  return definitions.flatMap((definition) => resolveFact(definition, context, titleOf));
}

function tierRowOf(balance: BalanceConfig, traitId: TraitId, tier: number): TraitTierModifiers {
  const tierRow = balance.traits.TRAIT_TIERS[traitId][tier - FIRST_TIER];
  if (tierRow === undefined) throw new Error(`The trait ${traitId} has no tier ${tier}`);
  return tierRow;
}

function modifierFact(key: keyof CellModifiers, value: number): ResolvedFact {
  return { key, label: MODIFIER_LABELS[key].noun, text: MODIFIER_LABELS[key].formatValue(value), link: null };
}

/** Tier `tier` (1-based) of `traitId`: one fact per modifier it sets away from identity, in the row's order. */
export function resolveTierFacts(balance: BalanceConfig, traitId: TraitId, tier: number): readonly ResolvedFact[] {
  const tierRow = tierRowOf(balance, traitId, tier);
  return nonIdentityModifiers(tierRow, balance.traits.DEFAULT_CELL_MODIFIERS).map(([key, value]) =>
    modifierFact(key, value),
  );
}

/**
 * Every modifier's value at tier `tier`, identity where the row leaves it: what a tier body's `{modifierKey}` token
 * reads, so a patch that returns a modifier to identity shows its identity text instead of breaking the page.
 */
export function resolveTierValueFacts(balance: BalanceConfig, traitId: TraitId, tier: number): readonly ResolvedFact[] {
  const values: CellModifiers = { ...balance.traits.DEFAULT_CELL_MODIFIERS, ...tierRowOf(balance, traitId, tier) };
  return (Object.entries(values) as [keyof CellModifiers, number][]).map(([key, value]) => modifierFact(key, value));
}
