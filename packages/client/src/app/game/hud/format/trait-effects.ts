// A trait card's effect lines (docs/ui/overlays.md §3.2): the tier's modifier row through the one label table
// (`quantities/modifier-labels.ts`), so no card copy is hand-written and a retuned number reads right the moment it
// lands. The row and the identity record are read from the live balance (`balance.traits.TRAIT_TIERS`,
// `balance.traits.DEFAULT_CELL_MODIFIERS`, architecture/constants-files-tests.md §9), so a `debug_set_balance` patch
// reaches the cards. A value at its identity says nothing and is skipped; every other one is a line, in the tier row's
// own order, so a card never hides a trait's cost. The spec pins that no tier row has more than
// `PICKER_CARD_EFFECT_LINES_MAX` of them, so a row that outgrows the card fails the gate instead of being cut. That
// guard counts lines, not the rows a long line wraps onto; #428 adds the rendered-height one. Pure.

import { FIRST_TIER, tierRowOf, type BalanceConfig, type TraitId, type TraitTierModifiers } from '@evolution/shared';
import {
  modifierLineEffects,
  modifierLines,
  nonIdentityModifiers,
  type ModifierEffect,
} from '../../quantities/modifier-labels';

/** What a card reads from the live balance: the tier tables and the identity record, never the module constants. */
export type TraitModifierTables = Pick<BalanceConfig['traits'], 'TRAIT_TIERS' | 'DEFAULT_CELL_MODIFIERS'>;

/** `traitId`'s tier row (1..3); an empty row for a trait or tier the table does not hold. */
function tierModifierRow(traits: TraitModifierTables, traitId: TraitId, tier: number): TraitTierModifiers {
  const tiers = traits.TRAIT_TIERS[traitId];
  return tiers === undefined ? {} : (tierRowOf(tiers, Math.max(tier, FIRST_TIER)) ?? {});
}

/** The card's effect lines for `traitId` at `tier` (1..3): one per modifier that differs from identity, none cut. */
export function describeTierModifiers(traits: TraitModifierTables, traitId: TraitId, tier: number): string[] {
  return modifierLines(nonIdentityModifiers(tierModifierRow(traits, traitId, tier), traits.DEFAULT_CELL_MODIFIERS));
}

/** Each of `describeTierModifiers`' lines' effect on its owner, in the same order, so a surface tones it (#453). */
export function describeTierModifierEffects(
  traits: TraitModifierTables,
  traitId: TraitId,
  tier: number,
): ModifierEffect[] {
  return modifierLineEffects(
    nonIdentityModifiers(tierModifierRow(traits, traitId, tier), traits.DEFAULT_CELL_MODIFIERS),
    traits.DEFAULT_CELL_MODIFIERS,
  );
}
