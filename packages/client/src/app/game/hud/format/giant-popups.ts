// The giant popup (docs/ui/overlays.md §3.8, docs/ecology/giants.md §3.5.8): the own cell swallowed a giant, so the
// form popup's big moment names the giant, the DNA it paid and one real-life line about the organism. It fires on a
// `cell_absorbed` effect whose predator is the own cell and whose prey had a species; a giant eaten by anything else
// shows nothing. Pure: `upgrade-popups.ts` queues what this answers with the trait popups.

import { EFFECT_KIND, type EntityId, type GameEffect } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { UI_EFFECT } from '../../../ui-kit/ui-effect-mark.component';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from './giant-facts';
import { UPGRADE_POPUP_KIND, type UpgradePopupContent } from './upgrade-popup-kinds';

/** The giant popup's kicker above the name: it names the moment in the death overlay's verb. */
export const GIANT_POPUP_KICKER_TEXT = 'GIANT ENGULFED';

/** `+200 DNA`: what the payout added, the multiplier and any cap overflow included, as the effect measured it. */
function dnaGainedLine(dnaGained: number): string {
  return formatQuantity(dnaGained, QUANTITY_UNIT.dna, { presentation: QUANTITY_PRESENTATION.signedChange });
}

/** One giant popup per giant the own cell swallowed in this broadcast window's `effects`, in their order. */
export function giantPopupsIn(effects: readonly GameEffect[], ownCellId: EntityId): UpgradePopupContent[] {
  return effects.flatMap((effect) => {
    if (effect.kind !== EFFECT_KIND.cellAbsorbed || effect.predatorCellId !== ownCellId) return [];
    const species = effect.preyGiantSpecies;
    if (species === null) return [];
    return [
      {
        kind: UPGRADE_POPUP_KIND.giant,
        kicker: GIANT_POPUP_KICKER_TEXT,
        traitId: null,
        giantSpecies: species,
        title: GIANT_DISPLAY_NAME_BY_SPECIES[species],
        effects: [dnaGainedLine(effect.predatorDnaGained)],
        effectTones: [UI_EFFECT.benefit],
        realLifeLine: GIANT_REAL_LIFE_LINES[species],
      },
    ];
  });
}
