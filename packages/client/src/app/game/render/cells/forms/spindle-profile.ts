// The euglena's spindle (#194; docs/rendering/cells.md §2.4, sheet 04): `B(Δ)` is a superellipse of `SPINDLE_ASPECT`
// whose exponent runs with `cos Δ` from the front's 2 (the round nose the flagellum leaves from) to the rear's 1.3 (the
// point), scaled to unit area so mass ∝ area holds. The GLSL twin (`spindleAt`, `cell-shader-spindle.ts`) bakes the
// same axes, exponents and scale.

import { SPINDLE_ASPECT, SPINDLE_AXIS_FLOOR, SPINDLE_FRONT_EXPONENT, SPINDLE_REAR_EXPONENT } from '../../constants';
import { HALF } from '../../geometry';
import type { FormProfile } from '../radial-profile';
import { unitAreaScale } from './unit-area';

/** The unscaled superellipse's half-length and half-width: `√aspect` and `1 / √aspect`, so their product is 1. */
export const SPINDLE_HALF_LENGTH = Math.sqrt(SPINDLE_ASPECT);
export const SPINDLE_HALF_WIDTH = 1 / SPINDLE_HALF_LENGTH;
/** The exponent is `SPINDLE_EXPONENT_MEAN + SPINDLE_EXPONENT_SWING · cos Δ`. */
export const SPINDLE_EXPONENT_MEAN = (SPINDLE_FRONT_EXPONENT + SPINDLE_REAR_EXPONENT) * HALF;
export const SPINDLE_EXPONENT_SWING = (SPINDLE_FRONT_EXPONENT - SPINDLE_REAR_EXPONENT) * HALF;

/**
 * The unscaled spindle at `delta` and its derivative. With `u = |cos Δ| / a`, `v = |sin Δ| / b` and the exponent
 * `n(Δ)`, `B = (uⁿ + vⁿ)^(−1/n)`; `ln B = −ln S / n` gives `B′ = B · (n′ ln S / n² − S′ / (n S))`, where `S′` carries
 * the exponent's own turn (`n′ (uⁿ ln u + vⁿ ln v)`).
 */
function rawSpindleAt(delta: number): { readonly value: number; readonly derivative: number } {
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const along = Math.max(Math.abs(cos) / SPINDLE_HALF_LENGTH, SPINDLE_AXIS_FLOOR);
  const across = Math.max(Math.abs(sin) / SPINDLE_HALF_WIDTH, SPINDLE_AXIS_FLOOR);
  // An axis held at the floor is flat there, as the true curve is on the axis (every exponent passes 1).
  const alongTurns = along > SPINDLE_AXIS_FLOOR ? 1 : 0;
  const acrossTurns = across > SPINDLE_AXIS_FLOOR ? 1 : 0;
  const exponent = SPINDLE_EXPONENT_MEAN + SPINDLE_EXPONENT_SWING * cos;
  const exponentDerivative = -SPINDLE_EXPONENT_SWING * sin;
  const alongPower = along ** exponent;
  const acrossPower = across ** exponent;
  const sum = alongPower + acrossPower;
  const alongDerivative = (alongTurns * -Math.sign(cos) * sin) / SPINDLE_HALF_LENGTH;
  const acrossDerivative = (acrossTurns * Math.sign(sin) * cos) / SPINDLE_HALF_WIDTH;
  const sumDerivative =
    exponent * (alongPower / along) * alongDerivative +
    exponent * (acrossPower / across) * acrossDerivative +
    exponentDerivative * (alongPower * Math.log(along) + acrossPower * Math.log(across));
  const value = sum ** (-1 / exponent);
  const logSlope = (exponentDerivative * Math.log(sum)) / (exponent * exponent) - sumDerivative / (exponent * sum);
  return { value, derivative: value * logSlope };
}

/** The scale that brings the spindle to unit area. */
export const SPINDLE_AREA_SCALE = unitAreaScale((delta) => rawSpindleAt(delta).value);

/** `B(Δ)` of the spindle: the same at every tier (the tiers brighten the eyespot, visual-style/cells-and-organelles.md §4). */
export const SPINDLE_PROFILE: FormProfile = {
  evaluate: (delta) => {
    const raw = rawSpindleAt(delta);
    return { value: SPINDLE_AREA_SCALE * raw.value, derivative: SPINDLE_AREA_SCALE * raw.derivative };
  },
  // No exponent passes 2, so no point of the outline lies further out than the two tips, both a half-length out.
  peak: SPINDLE_AREA_SCALE * SPINDLE_HALF_LENGTH,
};
