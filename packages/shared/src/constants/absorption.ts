// Absorption and engulf (docs/ECOLOGY.md §6, §7). The ratio rules have one home:
// simulation/engulf-eligibility.ts; the numbers live here.

/** predator.mass ≥ prey.mass × (this + prey.membraneRatioBonus) starts an engulf. */
export const ENGULF_MASS_RATIO = 1.25;
/** Hysteresis: an engulf in progress continues down to this ratio, below `ENGULF_MASS_RATIO`. */
export const ENGULF_RELEASE_RATIO = 1.1;
/** Payout at progress ≥ 1 − this, so thirty additions of 1/30 pay out on tick 30. */
export const ENGULF_PROGRESS_EPSILON = 1e-6;
/** Contact: centre distance ≤ predator.radius − prey.radius × this. */
export const ENGULF_COVERAGE_FRACTION = 0.5;
/** Duration at exactly the required ratio (s). */
export const ENGULF_BASE_DURATION_SECONDS = 1.0;
/** Duration floor as a factor of the base, reached by heavy predators. */
export const ENGULF_MIN_DURATION_FACTOR = 0.5;
/** Progress decays this many times faster than it grows while contact is broken. */
export const ENGULF_ESCAPE_DECAY_MULTIPLIER = 2;
/** Speed factors while an engulf is in progress. */
export const ENGULF_PREDATOR_SPEED_FACTOR = 0.6;
export const ENGULF_PREY_SPEED_FACTOR = 0.8;
/** Share of the prey's mass the predator gains. */
export const ENGULF_MASS_YIELD = 0.8;
/** DNA to the predator: base plus a share of the prey's cumulative DNA. */
export const ENGULF_DNA_BASE = 30;
export const ENGULF_DNA_SHARE = 0.2;
/** Tag points to the predator: a share of the prey's plus flat `predatory` points. */
export const ENGULF_TAG_SHARE = 0.5;
export const ENGULF_PREDATORY_TAG_POINTS = 10;
/** Reserved: trait stealing is off in build 1. */
export const ENGULF_TRAIT_STEAL_CHANCE = 0;
