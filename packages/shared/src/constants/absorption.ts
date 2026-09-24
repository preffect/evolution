// Absorption and engulf (docs/ecology/absorption.md §6, docs/ecology/constants.md §7). The ratio rules have one home:
// simulation/engulf-eligibility.ts; the numbers live here.

/** predator.mass ≥ prey.mass × (this + prey.membraneRatioBonus) starts an engulf. */
export const ENGULF_MASS_RATIO = 1.25;
/** Hysteresis: an engulf in progress continues down to this ratio, below `ENGULF_MASS_RATIO`. */
export const ENGULF_RELEASE_RATIO = 1.1;
/** Payout at progress ≥ 1 − this, so thirty-six additions of 1/36 pay out on tick 36. */
export const ENGULF_PROGRESS_EPSILON = 1e-6;
/** Contact: centre distance ≤ predator.radius − prey.radius × this. */
export const ENGULF_COVERAGE_FRACTION = 0.5;
/** Phase durations at exactly the required ratio (s): cover → wrap → absorb (ecology/absorption.md §6.3). */
export const ENGULF_COVER_SECONDS = 0.2;
export const ENGULF_WRAP_SECONDS = 0.4;
export const ENGULF_ABSORB_SECONDS = 0.6;
/**
 * Duration at exactly the required ratio (s): the three phase seconds summed, never a fourth literal.
 * Summed absorb-first so the float result is exactly the documented 1.2 (cover-first gives 1.2000000000000002).
 */
export const ENGULF_BASE_DURATION_SECONDS = ENGULF_ABSORB_SECONDS + ENGULF_WRAP_SECONDS + ENGULF_COVER_SECONDS;
/** Progress bands, derived from the phase seconds: wrap starts here, the seal closes here (exactly 0.5). */
export const ENGULF_WRAP_START_PROGRESS = ENGULF_COVER_SECONDS / ENGULF_BASE_DURATION_SECONDS;
export const ENGULF_SEAL_PROGRESS =
  (ENGULF_BASE_DURATION_SECONDS - ENGULF_ABSORB_SECONDS) / ENGULF_BASE_DURATION_SECONDS;
/** Duration floor as a factor of the base, reached by heavy predators. */
export const ENGULF_MIN_DURATION_FACTOR = 0.5;
/**
 * Progress decays this many times faster than it grows while contact is broken, in cover and wrap alike; the prey is
 * released when it drains to 0 (#634: a slip drains, it no longer cancels).
 */
export const ENGULF_ESCAPE_DECAY_MULTIPLIER = 2;
/**
 * Predator speed cap factors: cover and wrap / absorb (sealed, the prey is carried). Grabbing costs the predator no
 * speed (#634): the mass curve already makes it the slower cell, so any factor under 1 lets the held prey outrun it.
 */
export const ENGULF_PREDATOR_SPEED_FACTOR = 1.0;
export const ENGULF_PREDATOR_SPEED_FACTOR_SEALED = 1.0;
/**
 * Prey speed cap factors, before grip/resistance bonuses: the mild grab of cover (#634), the grip of wrap (absorb is
 * 0), and the floor both are clamped to.
 */
export const ENGULF_PREY_SPEED_FACTOR_COVER = 0.85;
export const ENGULF_PREY_SPEED_FACTOR = 0.8;
export const ENGULF_PREY_SPEED_FACTOR_FLOOR = 0.3;
/** Struggle: steering away scales the phase rate by 1 − slowdown; the cap bounds trait bonuses. */
export const ENGULF_STRUGGLE_SLOWDOWN = 0.5;
export const ENGULF_STRUGGLE_SLOWDOWN_CAP = 0.9;
/** × on a swallowed prey's toxin fraction, read against the prey's mass (wrap and absorb, #154). */
export const ENGULF_SWALLOWED_TOXIN_MULTIPLIER = 8;
/** After a spit-out the predator cannot restart on that prey for this long (s), one entry per prey. */
export const ENGULF_SPIT_OUT_REFRACTORY_SECONDS = 1.0;
/** Share of the prey's mass the predator gains. */
export const ENGULF_MASS_YIELD = 0.8;
/** DNA to the predator: base plus a share of the prey's cumulative DNA. */
export const ENGULF_DNA_BASE = 30;
export const ENGULF_DNA_SHARE = 0.2;
/** Tag points to the predator: a share of the prey's plus flat `predatory` points. */
export const ENGULF_TAG_SHARE = 0.5;
export const ENGULF_PREDATORY_TAG_POINTS = 10;
