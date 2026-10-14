// The one player-facing number formatter (docs/architecture/encyclopedia.md §12.5): a value, its unit and how it is
// presented become the text a card, a HUD line or an encyclopedia fact shows. No locale formatting in build 1. Pure.

import { SECONDS_PER_MINUTE, tierEntryOf } from '@evolution/shared';
import {
  CLOCK_PAD_CHARACTER,
  CLOCK_SECONDS_DIGITS,
  CLOCK_SEPARATOR,
  COMPACT_STEPS,
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
const NO_SIGN = '';
/** A ceiling first drops float noise past this many places, so a `1125.0000000002` reads `1125`, never `1126`. */
const CEIL_NOISE_DECIMALS = 6;

/** `magnitude` (never negative) rounded to `decimals`: to the nearest, down or up. */
function roundedMagnitude(magnitude: number, decimals: number, rounding: QuantityRounding): number {
  const factor = DECIMAL_BASE ** decimals;
  switch (rounding) {
    case QUANTITY_ROUNDING.nearest:
      return Number(magnitude.toFixed(decimals));
    case QUANTITY_ROUNDING.floor:
      return Math.floor(magnitude * factor) / factor;
    case QUANTITY_ROUNDING.ceil:
      return Math.ceil(Number((magnitude * factor).toFixed(CEIL_NOISE_DECIMALS))) / factor;
  }
}

/** `7:42` from 462 whole seconds: minutes unpadded, seconds always two digits. */
function clockText(wholeSeconds: number): string {
  const minutes = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const seconds = String(wholeSeconds % SECONDS_PER_MINUTE).padStart(CLOCK_SECONDS_DIGITS, CLOCK_PAD_CHARACTER);
  return `${minutes}${CLOCK_SEPARATOR}${seconds}`;
}

/** `II` from 2; a tier past the numerals is a broken contract, refused loudly. */
function tierNumeral(tier: number): string {
  const numeral = tierEntryOf(TIER_NUMERALS, tier);
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

/**
 * `123k` from 123 456 and `1.2M` from 1 234 567, rounded down so a shortened figure never claims more than there is;
 * below the first step the whole figure, rounded to the nearest as the unshortened figure always was.
 */
function compactFigure(magnitude: number): string {
  const step = COMPACT_STEPS.find((candidate) => magnitude >= candidate.from);
  if (step === undefined) return String(roundedMagnitude(magnitude, 0, QUANTITY_ROUNDING.nearest));
  return `${roundedMagnitude(magnitude / step.divisor, step.decimals, QUANTITY_ROUNDING.floor)}${step.suffix}`;
}

/** The change a multiplier makes, as a share: from one, or as the rate a duration multiplier gives. */
function multiplierChange(value: number, presentation: QuantityPresentation): number | null {
  if (presentation === QUANTITY_PRESENTATION.changeFromOne) return value - UNCHANGED;
  if (presentation === QUANTITY_PRESENTATION.rateFromDuration) return UNCHANGED / value - UNCHANGED;
  return null;
}

/** A value, its unit and its options once a multiplier's change has become the signed share it reads as. */
interface PresentedQuantity {
  readonly value: number;
  readonly unit: QuantityUnit;
  readonly presentation: QuantityPresentation;
  readonly rounding: QuantityRounding;
}

/** A multiplier's change (`changeFromOne`, `rateFromDuration`) is a signed share whatever the unit: `+15 %`. */
function presentedQuantity(value: number, unit: QuantityUnit, options: FormatOptions): PresentedQuantity {
  const presentation = options.presentation ?? QUANTITY_PRESENTATION.plain;
  const change = multiplierChange(value, presentation);
  if (change !== null) {
    return {
      value: change,
      unit: QUANTITY_UNIT.share,
      presentation: QUANTITY_PRESENTATION.signedChange,
      rounding: options.rounding ?? QUANTITY_UNIT_FORMAT[QUANTITY_UNIT.share].rounding,
    };
  }
  return { value, unit, presentation, rounding: options.rounding ?? QUANTITY_UNIT_FORMAT[unit].rounding };
}

/** The figure in the unit's form, without sign, prefix or suffix: `0.3`, `7:42`, `II`, `123k`. */
function bareFigure(quantity: PresentedQuantity): string {
  const magnitude = Math.abs(quantity.value);
  if (quantity.presentation === QUANTITY_PRESENTATION.compact) return compactFigure(magnitude);
  const format = QUANTITY_UNIT_FORMAT[quantity.unit];
  return figureText(magnitude * format.scale, format, quantity.presentation, quantity.rounding);
}

/**
 * `value` in `unit` as the player reads it. A multiplier's change (`changeFromOne`, `rateFromDuration`) is a signed
 * share whatever the unit, so `+15 %`; the minus is the typographic `−`; `numeral` writes the figure alone.
 */
export function formatQuantity(value: number, unit: QuantityUnit, options: FormatOptions = {}): string {
  const quantity = presentedQuantity(value, unit, options);
  const figure = bareFigure(quantity);
  const sign = signOf(quantity.value, quantity.presentation);
  if (quantity.presentation === QUANTITY_PRESENTATION.compact) return `${sign}${figure}`;
  if (quantity.presentation === QUANTITY_PRESENTATION.numeral) return figure;
  return `${sign}${withUnit(figure, QUANTITY_UNIT_FORMAT[quantity.unit])}`;
}

/** A quantity split for a table that writes the unit once, in its row's name, rather than in every cell (#858). */
export interface QuantityParts {
  /** The figure with its sign, as the cell shows it: `+0.3`, `−15`, `0.62`. */
  readonly figure: string;
  /** The unit as a header writes it, plural and without the figure: `mass / s`, `%`, `radii`; empty with no unit. */
  readonly unit: string;
}

/**
 * `value` as `formatQuantity` reads it, split into its signed figure and its unit's header form. The unit depends on
 * the unit and the presentation alone, never on the value — a tier of 1 radius still heads its row `radii` — so every
 * figure of one row shares it. `numeral` drops the sign as `formatQuantity` does.
 */
export function formatQuantityParts(value: number, unit: QuantityUnit, options: FormatOptions = {}): QuantityParts {
  const quantity = presentedQuantity(value, unit, options);
  const figure = bareFigure(quantity);
  const sign =
    quantity.presentation === QUANTITY_PRESENTATION.numeral ? NO_SIGN : signOf(quantity.value, quantity.presentation);
  return { figure: `${sign}${figure}`, unit: unitHeaderOf(QUANTITY_UNIT_FORMAT[quantity.unit]) };
}

/** A unit's header form: its plural suffix, or else its prefix, trimmed (`mass / s`, `Level`); empty with neither. */
function unitHeaderOf(format: UnitFormat): string {
  return format.suffix.trim() || format.prefix.trim();
}
