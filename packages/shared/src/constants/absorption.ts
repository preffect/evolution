// Absorption and engulf (docs/ecology/absorption.md §6, docs/ecology/constants.md §7). The ratio rules have one home:
// simulation/engulf-eligibility.ts; the numbers live here.

import type { TraitId } from '../types/game.js';

/**
 * The swallow switch (docs/game-design/early-life.md §15.5.1, §15.10): a player or a plain wild cell starts an engulf,
 * and eats a bacterium whole, only once it owns one of these traits (at any tier); without one a bacterium is latched or
 * passed over (§15.4). A giant or a pool creature swallows by its species. Empty is no gate, today's game exactly (every
 * cell swallows from the start, none latches); the flip (ticket #916) sets `['cytoskeleton']`. Typed `readonly
 * TraitId[]`, not its literal, because a `debug_set_balance` patch may set any list of catalog ids.
 */
export const SWALLOW_GATE_TRAITS: readonly TraitId[] = [];

/** predator.mass ≥ prey.mass × (this + prey.membraneRatioBonus) starts an engulf. */
export const ENGULF_MASS_RATIO = 1.25;
/** Hysteresis: an engulf in progress continues down to this ratio, below `ENGULF_MASS_RATIO`. */
export const ENGULF_RELEASE_RATIO = 1.1;
/** Payout at progress ≥ 1 − this, so thirty-six additions of 1/36 pay out on tick 36. */
export const ENGULF_PROGRESS_EPSILON = 1e-6;
/** Contact: centre distance ≤ predator.radius − prey.radius × this. */
export const ENGULF_COVERAGE_FRACTION = 0.5;
/**
 * The kept grab (#819): once an engulf has started, the body holds the prey, and may seal it, while the centre
 * distance ≤ predator.radius − prey.radius × this. −1 is the cells touching, so the grab holds while any of the prey is
 * still under the predator. While the prey's sprint runs, the start's `ENGULF_COVERAGE_FRACTION` holds and seals it
 * instead; starting an engulf always needs it. Typed `number` because tsc's declaration emit garbles a negative literal type
 * spread into `DEFAULT_BALANCE` (it printed balance.ts's own text in place of `-1`).
 */
export const ENGULF_HOLD_COVERAGE_FRACTION: number = -1;
/**
 * The carried prey settles inside (#819 review): the kept grab may seal a prey at the predator's rim, so from the seal
 * on each movement step draws its carried offset toward the predator's centre at this many prey radii a second, until
 * the centre is no farther out than the start's bound, `predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION`. The
 * farthest seal, the cells touching, is 1.5 prey radii out, so it settles in 1/6 s (10 ticks); its centre is inside the
 * membrane after 7 ticks, before the fastest absorb pays out (Food Vacuole III: `ENGULF_ABSORB_SECONDS ×
 * ENGULF_MIN_DURATION_FACTOR × 0.51`, about 0.153 s or 9 ticks, a tick sooner when the seal overshoots).
 */
export const ENGULF_CARRY_SETTLE_PREY_RADII_PER_SECOND = 9;
/**
 * Phase durations at exactly the required ratio (s): cover → wrap → absorb (ecology/absorption.md §6.3). The engulf's
 * tunables: its base duration and progress bands are derived from them (`absorption-derived.ts`, #367).
 */
export const ENGULF_COVER_SECONDS = 0.2;
export const ENGULF_WRAP_SECONDS = 0.4;
export const ENGULF_ABSORB_SECONDS = 0.6;
/** Duration floor as a factor of the base, reached by heavy predators. */
export const ENGULF_MIN_DURATION_FACTOR = 0.5;
/**
 * Progress decays this many times faster than it grows while contact is broken, in cover and wrap alike; the prey is
 * released when it drains to 0 (#634: a slip drains, it no longer cancels).
 */
export const ENGULF_ESCAPE_DECAY_MULTIPLIER = 2;
/**
 * The arm grab (#735): while an amoeba holds a prey by its arm alone, before the seal, the arm draws the prey toward
 * the body at this many predator radii per second, never past body contact; the seal waits for the body to cover it.
 */
export const ENGULF_ARM_PULL_RADII_PER_SECOND = 1.5;
/**
 * The pull never outruns the prey (#735 review): it is capped at this share of the held prey's own speed cap this tick
 * (sprint, gel and the held factor included), so a prey swimming or sprinting straight away always gains on the arm,
 * however large the amoeba.
 */
export const ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE = 0.5;
/**
 * The drag (#772): before the seal, the share of the gap the predator's own move opened from its prey this tick that
 * is closed again by drawing the prey after it, so a predator passing over a prey at speed carries it instead of
 * coasting off it. It never answers the prey's own swimming, so a prey swims out as it would from a still predator.
 */
export const ENGULF_DRAG_SHARE = 1;
/**
 * After a prey escapes an amoeba, that amoeba cannot grab it by the arm alone for this long (s), one entry per prey
 * (#735 review: without it a prey wobbling around "away" was grabbed and dropped several times a second). The body
 * can still catch it meanwhile.
 */
export const ENGULF_ARM_REGRAB_COOLDOWN_SECONDS = 0.75;
/**
 * Predator speed cap factors: cover and wrap / absorb (sealed, the prey is carried). Grabbing costs the predator no
 * speed (#634): every cell has the same top speed (#677), so any factor under the prey's lets the held prey outrun it.
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
