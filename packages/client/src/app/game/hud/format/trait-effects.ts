// A trait card's effect lines (docs/ui/overlays.md §3.2): generated from the tier's modifier row through one label
// table, so no card copy is hand-written and a retuned number reads right the moment it lands. Every key of
// `DEFAULT_CELL_MODIFIERS` has a label (the spec pins the set), so a new modifier without copy fails the gate
// instead of rendering `undefined`. A value at its identity says nothing and is skipped; the first
// `PICKER_CARD_EFFECT_LINES_MAX` that differ are the card's lines, in the tier row's own order. Pure.

import { DEFAULT_CELL_MODIFIERS, TRAIT_TIERS, type CellModifiers, type TraitId } from '@evolution/shared';
import { PICKER_CARD_EFFECT_LINES_MAX } from '../hud-constants';

type ModifierKey = keyof CellModifiers;

const PERCENT = 100;
const FIRST_TIER = 1;
/** A plain number on a card shows at most this many decimals. */
const MAX_DECIMALS = 2;
const MINUS = '−';
const PLUS = '+';

function signOf(value: number): string {
  return value < 0 ? MINUS : PLUS;
}

/** `0.5` from 0.50: at most `MAX_DECIMALS` decimals, trailing zeros dropped. */
function trimmed(value: number): number {
  return Number(value.toFixed(MAX_DECIMALS));
}

/** `+15 %` from a share (0.15); rounded to a whole percent. */
function signedPercent(share: number): string {
  return `${signOf(share)}${Math.round(Math.abs(share) * PERCENT)} %`;
}

/** `+0.5`: the sign, then the trimmed magnitude. */
function signedNumber(value: number): string {
  return `${signOf(value)}${trimmed(Math.abs(value))}`;
}

function plainPercent(share: number): string {
  return `${Math.round(share * PERCENT)} %`;
}

/** A multiplier read as a change from 1: 1.15 → `+15 %`, 0.85 → `−15 %`. */
const fromOne = (value: number): string => signedPercent(value - 1);
/** A duration multiplier read as speed: 0.85 of the time is `+15 %` quicker. */
const quickerBy = (value: number): string => signedPercent(1 - value);

/** One label per modifier: the value as the card reads it. The key set is exactly `DEFAULT_CELL_MODIFIERS`'s. */
export const MODIFIER_LABELS: Readonly<Record<ModifierKey, (value: number) => string>> = {
  speedMultiplier: (value) => `${fromOne(value)} speed`,
  accelerationSecondsMultiplier: (value) => `${quickerBy(value)} acceleration`,
  sprintSpeedMultiplierBonus: (value) => `${signedPercent(value)} sprint speed`,
  sprintCooldownSecondsDelta: (value) => `${signedNumber(value)} s sprint cooldown`,
  membraneRatioBonus: (value) => `${signedPercent(value)} harder to engulf`,
  absorbDurationMultiplierAsPrey: (value) => `${fromOne(value)} time to absorb you`,
  wrapDurationMultiplierAsPredator: (value) => `${quickerBy(value)} faster wrap`,
  absorbDurationMultiplierAsPredator: (value) => `${quickerBy(value)} faster absorb`,
  gripStrengthBonus: (value) => `${signedPercent(value)} grip on prey`,
  gripResistanceBonus: (value) => `${signedPercent(value)} grip resistance`,
  struggleSlowdownBonus: (value) => `${signedPercent(value)} struggle`,
  spitOutChancePerSecond: (value) => `${plainPercent(value)} / s spit-out chance`,
  engulfMassYieldBonus: (value) => `${signedPercent(value)} mass from engulfs`,
  digestionFactorBonus: (value) => `${signedPercent(value)} digestion`,
  decayMultiplier: (value) => `${fromOne(value)} mass decay`,
  photosynthesisMassPerSecond: (value) => `${signedNumber(value)} mass / s in sunlight`,
  spikeDrainFractionPerSecond: (value) => `Spines drain ${plainPercent(value)} / s`,
  toxinDrainFractionPerSecond: (value) => `Toxin drains ${plainPercent(value)} / s`,
  toxinAuraRangeInRadii: (value) => `Toxin reaches ${trimmed(value)} radii`,
  attractRangeInRadii: (value) => `Pulls food from ${trimmed(value)} radii`,
  attractSpeed: (value) => `Food drifts in at ${trimmed(value)} u/s`,
  dnaGainMultiplier: (value) => `${fromOne(value)} DNA`,
  dnaKeptOnDeathFraction: (value) => `Keeps ${plainPercent(value)} DNA on death`,
  gelSpeedFactorFloor: (value) => `Gel slows you to no less than ${plainPercent(value)}`,
};

/** The card's effect lines for `traitId` at `tier` (1..3): the modifiers that differ from identity, at most two. */
export function describeTierModifiers(traitId: TraitId, tier: number): string[] {
  const row: Partial<CellModifiers> = TRAIT_TIERS[traitId]?.[Math.max(tier, FIRST_TIER) - 1] ?? {};
  return (Object.entries(row) as [ModifierKey, number][])
    .filter(([key, value]) => value !== DEFAULT_CELL_MODIFIERS[key])
    .map(([key, value]) => MODIFIER_LABELS[key](value))
    .slice(0, PICKER_CARD_EFFECT_LINES_MAX);
}
