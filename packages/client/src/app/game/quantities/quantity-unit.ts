// The one home of the words, suffixes, decimals and rounding a player-facing number is shown with
// (docs/architecture/encyclopedia.md §12.5). The HUD and the encyclopedia both format through `formatQuantity`, so a
// unit reads the same everywhere and a change of suffix or rounding is one row here.

import type { ValueOf } from '@evolution/shared';

export const QUANTITY_UNIT = {
  mass: 'mass',
  dna: 'dna',
  worldUnits: 'world_units',
  worldUnitsPerSecond: 'world_units_per_second',
  seconds: 'seconds',
  /** Seconds as `m:ss` (the round timer). */
  clock: 'clock',
  massPerSecond: 'mass_per_second',
  /** A 0..1 ratio, shown as a percent. */
  share: 'share',
  sharePerSecond: 'share_per_second',
  multiplier: 'multiplier',
  radii: 'radii',
  count: 'count',
  points: 'points',
  level: 'level',
  /** 1..n as `Tier II`; the cards' numeral alone through the `numeral` presentation. */
  tier: 'tier',
} as const;
export type QuantityUnit = ValueOf<typeof QUANTITY_UNIT>;

export const QUANTITY_PRESENTATION = {
  /** `20 mass`. */
  plain: 'plain',
  /** A bonus or delta, always signed: `+0.5 s`, `+15 %`. */
  signedChange: 'signed_change',
  /** A multiplier as its change from one: 1.15 → `+15 %`. */
  changeFromOne: 'change_from_one',
  /** A duration multiplier as the rate it gives, `1 / value − 1`: 0.61 → `+64 %`. */
  rateFromDuration: 'rate_from_duration',
  /** The bare figure in the unit's numeral form, without sign, prefix or suffix: `II`, `124`. */
  numeral: 'numeral',
  /** A running timer: always `COUNTDOWN_DECIMALS` decimals, so the digits do not jump as it drains: `6.0 s`. */
  countdown: 'countdown',
} as const;
export type QuantityPresentation = ValueOf<typeof QUANTITY_PRESENTATION>;

export const QUANTITY_ROUNDING = {
  /** For display. */
  nearest: 'nearest',
  /** Where a reading must never claim more than is there (the DNA percent, the round clock). */
  floor: 'floor',
} as const;
export type QuantityRounding = ValueOf<typeof QUANTITY_ROUNDING>;

/** How a unit's figure is written: a decimal figure, `m:ss`, or a tier numeral. */
export const QUANTITY_FORM = { figure: 'figure', clock: 'clock', numeral: 'numeral' } as const;
export type QuantityForm = ValueOf<typeof QUANTITY_FORM>;

/** A share (0..1) shown as a percentage. */
export const PERCENT = 100;
/** Tier I..III as the cards and the encyclopedia name them. */
export const TIER_NUMERALS = ['I', 'II', 'III'] as const;
/** A multiplier's identity: a duration or rate unchanged. */
export const UNCHANGED = 1;
/** The one shown magnitude that takes a unit's singular suffix (`1 radius`). */
export const SINGULAR_MAGNITUDE = 1;
export const MINUS_SIGN = '−';
export const PLUS_SIGN = '+';
/** A multiplier's sign: the `1.5×` suffix, and the `×1.5` a caption leads with (the round clock's bloom). */
export const MULTIPLIER_SIGN = '×';
/**
 * The two comparisons a threshold is written with (docs/ui/overlays.md §3.7). Both admit equality, because
 * `canEngulf` does: a prey at exactly the ratio is eaten, so `<` and `>` would both be lies.
 */
export const AT_MOST_SIGN = '≤';
export const AT_LEAST_SIGN = '≥';
export const COUNTDOWN_DECIMALS = 1;
/** `0:09`: the clock's seconds are always this many digits. */
export const CLOCK_SECONDS_DIGITS = 2;
export const CLOCK_PAD_CHARACTER = '0';
export const CLOCK_SEPARATOR = ':';
/** A plain figure shows at most this many decimals, trailing zeros dropped. */
const FIGURE_DECIMALS = 2;
const WHOLE = 0;
const UNSCALED = 1;

export interface UnitFormat {
  /** Written before the figure, separator included (`Level 5`). */
  readonly prefix: string;
  /** Written after the figure, separator included (`0.5 s`, `1.5×`). */
  readonly suffix: string;
  /** The suffix when the shown magnitude is exactly one; the plural suffix where the unit has no singular. */
  readonly singularSuffix: string;
  /** The factor from the stored value to the shown figure (a share is shown in percent). */
  readonly scale: number;
  /** At most this many decimals, trailing zeros dropped. */
  readonly decimals: number;
  readonly rounding: QuantityRounding;
  readonly form: QuantityForm;
}

function unitFormat(suffix: string, overrides: Partial<UnitFormat> = {}): UnitFormat {
  return {
    prefix: '',
    suffix,
    singularSuffix: suffix,
    scale: UNSCALED,
    decimals: FIGURE_DECIMALS,
    rounding: QUANTITY_ROUNDING.nearest,
    form: QUANTITY_FORM.figure,
    ...overrides,
  };
}

const WHOLE_PERCENT: Partial<UnitFormat> = { scale: PERCENT, decimals: WHOLE };

/** Per unit: the prefix, the suffix, the singular form, the scale, the decimals, the rounding and the form. */
export const QUANTITY_UNIT_FORMAT: Readonly<Record<QuantityUnit, UnitFormat>> = {
  [QUANTITY_UNIT.mass]: unitFormat(' mass', { decimals: WHOLE }),
  [QUANTITY_UNIT.dna]: unitFormat(' DNA'),
  [QUANTITY_UNIT.worldUnits]: unitFormat(' u'),
  [QUANTITY_UNIT.worldUnitsPerSecond]: unitFormat(' u/s'),
  [QUANTITY_UNIT.seconds]: unitFormat(' s'),
  [QUANTITY_UNIT.clock]: unitFormat('', {
    decimals: WHOLE,
    rounding: QUANTITY_ROUNDING.floor,
    form: QUANTITY_FORM.clock,
  }),
  [QUANTITY_UNIT.massPerSecond]: unitFormat(' mass / s'),
  [QUANTITY_UNIT.share]: unitFormat(' %', WHOLE_PERCENT),
  [QUANTITY_UNIT.sharePerSecond]: unitFormat(' % / s', WHOLE_PERCENT),
  [QUANTITY_UNIT.multiplier]: unitFormat(MULTIPLIER_SIGN),
  [QUANTITY_UNIT.radii]: unitFormat(' radii', { singularSuffix: ' radius' }),
  [QUANTITY_UNIT.count]: unitFormat('', { decimals: WHOLE }),
  [QUANTITY_UNIT.points]: unitFormat(' points', { singularSuffix: ' point', decimals: WHOLE }),
  [QUANTITY_UNIT.level]: unitFormat('', { prefix: 'Level ', decimals: WHOLE }),
  [QUANTITY_UNIT.tier]: unitFormat('', { prefix: 'Tier ', decimals: WHOLE, form: QUANTITY_FORM.numeral }),
};
