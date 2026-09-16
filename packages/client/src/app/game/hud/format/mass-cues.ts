// The mass cues' words and numbers (docs/ui/hud.md §3.1.5): the amounts the floaters and the rate tags show, and
// which rate tags show at all. Every number is the server's own (`massFlow`, the effect amounts, #383); nothing
// here re-derives a rate from a formula. Pure and DOM-free: the renderer draws what this answers and the status
// mirror speaks it.

import {
  MASS_RATE_CAUSES,
  MASS_RATE_CAUSE,
  TRAIT_CATALOG,
  ZONE_ID,
  type BalanceConfig,
  type MassFlowView,
  type MassRateCause,
  type OwnedTrait,
  type TraitId,
  type ValueOf,
} from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { MINUS_SIGN, PLUS_SIGN, QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { RATE_TAG_MIN_MASS_PER_SECOND, RATE_TAG_ROWS_MAX } from '../../render/constants';

/** The colour role a cue's rim carries (visual-style/principles-and-palette.md §2); a zone rim is the zone's own tint. */
export const CUE_RIM = {
  none: 'none',
  gain: 'gain',
  danger: 'danger',
  dna: 'dna',
  warmVent: ZONE_ID.warmVent,
  sunlitShallows: ZONE_ID.sunlitShallows,
  viscousGel: ZONE_ID.viscousGel,
} as const;
export type CueRim = ValueOf<typeof CUE_RIM>;

/** Under this size a figure keeps one decimal (`−0.5/s`, `+2.5`); from it up it is whole (`−12/s`, `+16`). */
const WHOLE_FIGURE_FROM = 10;
const ONE_DECIMAL = 1;
const WHOLE = 0;
const RATE_SUFFIX = '/s';
const NO_DECAY_SHARE = 1;
const TIER_INDEX_OFFSET = 1;

/** The cause a tag names, uppercased by the `label` role when drawn. */
export const RATE_CAUSE_LABEL: Readonly<Record<MassRateCause, string>> = {
  [MASS_RATE_CAUSE.toxin]: 'Toxin',
  [MASS_RATE_CAUSE.swallowed]: 'Swallowed',
  [MASS_RATE_CAUSE.decay]: 'Decay',
  [MASS_RATE_CAUSE.vent]: 'Vent',
  [MASS_RATE_CAUSE.light]: 'Light',
};

const RATE_CAUSE_RIM: Readonly<Record<MassRateCause, CueRim>> = {
  [MASS_RATE_CAUSE.toxin]: CUE_RIM.danger,
  [MASS_RATE_CAUSE.swallowed]: CUE_RIM.danger,
  [MASS_RATE_CAUSE.decay]: CUE_RIM.none,
  [MASS_RATE_CAUSE.vent]: CUE_RIM.warmVent,
  [MASS_RATE_CAUSE.light]: CUE_RIM.sunlitShallows,
};

/** `9.4` from 9.36, `12` from 12.4: one decimal under ten, whole from ten up, trailing zeros dropped. */
export function formatMassFigure(magnitude: number): string {
  const size = Math.abs(magnitude);
  const decimals = Number(size.toFixed(ONE_DECIMAL)) < WHOLE_FIGURE_FROM ? ONE_DECIMAL : WHOLE;
  return String(Number(size.toFixed(decimals)));
}

function signOf(value: number): string {
  return value < 0 ? MINUS_SIGN : PLUS_SIGN;
}

/** A one-off change, always signed with the typographic minus: `+3`, `−16`. */
export function formatMassAmount(amount: number): string {
  return `${signOf(amount)}${formatMassFigure(amount)}`;
}

/** An ongoing change per second, always signed: `−0.5/s`, `−12/s`, `+0.3/s`. */
export function formatMassRate(ratePerSecond: number): string {
  return `${formatMassAmount(ratePerSecond)}${RATE_SUFFIX}`;
}

/** The chip's net rate, unsigned because its trend glyph carries the direction: `9/s`. */
export function formatUnsignedMassRate(ratePerSecond: number): string {
  return `${formatMassFigure(ratePerSecond)}${RATE_SUFFIX}`;
}

/** The owned trait that cuts decay the most and the whole cut: the DECAY tag's glyph and its `−15 %`. */
export interface DecayTraitShare {
  readonly traitId: TraitId;
  /** `−15 %`, from the wire's `decayTraitShare`. */
  readonly text: string;
}

export interface RateTag {
  readonly cause: MassRateCause;
  readonly ratePerSecond: number;
  /** `−9.4/s`. */
  readonly rateText: string;
  /** `Toxin`; uppercased by the `label` role. */
  readonly causeLabel: string;
  readonly rim: CueRim;
  /** Only on the DECAY tag, and only while an owned trait scales decay. */
  readonly traitShare: DecayTraitShare | null;
}

/** The owned trait whose own `decayMultiplier` is lowest (the largest share); catalog order breaks a tie. */
function largestDecayTrait(traits: readonly OwnedTrait[], balance: Pick<BalanceConfig, 'traits'>): TraitId | null {
  let best: { traitId: TraitId; multiplier: number } | null = null;
  for (const trait of TRAIT_CATALOG) {
    const owned = traits.find((candidate) => candidate.traitId === trait.id);
    const tier = owned === undefined ? undefined : balance.traits.TRAIT_TIERS[trait.id][owned.tier - TIER_INDEX_OFFSET];
    const multiplier = tier?.decayMultiplier ?? NO_DECAY_SHARE;
    if (multiplier < (best?.multiplier ?? NO_DECAY_SHARE)) best = { traitId: trait.id, multiplier };
  }
  return best?.traitId ?? null;
}

function decayTraitShareOf(
  massFlow: MassFlowView,
  traits: readonly OwnedTrait[],
  balance: Pick<BalanceConfig, 'traits'>,
): DecayTraitShare | null {
  const share = massFlow.decayTraitShare;
  const traitId = share === undefined ? null : largestDecayTrait(traits, balance);
  if (share === undefined || traitId === null) return null;
  const text = formatQuantity(share, QUANTITY_UNIT.share, { presentation: QUANTITY_PRESENTATION.signedChange });
  return { traitId, text };
}

/**
 * One tag per cause whose rate's size reaches `RATE_TAG_MIN_MASS_PER_SECOND`, the largest first (nearest the chip),
 * ties in `MASS_RATE_CAUSE` order, at most `RATE_TAG_ROWS_MAX`.
 */
export function rateTagsFor(
  massFlow: MassFlowView | null,
  traits: readonly OwnedTrait[],
  balance: Pick<BalanceConfig, 'traits'>,
): readonly RateTag[] {
  if (massFlow === null) return [];
  const shown = MASS_RATE_CAUSES.flatMap((cause) => {
    const rate = massFlow.ratesPerSecond[cause];
    return rate === undefined || Math.abs(rate) < RATE_TAG_MIN_MASS_PER_SECOND ? [] : [{ cause, rate }];
  });
  // `Array.prototype.sort` is stable, so equal sizes keep the declaration order they were gathered in.
  shown.sort((first, second) => Math.abs(second.rate) - Math.abs(first.rate));
  return shown.slice(0, RATE_TAG_ROWS_MAX).map(({ cause, rate }) => ({
    cause,
    ratePerSecond: rate,
    rateText: formatMassRate(rate),
    causeLabel: RATE_CAUSE_LABEL[cause],
    rim: RATE_CAUSE_RIM[cause],
    traitShare: cause === MASS_RATE_CAUSE.decay ? decayTraitShareOf(massFlow, traits, balance) : null,
  }));
}
