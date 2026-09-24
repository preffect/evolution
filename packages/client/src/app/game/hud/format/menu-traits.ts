// The menu's `Your traits` rows (docs/ui/overlays.md §3.5): one per owned trait in catalog order, named with its tier
// numeral (`Cilia Fringe II`) and carrying the tier's effect lines from the one generator the picker cards use, so a
// retuned balance reads the same in both places. Each row links to the trait's encyclopedia entry. Pure.

import { TRAIT_CATALOG, type OwnedTrait, type TraitDefinition, type TraitId } from '@evolution/shared';
import { tierNumeral } from './trait-cards';
import type { ModifierEffect } from '../../quantities/modifier-labels';
import { describeTierModifierEffects, describeTierModifiers, type TraitModifierTables } from './trait-effects';

export interface MenuTraitRow {
  readonly traitId: TraitId;
  /** The catalog name and the tier numeral. */
  readonly name: string;
  /** One line per non-identity modifier, never cut; empty before the room's balance arrives. */
  readonly effects: readonly string[];
  /** Each effect line's effect on its owner, in the same order: the line's tone (#453). */
  readonly effectTones: readonly ModifierEffect[];
  /** The encyclopedia entry the row opens (architecture/encyclopedia.md §12). */
  readonly entryId: string;
}

const TRAIT_ENTRY_PREFIX = 'trait:';
const NO_HEIGHT = 0;

/**
 * What the `Your traits` list is capped at (docs/ui/overlays.md §3.5): the first `visibleRows` rows **as drawn**, so a
 * row carrying two effect lines is never sliced through its text. `MENU_TRAITS_VISIBLE_ROWS` is a row count, not a
 * pixel height, which is why the heights are measured rather than multiplied. `null` when the list holds no more rows
 * than that — nothing to scroll, so no cap — or before there is a layout to measure (every height still zero).
 */
export function visibleRowsHeightPx(rowHeightsPx: readonly number[], visibleRows: number): number | null {
  if (rowHeightsPx.length <= visibleRows) return null;
  const shown = rowHeightsPx.slice(0, visibleRows).reduce((total, height) => total + height, NO_HEIGHT);
  return shown > NO_HEIGHT ? shown : null;
}

/**
 * A trait's encyclopedia entry id, `trait:<traitId>` (docs/ui/encyclopedia.md §11.2). Its home moves to the
 * encyclopedia's own id module when #372 lands, since `game/encyclopedia/` never imports from `hud/`.
 */
export function traitEntryId(traitId: TraitId): string {
  return `${TRAIT_ENTRY_PREFIX}${traitId}`;
}

/** The rows for `ownedTraits` (the player's, so a spectator still sees theirs), in catalog order. */
export function menuTraitRowsFor(
  ownedTraits: readonly OwnedTrait[],
  traits: TraitModifierTables | null,
): MenuTraitRow[] {
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  return catalog.flatMap((definition): MenuTraitRow[] => {
    const owned = ownedTraits.find((trait) => trait.traitId === definition.id);
    if (owned === undefined) return [];
    return [
      {
        traitId: definition.id,
        name: `${definition.name} ${tierNumeral(owned.tier)}`,
        effects: traits === null ? [] : describeTierModifiers(traits, definition.id, owned.tier),
        effectTones: traits === null ? [] : describeTierModifierEffects(traits, definition.id, owned.tier),
        entryId: traitEntryId(definition.id),
      },
    ];
  });
}
