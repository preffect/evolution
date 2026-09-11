// The Penner curves behind the `EasingName`s of docs/RENDERING.md §4 (docs/VISUAL-STYLE.md preamble:
// no inline cubic-bezier literals anywhere else).

import { EASING, type EasingName } from '@evolution/shared';

const HALF = 0.5;
const QUAD = 2;
const CUBIC = 3;
const EXPO_BASE = 2;
const EXPO_STEEPNESS = 10;
/**
 * The back overshoot: Penner's 1.70158 overshoots a tween by 10 % of its delta, which puts the
 * respawn scale (0.6 → 1.0) at 1.04, over the 3 % sheet-03 limit. 1.44 overshoots by 7.5 %, so the
 * largest back-eased delta in the clip tables (0.4) lands at 3 % exactly (pinned in easing.spec.ts).
 */
const BACK_OVERSHOOT = 1.44;

const CURVES: Readonly<Record<EasingName, (x: number) => number>> = {
  [EASING.linear]: (x) => x,
  [EASING.easeOutQuad]: (x) => 1 - (1 - x) * (1 - x),
  [EASING.easeInQuad]: (x) => x * x,
  [EASING.easeInOutQuad]: (x) => (x < HALF ? QUAD * x * x : 1 - Math.pow(-QUAD * x + QUAD, QUAD) / QUAD),
  [EASING.easeOutCubic]: (x) => 1 - Math.pow(1 - x, CUBIC),
  [EASING.easeInOutSine]: (x) => -(Math.cos(Math.PI * x) - 1) / QUAD,
  [EASING.easeOutExpo]: (x) => (x >= 1 ? 1 : 1 - Math.pow(EXPO_BASE, -EXPO_STEEPNESS * x)),
  [EASING.easeOutBack]: (x) => {
    const back = x - 1;
    return 1 + (BACK_OVERSHOOT + 1) * back * back * back + BACK_OVERSHOOT * back * back;
  },
};

/** The unit progress `x` through the named curve; inputs outside [0, 1] are clamped. */
export function ease(name: EasingName, x: number): number {
  const clamped = x < 0 ? 0 : x > 1 ? 1 : x;
  return CURVES[name](clamped);
}
