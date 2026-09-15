// The one home of the words, suffixes and decimals a player-facing number is shown with
// (docs/architecture/encyclopedia.md §12.5). The HUD and the encyclopedia both format through `formatQuantity`, so a
// unit reads the same everywhere and a change of suffix or rounding is one row here.

import type { ValueOf } from '@evolution/shared';

export const QUANTITY_UNIT = {
  mass: 'mass',
  dna: 'dna',
  worldUnits: 'world_units',
  worldUnitsPerSecond: 'world_units_per_second',
  seconds: 'seconds',
  massPerSecond: 'mass_per_second',
  /** A 0..1 ratio, shown as a percent. */
  share: 'share',
  sharePerSecond: 'share_per_second',
  multiplier: 'multiplier',
  radii: 'radii',
  count: 'count',
  points: 'points',
  level: 'level',
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
  /** A running timer: always `COUNTDOWN_DECIMALS` decimals, so the digits do not jump as it drains: `6.0 s`. */
  countdown: 'countdown',
} as const;
export type QuantityPresentation = ValueOf<typeof QUANTITY_PRESENTATION>;

/** A share (0..1) shown as a percentage. */
export const PERCENT = 100;
/** A multiplier's identity: a duration or rate unchanged. */
export const UNCHANGED = 1;
/** The one shown magnitude that takes a unit's singular suffix (`1 radius`). */
export const SINGULAR_MAGNITUDE = 1;
export const MINUS_SIGN = '−';
export const PLUS_SIGN = '+';
/** A plain figure shows at most this many decimals, trailing zeros dropped. */
const FIGURE_DECIMALS = 2;
const WHOLE = 0;
export const COUNTDOWN_DECIMALS = 1;
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
}

function unitFormat(suffix: string, overrides: Partial<UnitFormat> = {}): UnitFormat {
  return { prefix: '', suffix, singularSuffix: suffix, scale: UNSCALED, decimals: FIGURE_DECIMALS, ...overrides };
}

/** Per unit: the prefix, the suffix, the singular form where one exists, the scale and the decimals. */
export const QUANTITY_UNIT_FORMAT: Readonly<Record<QuantityUnit, UnitFormat>> = {
  [QUANTITY_UNIT.mass]: unitFormat(' mass'),
  [QUANTITY_UNIT.dna]: unitFormat(' DNA'),
  [QUANTITY_UNIT.worldUnits]: unitFormat(' u'),
  [QUANTITY_UNIT.worldUnitsPerSecond]: unitFormat(' u/s'),
  [QUANTITY_UNIT.seconds]: unitFormat(' s'),
  [QUANTITY_UNIT.massPerSecond]: unitFormat(' mass / s'),
  [QUANTITY_UNIT.share]: unitFormat(' %', { scale: PERCENT, decimals: WHOLE }),
  [QUANTITY_UNIT.sharePerSecond]: unitFormat(' % / s', { scale: PERCENT, decimals: WHOLE }),
  [QUANTITY_UNIT.multiplier]: unitFormat('×'),
  [QUANTITY_UNIT.radii]: unitFormat(' radii', { singularSuffix: ' radius' }),
  [QUANTITY_UNIT.count]: unitFormat('', { decimals: WHOLE }),
  [QUANTITY_UNIT.points]: unitFormat(' points', { singularSuffix: ' point', decimals: WHOLE }),
  [QUANTITY_UNIT.level]: unitFormat('', { prefix: 'Level ', decimals: WHOLE }),
};
