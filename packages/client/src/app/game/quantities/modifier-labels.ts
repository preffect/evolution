// The one label table for trait modifiers (docs/ui/overlays.md §3.2, docs/architecture/encyclopedia.md §12.3): a
// tier row's value as a trait card and the encyclopedia both read it, so the two can never read differently. Every
// key of `CellModifiers` has a label (the spec pins the set against the live identity record), so a new modifier
// without copy fails the gate instead of rendering `undefined`. The numbers go through `formatQuantity`; this table
// keeps only the words. It reads no tunable: the tier row and the identity come from the caller's live balance. Pure.

import type { CellModifiers, TraitTierModifiers } from '@evolution/shared';
import { formatQuantity } from './format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from './quantity-unit';

type ModifierKey = keyof CellModifiers;

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

/** One label per modifier: the value as a card reads it. The key set is exactly `CellModifiers`'. */
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

/** The modifiers of `tierRow` that differ from `identity` (`balance.traits.DEFAULT_CELL_MODIFIERS`), in row order. */
export function nonIdentityModifiers(tierRow: TraitTierModifiers, identity: CellModifiers): [ModifierKey, number][] {
  return (Object.entries(tierRow) as [ModifierKey, number][]).filter(([key, value]) => value !== identity[key]);
}
