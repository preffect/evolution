// The modifier model's numbers (docs/TRAITS.md §2, §3): the identity record and every tier
// table. `traits.ts` re-exports them beside the catalog so `traits` stays the one domain.

import type { CellModifiers, TraitTiers } from '../types/traits.js';

/** The protocell baseline: every modifier at its identity (docs/TRAITS.md §2). */
export const DEFAULT_CELL_MODIFIERS: CellModifiers = {
  speedMultiplier: 1,
  accelerationSecondsMultiplier: 1,
  sprintSpeedMultiplierBonus: 0,
  sprintCooldownSecondsDelta: 0,
  membraneRatioBonus: 0,
  absorbDurationMultiplierAsPrey: 1,
  wrapDurationMultiplierAsPredator: 1,
  absorbDurationMultiplierAsPredator: 1,
  gripStrengthBonus: 0,
  gripResistanceBonus: 0,
  struggleSlowdownBonus: 0,
  spitOutChancePerSecond: 0,
  engulfMassYieldBonus: 0,
  digestionFactorBonus: 0,
  decayMultiplier: 1,
  photosynthesisMassPerSecond: 0,
  spikeDrainFractionPerSecond: 0,
  toxinDrainFractionPerSecond: 0,
  toxinAuraRangeInRadii: 0,
  attractRangeInRadii: 0,
  attractSpeed: 0,
  dnaGainMultiplier: 1,
  dnaKeptOnDeathFraction: 0,
  gelSpeedFactorFloor: 0,
};

/** `SPRINT_COOLDOWN_SECONDS + sprintCooldownSecondsDelta` never goes below this (s). */
export const SPRINT_COOLDOWN_FLOOR_SECONDS = 0.5;

// Tier I..III of every build-1 trait (docs/TRAITS.md §3). The catalog row of each trait references
// its table, and `TRAIT_TIERS` (traits.ts) is derived from the catalog, keyed by id.
export const NUCLEOID_TIERS: TraitTiers = [
  { dnaGainMultiplier: 1.05 },
  { dnaGainMultiplier: 1.1 },
  { dnaGainMultiplier: 1.15 },
];
export const SIMPLE_FLAGELLUM_TIERS: TraitTiers = [
  { speedMultiplier: 1.05, sprintSpeedMultiplierBonus: 0.3, sprintCooldownSecondsDelta: -0.5 },
  { speedMultiplier: 1.05, sprintSpeedMultiplierBonus: 0.6, sprintCooldownSecondsDelta: -1.0 },
  { speedMultiplier: 1.05, sprintSpeedMultiplierBonus: 0.9, sprintCooldownSecondsDelta: -1.5 },
];
export const CELL_WALL_TIERS: TraitTiers = [
  { membraneRatioBonus: 0.15, speedMultiplier: 0.95 },
  { membraneRatioBonus: 0.3, speedMultiplier: 0.9 },
  { membraneRatioBonus: 0.45, speedMultiplier: 0.85 },
];
export const RIBOSOMES_TIERS: TraitTiers = [
  { digestionFactorBonus: 0.1 },
  { digestionFactorBonus: 0.2 },
  { digestionFactorBonus: 0.3 },
];
export const MITOCHONDRION_TIERS: TraitTiers = [
  { decayMultiplier: 0.85, sprintSpeedMultiplierBonus: 0.1 },
  { decayMultiplier: 0.7, sprintSpeedMultiplierBonus: 0.2 },
  { decayMultiplier: 0.55, sprintSpeedMultiplierBonus: 0.3 },
];
export const CHLOROPLAST_TIERS: TraitTiers = [
  { photosynthesisMassPerSecond: 0.3, decayMultiplier: 0.9 },
  { photosynthesisMassPerSecond: 0.6, decayMultiplier: 0.8 },
  { photosynthesisMassPerSecond: 0.9, decayMultiplier: 0.7 },
];
export const NUCLEAR_ENVELOPE_TIERS: TraitTiers = [
  { dnaKeptOnDeathFraction: 0.25 },
  { dnaKeptOnDeathFraction: 0.5 },
  { dnaKeptOnDeathFraction: 0.75 },
];
export const CYTOSKELETON_TIERS: TraitTiers = [
  { accelerationSecondsMultiplier: 0.85 },
  { accelerationSecondsMultiplier: 0.72 },
  { accelerationSecondsMultiplier: 0.61 },
];
export const CILIA_TIERS: TraitTiers = [{ speedMultiplier: 1.1 }, { speedMultiplier: 1.2 }, { speedMultiplier: 1.3 }];
export const FOOD_VACUOLE_TIERS: TraitTiers = [
  { absorbDurationMultiplierAsPredator: 0.8, engulfMassYieldBonus: 0.05 },
  { absorbDurationMultiplierAsPredator: 0.64, engulfMassYieldBonus: 0.1 },
  { absorbDurationMultiplierAsPredator: 0.51, engulfMassYieldBonus: 0.15 },
];
export const TOXIN_VACUOLE_TIERS: TraitTiers = [
  { toxinDrainFractionPerSecond: 0.03 },
  { toxinDrainFractionPerSecond: 0.05 },
  { toxinDrainFractionPerSecond: 0.07 },
];
export const AMOEBA_PSEUDOPODS_TIERS: TraitTiers = [
  { gelSpeedFactorFloor: 0.6, wrapDurationMultiplierAsPredator: 0.85 },
  { gelSpeedFactorFloor: 0.8, wrapDurationMultiplierAsPredator: 0.75 },
  { gelSpeedFactorFloor: 1.0, wrapDurationMultiplierAsPredator: 0.65 },
];
export const PARAMECIUM_CILIA_TIERS: TraitTiers = [
  { speedMultiplier: 1.1, accelerationSecondsMultiplier: 0.9 },
  { speedMultiplier: 1.15, accelerationSecondsMultiplier: 0.8 },
  { speedMultiplier: 1.2, accelerationSecondsMultiplier: 0.7 },
];
export const EUGLENA_EYESPOT_TIERS: TraitTiers = [
  { attractRangeInRadii: 3, attractSpeed: 40 },
  { attractRangeInRadii: 4, attractSpeed: 60 },
  { attractRangeInRadii: 5, attractSpeed: 80 },
];
export const DIATOM_SHELL_TIERS: TraitTiers = [
  { absorbDurationMultiplierAsPrey: 1.4, spikeDrainFractionPerSecond: 0.02, speedMultiplier: 0.97 },
  { absorbDurationMultiplierAsPrey: 1.8, spikeDrainFractionPerSecond: 0.04, speedMultiplier: 0.94 },
  { absorbDurationMultiplierAsPrey: 2.2, spikeDrainFractionPerSecond: 0.06, speedMultiplier: 0.91 },
];
export const STENTOR_TRUMPET_TIERS: TraitTiers = [
  { toxinAuraRangeInRadii: 1.0, digestionFactorBonus: 0.1 },
  { toxinAuraRangeInRadii: 1.5, digestionFactorBonus: 0.2 },
  { toxinAuraRangeInRadii: 2.0, digestionFactorBonus: 0.3 },
];
