// The one label table for trait modifiers (docs/ui/overlays.md §3.2, docs/architecture/encyclopedia.md §12.3): a
// tier row's value as a trait card and the encyclopedia both read it, so the two can never read differently. Each row
// is the effect's `noun` and its `formatValue`: the encyclopedia shows them as a fact's label and text, and a card
// line is the two joined (`+15 % speed`), or the row's `formatLine` where the line is a sentence rather than a value
// and a noun (`Toxin reaches 1.5 radii`). Every key of `CellModifiers` has a label (the spec pins the set against the
// live identity record), so a new modifier without copy fails the gate instead of rendering `undefined`. The numbers
// go through `formatQuantity`; this table keeps only the words. It reads no tunable: the tier row and the identity
// come from the caller's live balance. Pure.

import type { CellModifiers, TraitTierModifiers, ValueOf } from '@evolution/shared';
import { formatQuantity } from './format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT } from './quantity-unit';
import { UI_EFFECT, type UiEffect } from '../../ui-kit/ui-effect-mark.component';

type ModifierKey = keyof CellModifiers;

/** Which way a modifier helps the cell that owns it: its value going up, or going down. */
export const MODIFIER_BETTER_WHEN = { higher: 'higher', lower: 'lower' } as const;
export type ModifierBetterWhen = ValueOf<typeof MODIFIER_BETTER_WHEN>;

/**
 * What a tier's value does for its owner (#453): every surface marks a modifier's line by this, never by its sign.
 * It is the kit's effect mark's own input, so a surface passes it straight through.
 */
export const MODIFIER_EFFECT = UI_EFFECT;
export type ModifierEffect = UiEffect;

