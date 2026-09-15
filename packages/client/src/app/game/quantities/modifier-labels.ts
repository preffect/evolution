// The one label table for trait modifiers (docs/ui/overlays.md §3.2, docs/architecture/encyclopedia.md §12.3): a
// tier row's value as a trait card and the encyclopedia both read it, so the two can never read differently. Each row
// is the effect's `noun` and its `formatValue`: the encyclopedia shows them as a fact's label and text, and a card
// line is the two joined (`+15 % speed`), or the row's `formatLine` where the line is a sentence rather than a value
// and a noun (`Toxin reaches 1.5 radii`). Every key of `CellModifiers` has a label (the spec pins the set against the
// live identity record), so a new modifier without copy fails the gate instead of rendering `undefined`. The numbers
// go through `formatQuantity`; this table keeps only the words. It reads no tunable: the tier row and the identity
// come from the caller's live balance. Pure.

import type { CellModifiers, TraitTierModifiers } from '@evolution/shared';
import { formatQuantity } from './format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from './quantity-unit';

type ModifierKey = keyof CellModifiers;

export interface ModifierLabel {
  /** The effect's name alone: `speed`, `sprint cooldown`, `grip on prey`. */
  readonly noun: string;
  /** The value as it reads beside the noun: `+15 %`, `−0.5 s`; always through `formatQuantity`. */
  readonly formatValue: (value: number) => string;
  /** The card line where it is a sentence, not `<value> <noun>`; the noun still labels the encyclopedia's fact. */
  readonly formatLine?: (value: number) => string;
}

/** A gel speed floor at or above full speed means gel does not slow the cell at all. */
const FULL_SPEED_FACTOR = 1;

const signedChange = { presentation: QUANTITY_PRESENTATION.signedChange };

/** `+15 %` from a share (0.15). */
const signedPercent = (share: number): string => formatQuantity(share, QUANTITY_UNIT.share, signedChange);
/** `75 %` from a share (0.75). */
const plainPercent = (share: number): string => formatQuantity(share, QUANTITY_UNIT.share);
/** `2 % / s` from a share per second. */
const percentPerSecond = (share: number): string => formatQuantity(share, QUANTITY_UNIT.sharePerSecond);
/** A multiplier read as a change from 1: 1.15 → `+15 %`, 0.85 → `−15 %`. */
const fromOne = (value: number): string =>
  formatQuantity(value, QUANTITY_UNIT.multiplier, { presentation: QUANTITY_PRESENTATION.changeFromOne });
/** A duration multiplier read as the rate it gives: 0.61 of the time is `1 / 0.61 − 1` = `+64 %` faster. */
const asRate = (value: number): string =>
  formatQuantity(value, QUANTITY_UNIT.multiplier, { presentation: QUANTITY_PRESENTATION.rateFromDuration });
/** `1 radius`, `1.5 radii`. */
const radiiText = (value: number): string => formatQuantity(value, QUANTITY_UNIT.radii);

/** One label per modifier. The key set is exactly `CellModifiers`'. */
export const MODIFIER_LABELS: Readonly<Record<ModifierKey, ModifierLabel>> = {
  speedMultiplier: { noun: 'speed', formatValue: fromOne },
  accelerationSecondsMultiplier: { noun: 'acceleration', formatValue: asRate },
  sprintSpeedMultiplierBonus: { noun: 'sprint speed', formatValue: signedPercent },
  sprintCooldownSecondsDelta: {
    noun: 'sprint cooldown',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.seconds, signedChange),
  },
  membraneRatioBonus: { noun: 'harder to engulf', formatValue: signedPercent },
  absorbDurationMultiplierAsPrey: { noun: 'time to absorb you', formatValue: fromOne },
  wrapDurationMultiplierAsPredator: { noun: 'wrap speed', formatValue: asRate },
  absorbDurationMultiplierAsPredator: { noun: 'absorb speed', formatValue: asRate },
  gripStrengthBonus: { noun: 'grip on prey', formatValue: signedPercent },
  gripResistanceBonus: { noun: 'grip resistance', formatValue: signedPercent },
  struggleSlowdownBonus: { noun: 'struggle', formatValue: signedPercent },
  spitOutChancePerSecond: { noun: 'spit-out chance', formatValue: percentPerSecond },
  engulfMassYieldBonus: { noun: 'mass from engulfs', formatValue: signedPercent },
  digestionFactorBonus: { noun: 'digestion', formatValue: signedPercent },
  decayMultiplier: { noun: 'mass decay', formatValue: fromOne },
  photosynthesisMassPerSecond: {
    noun: 'photosynthesis',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.massPerSecond, signedChange),
    formatLine: (value) => `${formatQuantity(value, QUANTITY_UNIT.massPerSecond, signedChange)} in sunlight`,
  },
  spikeDrainFractionPerSecond: {
    noun: 'spine drain',
    formatValue: percentPerSecond,
    formatLine: (value) => `Spines drain ${percentPerSecond(value)}`,
  },
  toxinDrainFractionPerSecond: {
    noun: 'toxin drain',
    formatValue: percentPerSecond,
    formatLine: (value) => `Toxin drains ${percentPerSecond(value)}`,
  },
  toxinAuraRangeInRadii: {
    noun: 'toxin reach',
    formatValue: radiiText,
    formatLine: (value) => `Toxin reaches ${radiiText(value)}`,
  },
  attractRangeInRadii: {
    noun: 'food pull range',
    formatValue: radiiText,
    formatLine: (value) => `Pulls food from ${radiiText(value)}`,
  },
  attractSpeed: {
    noun: 'food drift speed',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.worldUnitsPerSecond),
    formatLine: (value) => `Food drifts in at ${formatQuantity(value, QUANTITY_UNIT.worldUnitsPerSecond)}`,
  },
  dnaGainMultiplier: { noun: 'DNA', formatValue: fromOne },
  dnaKeptOnDeathFraction: {
    noun: 'DNA kept on death',
    formatValue: plainPercent,
    formatLine: (value) => `Keeps ${plainPercent(value)} DNA on death`,
  },
  gelSpeedFactorFloor: {
    noun: 'gel speed floor',
    formatValue: plainPercent,
    formatLine: (value) =>
      value >= FULL_SPEED_FACTOR ? 'Gel no longer slows you' : `Gel slows you to no less than ${plainPercent(value)}`,
  },
};

/** The card line for `key` at `value`: the row's sentence, else the value then the noun (`+15 % speed`). */
export function modifierLine(key: ModifierKey, value: number): string {
  const label = MODIFIER_LABELS[key];
  return label.formatLine?.(value) ?? `${label.formatValue(value)} ${label.noun}`;
}

/** The modifiers of `tierRow` that differ from `identity` (`balance.traits.DEFAULT_CELL_MODIFIERS`), in row order. */
export function nonIdentityModifiers(tierRow: TraitTierModifiers, identity: CellModifiers): [ModifierKey, number][] {
  return (Object.entries(tierRow) as [ModifierKey, number][]).filter(([key, value]) => value !== identity[key]);
}
