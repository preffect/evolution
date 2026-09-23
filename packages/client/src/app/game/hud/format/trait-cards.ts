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
  type CellStage,
  type OwnedTrait,
  type PlayerProgressView,
  type TraitCategory,
  type TraitDefinition,
  type TraitId,
  type TraitOfferView,
  type TraitRarity,
} from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { describeTierModifiers, type TraitModifierTables } from './trait-effects';

const NO_TIME = 0;
const FULL = 1;
const FIRST_KEY = 1;
const UPGRADE_ARROW = '→';
/**
 * A card's narrow column wraps its lines, so the places a wrap would split a reading are bound (#446): a number to
 * the unit after it (`70 %`), a unit's slash to both sides (`% / s`), and an upgrade's tiers to the arrow between
 * them (`I → II`). A no-break space is the same width as a space, so binding costs the card nothing.
 */
const NO_BREAK_SPACE = '\u00a0';
/** A space after a digit: the number meets its unit there. */
const SPACE_AFTER_NUMBER = /(\d) /g;
/** A unit's slash with a space either side: `% / s`, `mass / s`. */
const SPACED_SLASH = / \/ /g;

export interface TraitCardView {
  readonly index: number;
  readonly traitId: TraitId;
  readonly name: string;
  /** `II`, or `I → II` for an upgrade of an owned trait. */
  readonly tierLabel: string;
  readonly isUpgrade: boolean;
  /** The trait is a gate of the player's next stage: the card carries the `RUNG` ribbon. */
  readonly isRung: boolean;
  readonly category: TraitCategory;
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
  /** The owned tiers and stage for the upgrade and rung marks: the player's, so they hold while spectating. */
  readonly progress: Pick<PlayerProgressView, 'ownedTraits' | 'stage'>;
  /** The newest snapshot's tick: the countdown's clock. */
  readonly serverTick: number;
  /** The live balance: the choice window, and the tier tables the effect lines read. */
  readonly balance: Pick<BalanceConfig, 'progression' | 'traits'>;
}

// Every offered card comes from the server's catalog and tier table, so a miss is a broken contract: the band
// refuses it loudly rather than drawing a plausible card for a trait nobody can pick.

function definitionOf(traitId: TraitId): TraitDefinition {
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  const definition = catalog.find((trait) => trait.id === traitId);
  if (definition === undefined) throw new Error(`Offered trait ${traitId} is not in TRAIT_CATALOG`);
  return definition;
}

/** `II`; a tier past the numerals throws, since only a broken server contract can offer one. */
export function tierNumeral(tier: number): string {
  return formatQuantity(tier, QUANTITY_UNIT.tier, { presentation: QUANTITY_PRESENTATION.numeral });
}

function isRungFor(traitId: TraitId, stage: CellStage): boolean {
  const rung = nextStage(stage);
  return rung !== null && STAGE_GATE_TRAITS[rung].includes(traitId);
}

function cardView(
  card: OwnedTrait,
  index: number,
  progress: TraitOfferInput['progress'],
  traits: TraitModifierTables,
): TraitCardView {
  const definition = definitionOf(card.traitId);
  const owned = progress.ownedTraits.find((trait) => trait.traitId === card.traitId);
  const isUpgrade = owned !== undefined && card.tier > owned.tier;
  const { category } = definition;
  return {
    index,
    traitId: card.traitId,
    name: definition.name,
    tierLabel: isUpgrade
      ? `${tierNumeral(owned.tier)}${NO_BREAK_SPACE}${UPGRADE_ARROW}${NO_BREAK_SPACE}${tierNumeral(card.tier)}`
      : tierNumeral(card.tier),
    isUpgrade,
    isRung: isRungFor(card.traitId, progress.stage),
    category,
    rarity: definition.rarity,
    effects: describeTierModifiers(traits, card.traitId, card.tier).map(bindQuantities),
    keyLabel: String(index + FIRST_KEY),
  };
}

/** `line` with its numbers bound to their units and its unit slashes bound to both sides, so a wrap never splits one. */
export function bindQuantities(line: string): string {
  return line.replace(SPACE_AFTER_NUMBER, `$1${NO_BREAK_SPACE}`).replace(SPACED_SLASH, `${NO_BREAK_SPACE}/${NO_BREAK_SPACE}`);
}

export function traitOfferViewFor(input: TraitOfferInput): TraitOfferViewModel {
  const { offer } = input;
  const windowSeconds = input.balance.progression.TRAIT_CHOICE_TIMEOUT_SECONDS;
  const secondsLeft = clamp((offer.expiresAtTick - input.serverTick) / TICK_HZ, NO_TIME, windowSeconds);
  return {
    offerId: offer.offerId,
    title: `LEVEL ${offer.level} · CHOOSE A TRAIT`,
    cards: offer.cards.map((card, index) => cardView(card, index, input.progress, input.balance.traits)),
    secondsLeft,
    secondsText: formatQuantity(secondsLeft, QUANTITY_UNIT.seconds, { presentation: QUANTITY_PRESENTATION.countdown }),
    timerFraction: windowSeconds > NO_TIME ? clamp(secondsLeft / windowSeconds, NO_TIME, FULL) : NO_TIME,
  };
}
