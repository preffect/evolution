// The one label table for trait modifiers (docs/ui/overlays.md §3.2, docs/architecture/encyclopedia.md §12.3): a
// tier row's value as a trait card and the encyclopedia both read it, so the two can never read differently. Each row
// is the effect's `noun` and its `quantity`: the encyclopedia shows them as a fact's label and text, and a card
// line is the two joined (`+15 % speed`), or the row's `formatLine` where the line is a sentence rather than a value
// and a noun (`Toxin reaches 1.5 radii`). The encyclopedia's tier table alone splits the value (`formatModifierParts`):
// the unit once in the row's name, the bare figure in each tier's cell (docs/ui/encyclopedia.md §11.4, #858). Every key of `CellModifiers` has a label (the spec pins the set against the
// live identity record), so a new modifier without copy fails the gate instead of rendering `undefined`. The numbers
// go through `formatQuantity`; this table keeps only the words. It reads no tunable: the tier row and the identity
// come from the caller's live balance. Pure.

import type { CellModifiers, TraitTierModifiers, ValueOf } from '@evolution/shared';
import { formatQuantity, formatQuantityParts, type QuantityParts } from './format-quantity';
import { QUANTITY_PRESENTATION, QUANTITY_UNIT, type QuantityPresentation, type QuantityUnit } from './quantity-unit';
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

/** How a modifier's value is read: its unit and presentation, which `formatQuantity` turns into `+15 %`, `−0.5 s`. */
export interface ModifierQuantity {
  readonly unit: QuantityUnit;
  readonly presentation: QuantityPresentation;
}

