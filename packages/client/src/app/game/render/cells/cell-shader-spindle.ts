// The euglena's spindle in GLSL (#194; docs/rendering/cells.md §2.4): `spindle-profile.ts` term for term, its axes,
// exponents and unit-area scale baked in. Spliced into the form helpers before `formAt`.

import { SPINDLE_AXIS_FLOOR } from '../constants';
import { glslFloat } from './cell-shader-source';
import {
  SPINDLE_AREA_SCALE,
  SPINDLE_EXPONENT_MEAN,
  SPINDLE_EXPONENT_SWING,
  SPINDLE_HALF_LENGTH,
  SPINDLE_HALF_WIDTH,
} from './forms/spindle-profile';

export const CELL_SHADER_SPINDLE = /* glsl */ `
/** The spindle's 'B(Δ)' with dB/dΔ: a superellipse whose exponent turns with cos Δ, at unit area (spindle-profile.ts). */
vec2 spindleAt(float delta) {
  float c = cos(delta);
  float s = sin(delta);
  float along = max(abs(c) / ${glslFloat(SPINDLE_HALF_LENGTH)}, ${glslFloat(SPINDLE_AXIS_FLOOR)});
  float across = max(abs(s) / ${glslFloat(SPINDLE_HALF_WIDTH)}, ${glslFloat(SPINDLE_AXIS_FLOOR)});
  float alongTurns = step(${glslFloat(SPINDLE_AXIS_FLOOR)}, abs(c) / ${glslFloat(SPINDLE_HALF_LENGTH)});
  float acrossTurns = step(${glslFloat(SPINDLE_AXIS_FLOOR)}, abs(s) / ${glslFloat(SPINDLE_HALF_WIDTH)});
  float exponent = ${glslFloat(SPINDLE_EXPONENT_MEAN)} + ${glslFloat(SPINDLE_EXPONENT_SWING)} * c;
  float exponentD = -${glslFloat(SPINDLE_EXPONENT_SWING)} * s;
  float alongPower = pow(along, exponent);
  float acrossPower = pow(across, exponent);
  float sum = alongPower + acrossPower;
  float sumD = exponent * (alongPower / along) * (alongTurns * -sign(c) * s / ${glslFloat(SPINDLE_HALF_LENGTH)})
    + exponent * (acrossPower / across) * (acrossTurns * sign(s) * c / ${glslFloat(SPINDLE_HALF_WIDTH)})
    + exponentD * (alongPower * log(along) + acrossPower * log(across));
  float value = pow(sum, -1.0 / exponent);
  float logSlope = exponentD * log(sum) / (exponent * exponent) - sumD / (exponent * sum);
  return ${glslFloat(SPINDLE_AREA_SCALE)} * vec2(value, value * logSlope);
}
`;
