// The trait picker's record (docs/ui/overlays.md §3.2): the open offer turned into what the band reads — the title,
// the countdown and one view per card (name, tier or `I → II` upgrade, category, rarity, generated effect lines, the
// `RUNG` ribbon when the card climbs the ladder, its key chip). Everything the overlay shows is decided here, so the
// components only bind it. Pure.

import {
  STAGE_GATE_TRAITS,
  TICK_HZ,
  TRAIT_CATALOG,
  clamp,
  nextStage,
  type BalanceConfig,
  type CellView,
  type OwnedTrait,
  type TraitCategory,
  type TraitDefinition,
  type TraitId,
  type TraitOfferView,
  type TraitRarity,
} from '@evolution/shared';
import { describeTierModifiers } from './trait-effects';

/** Tier I..III as the card names them. */
export const TIER_NUMERALS = ['I', 'II', 'III'] as const;

const NO_TIME = 0;
const FULL = 1;
const TIMER_DECIMALS = 1;
const FIRST_KEY = 1;
const UPGRADE_ARROW = '→';

export interface TraitCardView {
  readonly index: number;
  readonly traitId: TraitId;
  readonly name: string;
  /** `II`, or `I → II` for an upgrade of an owned trait. */
  readonly tierLabel: string;
  readonly isUpgrade: boolean;
  /** The trait is a gate of the own cell's next stage: the card carries the `RUNG` ribbon. */
  readonly isRung: boolean;
  readonly category: TraitCategory;
  /** The medallion's letter until #312's glyphs replace it. */
  readonly categoryInitial: string;
  readonly rarity: TraitRarity;
  readonly effects: readonly string[];
  /** The `1` `2` `3` chip under the card. */
  readonly keyLabel: string;
}

export interface TraitOfferViewModel {
  readonly offerId: number;
  readonly title: string;
  readonly cards: readonly TraitCardView[];
  /** Seconds until the server picks for the player, clamped to the choice window. */
  readonly secondsLeft: number;
  /** `6.5 s`. */
  readonly secondsText: string;
  /** 1 at the offer's start, 0 when the dish picks: the timer bar's fill. */
  readonly timerFraction: number;
}

export interface TraitOfferInput {
  readonly offer: TraitOfferView;
  readonly level: number;
  /** The own cell for the rung and upgrade marks; `null` while spectating, when neither can be known. */
  readonly ownCell: CellView | null;
  /** The newest snapshot's tick: the countdown's clock. */
  readonly serverTick: number;
  readonly balance: Pick<BalanceConfig, 'progression'>;
}

function definitionOf(traitId: TraitId): TraitDefinition | undefined {
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  return catalog.find((trait) => trait.id === traitId);
}

function numeral(tier: number): string {
  return TIER_NUMERALS[clamp(tier, FIRST_KEY, TIER_NUMERALS.length) - 1] ?? String(tier);
}

function isRungFor(traitId: TraitId, ownCell: CellView | null): boolean {
  const rung = ownCell === null ? null : nextStage(ownCell.stage);
  return rung !== null && STAGE_GATE_TRAITS[rung].includes(traitId);
}

function cardView(card: OwnedTrait, index: number, ownCell: CellView | null): TraitCardView {
  const definition = definitionOf(card.traitId);
  const owned = ownCell?.traits.find((trait) => trait.traitId === card.traitId);
  const isUpgrade = owned !== undefined && card.tier > owned.tier;
  const category = definition?.category ?? ('genome' as TraitCategory);
  return {
    index,
    traitId: card.traitId,
    name: definition?.name ?? card.traitId,
    tierLabel: isUpgrade ? `${numeral(owned.tier)} ${UPGRADE_ARROW} ${numeral(card.tier)}` : numeral(card.tier),
    isUpgrade,
    isRung: isRungFor(card.traitId, ownCell),
    category,
    categoryInitial: category.charAt(0).toUpperCase(),
    rarity: definition?.rarity ?? ('common' as TraitRarity),
    effects: describeTierModifiers(card.traitId, card.tier),
    keyLabel: String(index + FIRST_KEY),
  };
}

export function traitOfferViewFor(input: TraitOfferInput): TraitOfferViewModel {
  const { offer } = input;
  const windowSeconds = input.balance.progression.TRAIT_CHOICE_TIMEOUT_SECONDS;
  const secondsLeft = clamp((offer.expiresAtTick - input.serverTick) / TICK_HZ, NO_TIME, windowSeconds);
  return {
    offerId: offer.offerId,
    title: `LEVEL ${input.level} · CHOOSE A TRAIT`,
    cards: offer.cards.map((card, index) => cardView(card, index, input.ownCell)),
    secondsLeft,
    secondsText: `${secondsLeft.toFixed(TIMER_DECIMALS)} s`,
    timerFraction: windowSeconds > NO_TIME ? clamp(secondsLeft / windowSeconds, NO_TIME, FULL) : NO_TIME,
  };
}
