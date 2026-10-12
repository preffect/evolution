// The giant popup (docs/ui/overlays.md §3.8, docs/ecology/giants.md §3.5.8): the own cell swallowed a giant, so the
// form popup's big moment names the giant, the DNA it paid and one real-life line about the organism. It fires on a
// `cell_absorbed` effect whose predator is the own cell and whose prey had a species; a giant eaten by anything else
// shows nothing. The swallow is an event, so it is taken from the `GameEventBus`, which hears every snapshot in arrival
// order, and not from the newest snapshot, which two broadcasts landing before one refresh fold into one. Pure:
// `UpgradePopupService` keeps the swallows not yet past; `upgrade-popups.ts` queues their popups with the trait ones.

import { EFFECT_KIND, secondsToTicks, type GameEffect, type GiantSpecies } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { UI_EFFECT } from '../../../ui-kit/ui-effect-mark.component';
import { GIANT_DISPLAY_NAME_BY_SPECIES, GIANT_REAL_LIFE_LINES } from './giant-facts';
import { FORM_POPUP_DURATION_SECONDS } from '../upgrade-popup-constants';
import { UPGRADE_POPUP_KIND, type UpgradePopupContent } from './upgrade-popup-kinds';

/** The giant popup's kicker above the name: it names the moment in the death overlay's verb. */
export const GIANT_POPUP_KICKER_TEXT = 'GIANT ENGULFED';

/** `+200 DNA`: what the payout added, the multiplier and any cap overflow included, as the effect measured it. */
function dnaGainedLine(dnaGained: number): string {
  return formatQuantity(dnaGained, QUANTITY_UNIT.dna, { presentation: QUANTITY_PRESENTATION.signedChange });
}

/** A giant the own cell swallowed, as the bus reported it: the seat, the tick it happened, the giant, the DNA paid. */
export interface GiantSwallow {
  readonly seatKey: string;
  readonly tick: number;
  readonly species: GiantSpecies;
  readonly dnaGained: number;
}

/**
 * How long a swallow waits to be folded: a giant popup's life. Only a page frozen that long between two swallows can
 * lose the older one, and its popup would have been over by then.
 */
const GIANT_SWALLOW_KEPT_TICKS = secondsToTicks(FORM_POPUP_DURATION_SECONDS);

/** The swallow `effect` is, when the own cell is its predator (`isOwnPredator`) and its prey a giant; else `null`. */
export function giantSwallowOf(effect: GameEffect, isOwnPredator: boolean, seatKey: string): GiantSwallow | null {
  if (!isOwnPredator || effect.kind !== EFFECT_KIND.cellAbsorbed) return null;
  const species = effect.preyGiantSpecies;
  if (species === null) return null;
  return { seatKey, tick: effect.tick, species, dnaGained: effect.predatorDnaGained };
}

/** `kept` with `swallow` added: a swallow of another seat, after it (the clock went back) or past its wait leaves. */
export function withGiantSwallow(kept: readonly GiantSwallow[], swallow: GiantSwallow): GiantSwallow[] {
  const waiting = kept.filter(
    (earlier) =>
      earlier.seatKey === swallow.seatKey &&
      earlier.tick <= swallow.tick &&
      swallow.tick - earlier.tick < GIANT_SWALLOW_KEPT_TICKS,
  );
  return [...waiting, swallow];
}

/**
 * One giant popup per swallow of `seatKey` that happened after `afterTick` and by `throughTick`, in their order: the
 * swallows the snapshots since the last fold carried, so folding the same tick again fires nothing.
 */
export function giantPopupsIn(
  swallows: readonly GiantSwallow[],
  seatKey: string,
  afterTick: number,
  throughTick: number,
): UpgradePopupContent[] {
  return swallows
    .filter((swallow) => swallow.seatKey === seatKey && swallow.tick > afterTick && swallow.tick <= throughTick)
    .map((swallow) => ({
      kind: UPGRADE_POPUP_KIND.giant,
      kicker: GIANT_POPUP_KICKER_TEXT,
      traitId: null,
      giantSpecies: swallow.species,
      title: GIANT_DISPLAY_NAME_BY_SPECIES[swallow.species],
      effects: [dnaGainedLine(swallow.dnaGained)],
      effectTones: [UI_EFFECT.benefit],
      realLifeLine: GIANT_REAL_LIFE_LINES[swallow.species],
    }));
}
