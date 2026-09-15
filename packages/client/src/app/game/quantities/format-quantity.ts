// The one player-facing number formatter (docs/architecture/encyclopedia.md §12.5): a value, its unit and how it is
// presented become the text a card, a HUD line or an encyclopedia fact shows. No locale formatting in build 1. Pure.

import {
  COUNTDOWN_DECIMALS,
  MINUS_SIGN,
  PLUS_SIGN,
  QUANTITY_PRESENTATION,
  QUANTITY_UNIT,
  QUANTITY_UNIT_FORMAT,
  SINGULAR_MAGNITUDE,
  UNCHANGED,
  type QuantityPresentation,
  type QuantityUnit,
  type UnitFormat,
} from './quantity-unit';

/** `0.5` from 0.50: rounded to `decimals`, trailing zeros dropped. */
function trimmed(magnitude: number, decimals: number): string {
  return String(Number(magnitude.toFixed(decimals)));
}

/** The prefix, the figure and the suffix, the suffix singular when the figure reads exactly one. */
function withUnit(figure: string, format: UnitFormat): string {
  const suffix = Number(figure) === SINGULAR_MAGNITUDE ? format.singularSuffix : format.suffix;
  return `${format.prefix}${figure}${suffix}`;
}

/** The sign a presentation writes: a change always shows one, any other figure only a minus. */
function signOf(value: number, isAlwaysSigned: boolean): string {
  if (value < 0) return MINUS_SIGN;
  return isAlwaysSigned ? PLUS_SIGN : '';
}

/** A change a multiplier makes, as a signed share: from one, or as the rate a duration multiplier gives. */
function multiplierChange(value: number, presentation: QuantityPresentation): number {
  return presentation === QUANTITY_PRESENTATION.rateFromDuration ? UNCHANGED / value - UNCHANGED : value - UNCHANGED;
}

function isMultiplierChange(presentation: QuantityPresentation): boolean {
  return (
    presentation === QUANTITY_PRESENTATION.changeFromOne || presentation === QUANTITY_PRESENTATION.rateFromDuration
  );
}

/**
 * `value` in `unit` as the player reads it. A multiplier's change (`changeFromOne`, `rateFromDuration`) is a share
 * whatever the unit, so `+15 %`; the minus is the typographic `−`.
 */
export function formatQuantity(
  value: number,
  unit: QuantityUnit,
  presentation: QuantityPresentation = QUANTITY_PRESENTATION.plain,
): string {
  if (isMultiplierChange(presentation)) {
    return formatQuantity(
      multiplierChange(value, presentation),
      QUANTITY_UNIT.share,
      QUANTITY_PRESENTATION.signedChange,
    );
  }
  const format = QUANTITY_UNIT_FORMAT[unit];
  const magnitude = Math.abs(value) * format.scale;
  const figure =
    presentation === QUANTITY_PRESENTATION.countdown
      ? magnitude.toFixed(COUNTDOWN_DECIMALS)
      : trimmed(magnitude, format.decimals);
  return `${signOf(value, presentation === QUANTITY_PRESENTATION.signedChange)}${withUnit(figure, format)}`;
}
