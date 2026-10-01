// What the dive's panel writes over the view (docs/rendering/opening-dive.md §5): the readout's three lines (the
// field of view, its power of ten, what fills the screen) and the scale bar. Pure functions of the camera.

import {
  DIVE_LADDER,
  DIVE_LADDER_POWER_RANGE,
  DIVE_LENGTH_GROUPED_FROM,
  DIVE_LENGTH_UNITS,
  DIVE_LENGTH_UNIT_TOLERANCE,
  DIVE_LENGTH_WHOLE_FROM,
  DIVE_SCALE_BAR_MANTISSAS,
  DIVE_SCALE_BAR_VIEW_FRACTION,
  DIVE_ZOOM_BASE,
} from '../constants';
import type { DiveCamera } from './dive-camera';

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUPERSCRIPT_MINUS = '⁻';
const NUMBER_LOCALE = 'en-US';
const ONE_DECIMAL = 1;
const TRAILING_ZERO_DECIMAL = /\.0$/;

/** `n` in superscript digits: −4 → ⁻⁴. */
export function superscript(power: number): string {
  const digits = [...String(Math.abs(power))].map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? '').join('');
  return (power < 0 ? SUPERSCRIPT_MINUS : '') + digits;
}

function formatAmount(amount: number): string {
  if (amount >= DIVE_LENGTH_GROUPED_FROM) return Math.round(amount).toLocaleString(NUMBER_LOCALE);
  if (amount >= DIVE_LENGTH_WHOLE_FROM) return amount.toFixed(0);
  return amount.toFixed(ONE_DECIMAL).replace(TRAILING_ZERO_DECIMAL, '');
}

/** A length in the largest unit it reaches: 20,000 km, 5 mm, 1.6 µm. */
export function formatDiveLength(metres: number): string {
  const unit = DIVE_LENGTH_UNITS.find((candidate) => metres >= candidate.metres * DIVE_LENGTH_UNIT_TOLERANCE);
  if (unit === undefined) return `${metres.toExponential(ONE_DECIMAL)} m`;
  return `${formatAmount(metres / unit.metres)} ${unit.symbol}`;
}

export interface DiveReadout {
  /** The view's width: "20,000 km". */
  readonly fieldOfView: string;
  /** "field of view ≈ 10⁷ m". */
  readonly powerOfTen: string;
  /** The ladder's line for the nearest power of ten. */
  readonly whatYouSee: string;
}

/** The power of ten the view is nearest, kept to the ladder's rows. */
export function nearestLadderPower(zoom: number): number {
  const nearest = Math.round(zoom);
  return Math.min(DIVE_LADDER_POWER_RANGE.highest, Math.max(DIVE_LADDER_POWER_RANGE.lowest, nearest));
}

export function diveReadout(zoom: number): DiveReadout {
  const row = DIVE_LADDER.find((candidate) => candidate.powerOfTen === nearestLadderPower(zoom));
  return {
    fieldOfView: formatDiveLength(Math.pow(DIVE_ZOOM_BASE, zoom)),
    powerOfTen: `field of view ≈ 10${superscript(Math.round(zoom))} m`,
    whatYouSee: row?.whatYouSee ?? '',
  };
}

export interface DiveScaleBar {
  readonly lengthM: number;
  readonly widthPx: number;
  readonly text: string;
}

/** The longest round length (5, 2 or 1 × a power of ten) inside `DIVE_SCALE_BAR_VIEW_FRACTION` of the view. */
export function diveScaleBar(camera: DiveCamera): DiveScaleBar {
  const targetM = (camera.viewport.width * DIVE_SCALE_BAR_VIEW_FRACTION) / camera.pixelsPerMetre;
  const base = Math.pow(DIVE_ZOOM_BASE, Math.floor(Math.log10(targetM)));
  const mantissa = DIVE_SCALE_BAR_MANTISSAS.find((candidate) => candidate * base <= targetM) ?? 1;
  const lengthM = mantissa * base;
  return { lengthM, widthPx: lengthM * camera.pixelsPerMetre, text: formatDiveLength(lengthM) };
}
