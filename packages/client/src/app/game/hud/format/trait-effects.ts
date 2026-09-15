// A trait card's effect lines (docs/ui/overlays.md §3.2): generated from the tier's modifier row through one label
// table, so no card copy is hand-written and a retuned number reads right the moment it lands. The row is read from
// the live balance's tier table (`balance.traits.TRAIT_TIERS`, architecture/constants-files-tests.md §9), so a
// `debug_set_balance` patch reaches the cards. Every key of `DEFAULT_CELL_MODIFIERS` has a label (the spec pins the
// set), so a new modifier without copy fails the gate instead of rendering `undefined`. A value at its identity says
// nothing and is skipped; every other one is a line, in the tier row's own order, so a card never hides a trait's
// cost. The spec pins that no tier row has more than `PICKER_CARD_EFFECT_LINES_MAX` of them, so a row that outgrows
// the card fails the gate instead of being cut. The numbers go through the one formatter (`quantities/`). Pure.

import { DEFAULT_CELL_MODIFIERS, type BalanceConfig, type CellModifiers, type TraitId } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from '../../quantities/quantity-unit';

type ModifierKey = keyof CellModifiers;

/** The tier tables a card reads: the live balance's, never the module constant. */
export type TraitTierTables = BalanceConfig['traits']['TRAIT_TIERS'];

const FIRST_TIER = 1;
/** A gel speed floor at or above full speed means gel does not slow the cell at all. */
const FULL_SPEED_FACTOR = 1;

const { signedChange, changeFromOne, rateFromDuration } = QUANTITY_PRESENTATION;

/** `+15 %` from a share (0.15). */
const signedPercent = (share: number): string => formatQuantity(share, QUANTITY_UNIT.share, signedChange);
/** `75 %` from a share (0.75). */
const plainPercent = (share: number): string => formatQuantity(share, QUANTITY_UNIT.share);
/** `2 % / s` from a share per second. */
const percentPerSecond = (share: number): string => formatQuantity(share, QUANTITY_UNIT.sharePerSecond);
/** A multiplier read as a change from 1: 1.15 → `+15 %`, 0.85 → `−15 %`. */
const fromOne = (value: number): string => formatQuantity(value, QUANTITY_UNIT.multiplier, changeFromOne);
/** A duration multiplier read as the rate it gives: 0.61 of the time is `1 / 0.61 − 1` = `+64 %` faster. */
const asRate = (value: number): string => formatQuantity(value, QUANTITY_UNIT.multiplier, rateFromDuration);
/** `1 radius`, `1.5 radii`. */
const radiiText = (value: number): string => formatQuantity(value, QUANTITY_UNIT.radii);

/** One label per modifier: the value as the card reads it. The key set is exactly `DEFAULT_CELL_MODIFIERS`'s. */
export const MODIFIER_LABELS: Readonly<Record<ModifierKey, (value: number) => string>> = {
  speedMultiplier: (value) => `${fromOne(value)} speed`,
  accelerationSecondsMultiplier: (value) => `${asRate(value)} acceleration`,
  sprintSpeedMultiplierBonus: (value) => `${signedPercent(value)} sprint speed`,
  sprintCooldownSecondsDelta: (value) =>
    `${formatQuantity(value, QUANTITY_UNIT.seconds, signedChange)} sprint cooldown`,
  membraneRatioBonus: (value) => `${signedPercent(value)} harder to engulf`,
  absorbDurationMultiplierAsPrey: (value) => `${fromOne(value)} time to absorb you`,
  wrapDurationMultiplierAsPredator: (value) => `${asRate(value)} wrap speed`,
  absorbDurationMultiplierAsPredator: (value) => `${asRate(value)} absorb speed`,
  gripStrengthBonus: (value) => `${signedPercent(value)} grip on prey`,
  gripResistanceBonus: (value) => `${signedPercent(value)} grip resistance`,
  struggleSlowdownBonus: (value) => `${signedPercent(value)} struggle`,
  spitOutChancePerSecond: (value) => `${percentPerSecond(value)} spit-out chance`,
  engulfMassYieldBonus: (value) => `${signedPercent(value)} mass from engulfs`,
  digestionFactorBonus: (value) => `${signedPercent(value)} digestion`,
  decayMultiplier: (value) => `${fromOne(value)} mass decay`,
  photosynthesisMassPerSecond: (value) =>
    `${formatQuantity(value, QUANTITY_UNIT.massPerSecond, signedChange)} in sunlight`,
  spikeDrainFractionPerSecond: (value) => `Spines drain ${percentPerSecond(value)}`,
  toxinDrainFractionPerSecond: (value) => `Toxin drains ${percentPerSecond(value)}`,
  toxinAuraRangeInRadii: (value) => `Toxin reaches ${radiiText(value)}`,
  attractRangeInRadii: (value) => `Pulls food from ${radiiText(value)}`,
  attractSpeed: (value) => `Food drifts in at ${formatQuantity(value, QUANTITY_UNIT.worldUnitsPerSecond)}`,
  dnaGainMultiplier: (value) => `${fromOne(value)} DNA`,
  dnaKeptOnDeathFraction: (value) => `Keeps ${plainPercent(value)} DNA on death`,
  gelSpeedFactorFloor: (value) =>
    value >= FULL_SPEED_FACTOR ? 'Gel no longer slows you' : `Gel slows you to no less than ${plainPercent(value)}`,
};

/** `traitId`'s tier row (1..3) in `tierTables`; an empty row for a trait or tier the table does not hold. */
export function tierModifierRow(tierTables: TraitTierTables, traitId: TraitId, tier: number): Partial<CellModifiers> {
  return tierTables[traitId]?.[Math.max(tier, FIRST_TIER) - FIRST_TIER] ?? {};
}

/** The modifiers of a tier row that differ from identity, in the row's order. */
export function nonIdentityModifiers(row: Partial<CellModifiers>): [ModifierKey, number][] {
  return (Object.entries(row) as [ModifierKey, number][]).filter(
    ([key, value]) => value !== DEFAULT_CELL_MODIFIERS[key],
  );
}

/** The card's effect lines for `traitId` at `tier` (1..3): one per modifier that differs from identity, none cut. */
export function describeTierModifiers(tierTables: TraitTierTables, traitId: TraitId, tier: number): string[] {
  return nonIdentityModifiers(tierModifierRow(tierTables, traitId, tier)).map(([key, value]) =>
    MODIFIER_LABELS[key](value),
  );
}
