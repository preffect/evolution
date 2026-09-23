// What traits grant, one page per ability (docs/architecture/encyclopedia.md §12.4). The id list is content's (#362
// wrote the pages); the anchor is the rule: every `CellModifiers` key belongs to exactly one ability, so a new
// modifier without an ability fails `typecheck`, and an ability page lists the traits that set its keys.

import type { CellModifiers, ValueOf } from '@evolution/shared';

export const ABILITY = {
  movement: 'movement',
  sprint: 'sprint',
  engulfDefence: 'engulf_defence',
  engulfGrip: 'engulf_grip',
  digestion: 'digestion',
  photosynthesis: 'photosynthesis',
  spines: 'spines',
  toxin: 'toxin',
  foodAttraction: 'food_attraction',
  genome: 'genome',
  gelResistance: 'gel_resistance',
} as const;
export type AbilityId = ValueOf<typeof ABILITY>;

/** One row per modifier. */
export const ABILITY_BY_MODIFIER: Readonly<Record<keyof CellModifiers, AbilityId>> = {
  speedMultiplier: ABILITY.movement,
  accelerationSecondsMultiplier: ABILITY.movement,
  sprintSpeedMultiplierBonus: ABILITY.sprint,
  sprintCooldownSecondsDelta: ABILITY.sprint,
  membraneRatioBonus: ABILITY.engulfDefence,
  absorbDurationMultiplierAsPrey: ABILITY.engulfDefence,
  gripResistanceBonus: ABILITY.engulfDefence,
  struggleSlowdownBonus: ABILITY.engulfDefence,
  wrapDurationMultiplierAsPredator: ABILITY.engulfGrip,
  absorbDurationMultiplierAsPredator: ABILITY.engulfGrip,
  gripStrengthBonus: ABILITY.engulfGrip,
  engulfMassYieldBonus: ABILITY.engulfGrip,
  digestionFactorBonus: ABILITY.digestion,
  decayMultiplier: ABILITY.digestion,
  photosynthesisMassPerSecond: ABILITY.photosynthesis,
  spikeDrainFractionPerSecond: ABILITY.spines,
  spitOutChancePerSecond: ABILITY.spines,
  toxinDrainFractionPerSecond: ABILITY.toxin,
  toxinAuraRangeInRadii: ABILITY.toxin,
  attractRangeInRadii: ABILITY.foodAttraction,
  attractSpeed: ABILITY.foodAttraction,
  dnaGainMultiplier: ABILITY.genome,
  dnaKeptOnDeathFraction: ABILITY.genome,
  gelSpeedFactorFloor: ABILITY.gelResistance,
};