export interface ModifierLabel {
  /** The effect's name alone: `speed`, `sprint cooldown`, `grip on prey`. */
  readonly noun: string;
  /** How the value reads beside the noun (`formatModifierValue`) or split for the tier table (`formatModifierParts`). */
  readonly quantity: ModifierQuantity;
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

/** `+15 %` from a share (0.15). */
const SIGNED_PERCENT: ModifierQuantity = {
  unit: QUANTITY_UNIT.share,
  presentation: QUANTITY_PRESENTATION.signedChange,
};
/** `75 %` from a share (0.75). */
const PLAIN_PERCENT: ModifierQuantity = { unit: QUANTITY_UNIT.share, presentation: QUANTITY_PRESENTATION.plain };
/** `2 % / s` from a share per second. */
const PERCENT_PER_SECOND: ModifierQuantity = {
  unit: QUANTITY_UNIT.sharePerSecond,
  presentation: QUANTITY_PRESENTATION.plain,
};
/** A multiplier read as a change from 1: 1.15 → `+15 %`, 0.85 → `−15 %`. */
const FROM_ONE: ModifierQuantity = {
  unit: QUANTITY_UNIT.multiplier,
  presentation: QUANTITY_PRESENTATION.changeFromOne,
};
/** A duration multiplier read as the rate it gives: 0.61 of the time is `1 / 0.61 − 1` = `+64 %` faster. */
const AS_RATE: ModifierQuantity = {
  unit: QUANTITY_UNIT.multiplier,
  presentation: QUANTITY_PRESENTATION.rateFromDuration,
};
/** `1 radius`, `1.5 radii`. */
const RADII: ModifierQuantity = { unit: QUANTITY_UNIT.radii, presentation: QUANTITY_PRESENTATION.plain };
/** `−0.5 s`. */
const SIGNED_SECONDS: ModifierQuantity = {
  unit: QUANTITY_UNIT.seconds,
  presentation: QUANTITY_PRESENTATION.signedChange,
};
/** `+0.3 mass / s`. */
const SIGNED_MASS_PER_SECOND: ModifierQuantity = {
  unit: QUANTITY_UNIT.massPerSecond,
  presentation: QUANTITY_PRESENTATION.signedChange,
};
/** `40 u/s`. */
const WORLD_UNITS_PER_SECOND: ModifierQuantity = {
  unit: QUANTITY_UNIT.worldUnitsPerSecond,
  presentation: QUANTITY_PRESENTATION.plain,
};

/** `quantity`'s reading of `value`. */
const read = (quantity: ModifierQuantity, value: number): string =>
  formatQuantity(value, quantity.unit, { presentation: quantity.presentation });
/** `2 % / s`, for the sentences. */
const percentPerSecond = (share: number): string => read(PERCENT_PER_SECOND, share);
/** `1 radius`, `1.5 radii`, for the sentences. */
const radiiText = (value: number): string => read(RADII, value);
/** `75 %`, for the sentences. */
const plainPercent = (share: number): string => read(PLAIN_PERCENT, share);

/** One label per modifier. The key set is exactly `CellModifiers`'. */
export const MODIFIER_LABELS: Readonly<Record<ModifierKey, ModifierLabel>> = {
  speedMultiplier: { noun: 'speed', quantity: FROM_ONE, betterWhen: MODIFIER_BETTER_WHEN.higher },
  accelerationSecondsMultiplier: { noun: 'acceleration', quantity: AS_RATE, betterWhen: MODIFIER_BETTER_WHEN.lower },
  sprintSpeedMultiplierBonus: {
    noun: 'sprint speed',
    quantity: SIGNED_PERCENT,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  sprintCooldownSecondsDelta: {
    noun: 'sprint cooldown',
    quantity: SIGNED_SECONDS,
    betterWhen: MODIFIER_BETTER_WHEN.lower,
  },
  membraneRatioBonus: { noun: 'harder to engulf', quantity: SIGNED_PERCENT, betterWhen: MODIFIER_BETTER_WHEN.higher },
  absorbDurationMultiplierAsPrey: {
    noun: 'time to absorb you',
    quantity: FROM_ONE,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  wrapDurationMultiplierAsPredator: { noun: 'wrap speed', quantity: AS_RATE, betterWhen: MODIFIER_BETTER_WHEN.lower },
  absorbDurationMultiplierAsPredator: {
    noun: 'absorb speed',
    quantity: AS_RATE,
    betterWhen: MODIFIER_BETTER_WHEN.lower,
  },
  gripStrengthBonus: { noun: 'grip on prey', quantity: SIGNED_PERCENT, betterWhen: MODIFIER_BETTER_WHEN.higher },
  gripResistanceBonus: { noun: 'grip resistance', quantity: SIGNED_PERCENT, betterWhen: MODIFIER_BETTER_WHEN.higher },
  struggleSlowdownBonus: { noun: 'struggle', quantity: SIGNED_PERCENT, betterWhen: MODIFIER_BETTER_WHEN.higher },
  spitOutChancePerSecond: {
    noun: 'spit-out chance',
    quantity: PERCENT_PER_SECOND,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  engulfMassYieldBonus: {
    noun: 'mass from engulfs',
    quantity: SIGNED_PERCENT,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  digestionFactorBonus: { noun: 'digestion', quantity: SIGNED_PERCENT, betterWhen: MODIFIER_BETTER_WHEN.higher },
  decayMultiplier: { noun: 'mass decay', quantity: FROM_ONE, betterWhen: MODIFIER_BETTER_WHEN.lower },
  photosynthesisMassPerSecond: {
    noun: 'photosynthesis',
    quantity: SIGNED_MASS_PER_SECOND,
    formatLine: (value) => `${read(SIGNED_MASS_PER_SECOND, value)} in sunlight`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  spikeDrainFractionPerSecond: {
    noun: 'spine drain',
    quantity: PERCENT_PER_SECOND,
    formatLine: (value) => `Spines drain ${percentPerSecond(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  toxinDrainFractionPerSecond: {
    noun: 'toxin drain',
    quantity: PERCENT_PER_SECOND,
    formatLine: (value) => `Toxin drains ${percentPerSecond(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  toxinAuraRangeInRadii: {
    noun: 'toxin reach',
    quantity: RADII,
    formatLine: (value) => `Toxin reaches ${radiiText(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  attractRangeInRadii: {
    noun: 'food pull range',
    quantity: RADII,
    formatLine: (value) => `Pulls food from ${radiiText(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  attractSpeed: {
    noun: 'food drift speed',
    quantity: WORLD_UNITS_PER_SECOND,
    formatLine: (value) => `Food drifts in at ${read(WORLD_UNITS_PER_SECOND, value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  dnaGainMultiplier: { noun: 'DNA', quantity: FROM_ONE, betterWhen: MODIFIER_BETTER_WHEN.higher },
  dnaKeptOnDeathFraction: {
    noun: 'DNA kept on death',
    quantity: PLAIN_PERCENT,
    formatLine: (value) => `Keeps ${plainPercent(value)} DNA on death`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  gelSpeedFactorFloor: {
    noun: 'gel speed floor',
    quantity: PLAIN_PERCENT,
    formatLine: (value) =>
      value >= FULL_SPEED_FACTOR ? 'Gel no longer slows you' : `Gel slows you to no less than ${plainPercent(value)}`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
  armGrabReachRadii: {
    noun: 'arm grab reach',
    quantity: RADII,
    formatLine: (value) => `Arms grab ${radiiText(value)} past the body`,
    betterWhen: MODIFIER_BETTER_WHEN.higher,
  },
};

/** `key`'s value as it reads beside its noun: `+15 %`, `−0.5 s`. */
export function formatModifierValue(key: ModifierKey, value: number): string {
  return read(MODIFIER_LABELS[key].quantity, value);
}

/**
 * `key`'s value split for the encyclopedia's tier table (#858): the signed figure for a tier's cell (`+0.3`) and the
 * unit for the row's name (`mass / s`). The unit is the modifier's own, so every tier of one row reads the same one.
 */
export function formatModifierParts(key: ModifierKey, value: number): QuantityParts {
  const { quantity } = MODIFIER_LABELS[key];
  return formatQuantityParts(value, quantity.unit, { presentation: quantity.presentation });
}

/** Whether `value` helps its owner: above identity where higher is better, below it where lower is. */
export function modifierEffect(key: ModifierKey, value: number, identity: number): ModifierEffect {
  const isHigher = value > identity;
  const isBetterHigher = MODIFIER_LABELS[key].betterWhen === MODIFIER_BETTER_WHEN.higher;
  return isHigher === isBetterHigher ? MODIFIER_EFFECT.benefit : MODIFIER_EFFECT.drawback;
}

/** The card line for `key` at `value`: the row's sentence, else the value then the noun (`+15 % speed`). */
export function modifierLine(key: ModifierKey, value: number): string {
  const label = MODIFIER_LABELS[key];
  return label.formatLine?.(value) ?? `${formatModifierValue(key, value)} ${label.noun}`;
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