export interface ModifierLabel {
  /** The effect's name alone: `speed`, `sprint cooldown`, `grip on prey`. */
  readonly noun: string;
  /** The value as it reads beside the noun: `+15 %`, `−0.5 s`; always through `formatQuantity`. */
  readonly formatValue: (value: number) => string;
  /** The card line where it is a sentence, not `<value> <noun>`; the noun still labels the encyclopedia's fact. */
  readonly formatLine?: (value: number) => string;
  /**
   * The trait data's own direction: whether a value above identity helps the owner. A shorter sprint cooldown, less
   * mass decay and a faster absorb all read with a minus and all help, which is why a sign is never the tone (#453).
   */
  readonly betterWhen: ModifierBetterWhen;
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
  speedMultiplier: { noun: 'speed', formatValue: fromOne, betterWhen: MODIFIER_BETTER_WHEN.higher },
  accelerationSecondsMultiplier: { noun: 'acceleration', formatValue: asRate, betterWhen: MODIFIER_BETTER_WHEN.lower },
  sprintSpeedMultiplierBonus: {
    noun: 'sprint speed',
    formatValue: signedPercent,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  sprintCooldownSecondsDelta: {
    noun: 'sprint cooldown',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.seconds, signedChange),
    betterWhen: MODIFIER_BETTER_WHEN.lower,
  },
  membraneRatioBonus: { noun: 'harder to engulf', formatValue: signedPercent, betterWhen: MODIFIER_BETTER_WHEN.higher },
  absorbDurationMultiplierAsPrey: {
    noun: 'time to absorb you',
    formatValue: fromOne,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  wrapDurationMultiplierAsPredator: { noun: 'wrap speed', formatValue: asRate, betterWhen: MODIFIER_BETTER_WHEN.lower },
  absorbDurationMultiplierAsPredator: {
    noun: 'absorb speed',
    formatValue: asRate,
    betterWhen: MODIFIER_BETTER_WHEN.lower,
  },
  gripStrengthBonus: { noun: 'grip on prey', formatValue: signedPercent, betterWhen: MODIFIER_BETTER_WHEN.higher },
  gripResistanceBonus: { noun: 'grip resistance', formatValue: signedPercent, betterWhen: MODIFIER_BETTER_WHEN.higher },
  struggleSlowdownBonus: { noun: 'struggle', formatValue: signedPercent, betterWhen: MODIFIER_BETTER_WHEN.higher },
  spitOutChancePerSecond: {
    noun: 'spit-out chance',
    formatValue: percentPerSecond,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  engulfMassYieldBonus: {
    noun: 'mass from engulfs',
    formatValue: signedPercent,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  digestionFactorBonus: { noun: 'digestion', formatValue: signedPercent, betterWhen: MODIFIER_BETTER_WHEN.higher },
  decayMultiplier: { noun: 'mass decay', formatValue: fromOne, betterWhen: MODIFIER_BETTER_WHEN.lower },
  photosynthesisMassPerSecond: {
    noun: 'photosynthesis',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.massPerSecond, signedChange),
    formatLine: (value) => `${formatQuantity(value, QUANTITY_UNIT.massPerSecond, signedChange)} in sunlight`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  spikeDrainFractionPerSecond: {
    noun: 'spine drain',
    formatValue: percentPerSecond,
    formatLine: (value) => `Spines drain ${percentPerSecond(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  toxinDrainFractionPerSecond: {
    noun: 'toxin drain',
    formatValue: percentPerSecond,
    formatLine: (value) => `Toxin drains ${percentPerSecond(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  toxinAuraRangeInRadii: {
    noun: 'toxin reach',
    formatValue: radiiText,
    formatLine: (value) => `Toxin reaches ${radiiText(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  attractRangeInRadii: {
    noun: 'food pull range',
    formatValue: radiiText,
    formatLine: (value) => `Pulls food from ${radiiText(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  attractSpeed: {
    noun: 'food drift speed',
    formatValue: (value) => formatQuantity(value, QUANTITY_UNIT.worldUnitsPerSecond),
    formatLine: (value) => `Food drifts in at ${formatQuantity(value, QUANTITY_UNIT.worldUnitsPerSecond)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  dnaGainMultiplier: { noun: 'DNA', formatValue: fromOne, betterWhen: MODIFIER_BETTER_WHEN.higher },
  dnaKeptOnDeathFraction: {
    noun: 'DNA kept on death',
    formatValue: plainPercent,
    formatLine: (value) => `Keeps ${plainPercent(value)} DNA on death`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  gelSpeedFactorFloor: {
    noun: 'gel speed floor',
    formatValue: plainPercent,
    formatLine: (value) =>
      value >= FULL_SPEED_FACTOR ? 'Gel no longer slows you' : `Gel slows you to no less than ${plainPercent(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
};

/** Whether `value` helps its owner: above identity where higher is better, below it where lower is. */
export function modifierEffect(key: ModifierKey, value: number, identity: number): ModifierEffect {
  const isHigher = value > identity;
  const isBetterHigher = MODIFIER_LABELS[key].betterWhen === MODIFIER_BETTER_WHEN.higher;
  return isHigher === isBetterHigher ? MODIFIER_EFFECT.benefit : MODIFIER_EFFECT.drawback;
}

/** The card line for `key` at `value`: the row's sentence, else the value then the noun (`+15 % speed`). */
export function modifierLine(key: ModifierKey, value: number): string {
  const label = MODIFIER_LABELS[key];
  return label.formatLine?.(value) ?? `${label.formatValue(value)} ${label.noun}`;
}

/**
 * Two modifiers of one organelle that read as a single card line (docs/ui/overlays.md §3.2): the Diatom Shell's
 * spines both drain a predator and spit it out, so the card states both numbers on one line instead of spending two
 * of its three on the same organelle. Both numbers stay on the card, which is what the three-line cap protects.
 * The encyclopedia lists a fact per modifier and does not pair (docs/architecture/encyclopedia.md §12.3).
 */
const PAIRED_MODIFIER_LINES: readonly {
  readonly keys: readonly [ModifierKey, ModifierKey];
  readonly formatLine: (first: number, second: number) => string;
}[] = [
  {
    keys: ['spikeDrainFractionPerSecond', 'spitOutChancePerSecond'],
    formatLine: (drain, chance) => `Spines drain ${percentPerSecond(drain)}, spit out ${percentPerSecond(chance)}`,
  },
];

/**
 * The card lines for a tier row's modifiers, in row order, with a paired organelle's two modifiers on one line at
 * the first of the two. Anything unpaired is its own `modifierLine`.
 */
export function modifierLines(modifiers: readonly [ModifierKey, number][]): string[] {
  return modifierLineViews(modifiers).map((view) => view.text);
}

/** A card line and the modifier it leads with: a paired line is toned by its first modifier. */
interface ModifierLineView {
  readonly key: ModifierKey;
  readonly value: number;
  readonly text: string;
}

function modifierLineViews(modifiers: readonly [ModifierKey, number][]): ModifierLineView[] {
  const valueOf = new Map<ModifierKey, number>(modifiers);
  const pairedAway = new Set<ModifierKey>();
  const lineOf = new Map<ModifierKey, string>();
  for (const pair of PAIRED_MODIFIER_LINES) {
    const [first, second] = pair.keys;
    const firstValue = valueOf.get(first);
    const secondValue = valueOf.get(second);
    if (firstValue === undefined || secondValue === undefined) continue;
    lineOf.set(first, pair.formatLine(firstValue, secondValue));
    pairedAway.add(second);
  }
  return modifiers
    .filter(([key]) => !pairedAway.has(key))
    .map(([key, value]) => ({ key, value, text: lineOf.get(key) ?? modifierLine(key, value) }));
}

/** Each `modifierLines` line's effect, in the same order, read against the identity record (#453). */
export function modifierLineEffects(
  modifiers: readonly [ModifierKey, number][],
  identity: CellModifiers,
): ModifierEffect[] {
  return modifierLineViews(modifiers).map((view) => modifierEffect(view.key, view.value, identity[view.key]));
}

/** The modifiers of `tierRow` that differ from `identity` (`balance.traits.DEFAULT_CELL_MODIFIERS`), in row order. */
export function nonIdentityModifiers(tierRow: TraitTierModifiers, identity: CellModifiers): [ModifierKey, number][] {
  return (Object.entries(tierRow) as [ModifierKey, number][]).filter(([key, value]) => value !== identity[key]);
}
