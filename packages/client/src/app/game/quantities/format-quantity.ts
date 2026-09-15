// The one player-facing number formatter (docs/architecture/encyclopedia.md §12.5): a value, its unit and how it is
// presented become the text a card, a HUD line or an encyclopedia fact shows. No locale formatting in build 1. Pure.

import { SECONDS_PER_MINUTE } from '@evolution/shared';
import {
  CLOCK_PAD_CHARACTER,
  CLOCK_SECONDS_DIGITS,
  CLOCK_SEPARATOR,
  COUNTDOWN_DECIMALS,
  MINUS_SIGN,
  PLUS_SIGN,
  QUANTITY_FORM,
  QUANTITY_PRESENTATION,
  QUANTITY_ROUNDING,
  QUANTITY_UNIT,
  QUANTITY_UNIT_FORMAT,
  SINGULAR_MAGNITUDE,
  TIER_NUMERALS,
  UNCHANGED,
  type QuantityPresentation,
  type QuantityRounding,
  type QuantityUnit,
  type UnitFormat,
} from './quantity-unit';

export interface FormatOptions {
  /** `plain` when absent. */
  readonly presentation?: QuantityPresentation;
  /** The unit's own rounding when absent. */
  readonly rounding?: QuantityRounding;
}

const DECIMAL_BASE = 10;
const FIRST_TIER = 1;
const NO_SIGN = '';

/** `magnitude` (never negative) rounded to `decimals`, down or to the nearest. */
function roundedMagnitude(magnitude: number, decimals: number, rounding: QuantityRounding): number {
  if (rounding === QUANTITY_ROUNDING.nearest) return Number(magnitude.toFixed(decimals));
  const factor = DECIMAL_BASE ** decimals;
  return Math.floor(magnitude * factor) / factor;
}

/** `7:42` from 462 whole seconds: minutes unpadded, seconds always two digits. */
function clockText(wholeSeconds: number): string {
  const minutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const seconds = String(wholeSeconds % SECONDS_PER_MINUTE).padStart(CLOCK_SECONDS_DIGITS, CLOCK_PAD_CHARACTER);
  return `${minutes}${CLOCK_SEPARATOR}${seconds}`;
}

/** `II` from 2; a tier past the numerals is a broken contract, refused loudly. */
function tierNumeral(tier: number): string {
  const numeral = TIER_NUMERALS[tier - FIRST_TIER];
  if (numeral === undefined) throw new Error(`A tier ${tier} has no numeral`);
  return numeral;
}

/** The figure alone, in the unit's form: `0.5`, `7:42`, `II`. */
function figureText(
  magnitude: number,
  format: UnitFormat,
  presentation: QuantityPresentation,
  rounding: QuantityRounding,
): string {
  if (format.form === QUANTITY_FORM.clock) return clockText(roundedMagnitude(magnitude, format.decimals, rounding));
  if (format.form === QUANTITY_FORM.numeral) return tierNumeral(roundedMagnitude(magnitude, format.decimals, rounding));
  if (presentation === QUANTITY_PRESENTATION.countdown) {
    return roundedMagnitude(magnitude, COUNTDOWN_DECIMALS, rounding).toFixed(COUNTDOWN_DECIMALS);
  }
  return String(roundedMagnitude(magnitude, format.decimals, rounding));
}

/** The prefix, the figure and the suffix, the suffix singular when the figure reads exactly one. */
function withUnit(figure: string, format: UnitFormat): string {
  const suffix = Number(figure) === SINGULAR_MAGNITUDE ? format.singularSuffix : format.suffix;
  return `${format.prefix}${figure}${suffix}`;
}

/** A change always shows its sign; any other figure only a minus. */
function signOf(value: number, presentation: QuantityPresentation): string {
  if (value < 0) return MINUS_SIGN;
  return presentation === QUANTITY_PRESENTATION.signedChange ? PLUS_SIGN : NO_SIGN;
}

/** The change a multiplier makes, as a share: from one, or as the rate a duration multiplier gives. */
function multiplierChange(value: number, presentation: QuantityPresentation): number | null {
  if (presentation === QUANTITY_PRESENTATION.changeFromOne) return value - UNCHANGED;
  if (presentation === QUANTITY_PRESENTATION.rateFromDuration) return UNCHANGED / value - UNCHANGED;
  return null;
}

/**
 * `value` in `unit` as the player reads it. A multiplier's change (`changeFromOne`, `rateFromDuration`) is a signed
 * share whatever the unit, so `+15 %`; the minus is the typographic `−`; `numeral` writes the figure alone.
 */
export function formatQuantity(value: number, unit: QuantityUnit, options: FormatOptions = {}): string {
  const presentation = options.presentation ?? QUANTITY_PRESENTATION.plain;
  const change = multiplierChange(value, presentation);
  if (change !== null) {
    return formatQuantity(change, QUANTITY_UNIT.share, {
      ...options,
      presentation: QUANTITY_PRESENTATION.signedChange,
    });
  }
  const format = QUANTITY_UNIT_FORMAT[unit];
  const figure = figureText(Math.abs(value) * format.scale, format, presentation, options.rounding ?? format.rounding);
  if (presentation === QUANTITY_PRESENTATION.numeral) return figure;
  return `${signOf(value, presentation)}${withUnit(figure, format)}`;
}
