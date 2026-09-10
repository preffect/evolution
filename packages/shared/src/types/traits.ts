// The trait definition shape and the modifier model (docs/TRAITS.md §1, §2). The catalog rows
// themselves are constants (constants/traits.ts); this file only says what a row looks like.

import type { BacteriumVariant, CellStage, DnaTag, TraitId } from './game.js';
import type { EXCLUSION_GROUPS } from '../constants/traits.js';

type ValueOf<Table> = Table[keyof Table];

/**
 * Every trait tier is a partial of this record; the cell's effective modifiers are folded over
 * all owned traits: multipliers multiply, bonuses and deltas add, floors take the max
 * (docs/TRAITS.md §2). `DEFAULT_CELL_MODIFIERS` (constants/traits.ts) is the identity.
 */
export interface CellModifiers {
  speedMultiplier: number;
  accelerationSecondsMultiplier: number;
  sprintSpeedMultiplierBonus: number;
  sprintCooldownSecondsDelta: number;
  /** Added to `ENGULF_MASS_RATIO` and `ENGULF_RELEASE_RATIO` when this cell is prey (docs/ECOLOGY.md §6.1). */
  membraneRatioBonus: number;
  engulfDurationMultiplierAsPrey: number;
  engulfDurationMultiplierAsPredator: number;
  engulfMassYieldBonus: number;
  digestionFactorBonus: number;
  decayMultiplier: number;
  /** Gained per second while inside `sunlit_shallows`. */
  photosynthesisMassPerSecond: number;
  /** A predator engulfing this cell loses this share of its mass per second. */
  spikeDrainFractionPerSecond: number;
  /** Cells overlapping this one lose this share of their mass per second (floor `CELL_STARTING_MASS`). */
  toxinDrainFractionPerSecond: number;
  /** The toxin also reaches cells whose centre is within this many radii, without contact. */
  toxinAuraRangeInRadii: number;
  /** Motes whose centre is within this many radii drift toward the cell. */
  attractRangeInRadii: number;
  /** World units per second of that drift. */
  attractSpeed: number;
  /** Every DNA gain; never the late-join gift. */
  dnaGainMultiplier: number;
  /** Share of `dnaTowardNextLevel` kept on death (adds, cap 1). */
  dnaKeptOnDeathFraction: number;
  /** Floor (max) on `gelSpeedFactor(mass)` (docs/ECOLOGY.md §5.2). */
  gelSpeedFactorFloor: number;
}

/** One tier's row: only the fields the tier changes. */
export type TraitTierModifiers = Partial<CellModifiers>;

/** Tier I..III. */
export type TraitTiers = readonly [TraitTierModifiers, TraitTierModifiers, TraitTierModifiers];

export const TRAIT_CATEGORY = {
  genome: 'genome',
  locomotion: 'locomotion',
  membrane: 'membrane',
  metabolism: 'metabolism',
  sensory: 'sensory',
  offense: 'offense',
  defense: 'defense',
  form: 'form',
  colony: 'colony',
} as const;
export type TraitCategory = ValueOf<typeof TRAIT_CATEGORY>;

export const TRAIT_RARITY = { common: 'common', uncommon: 'uncommon', rare: 'rare' } as const;
export type TraitRarity = ValueOf<typeof TRAIT_RARITY>;

export type ExclusionGroup = (typeof EXCLUSION_GROUPS)[number];

/** Endosymbionts only: the bacteria of one variant that must be eaten before the trait is offered. */
export interface TraitUnlock {
  bacteriumVariant: BacteriumVariant;
  count: number;
}

/** The id-independent part of a definition; the catalog literal is checked against it before `TraitId` exists. */
export interface TraitDefinitionBase {
  /** Evocative, two words. */
  name: string;
  /** The cell must have reached this stage to be offered the trait (docs/GAME-DESIGN.md §3). */
  stage: CellStage;
  unlockedBy?: TraitUnlock;
  category: TraitCategory;
  rarity: TraitRarity;
  /** Draft weighting (docs/PROGRESSION.md §3). */
  tags: readonly DnaTag[];
  exclusionGroup?: ExclusionGroup;
  tiers: TraitTiers;
  /** What the renderer must show, per tier. */
  visual: string;
  /** The sound event id; a hook only in build 1 (#101 narrows it to `SoundEventId`). */
  audioCue: string;
}

/** A catalog row as written: ids are plain strings until the catalog derives `TraitId`. */
export interface TraitCatalogRow extends TraitDefinitionBase {
  id: string;
  requires: readonly string[];
}

/** A catalog row as consumed: every id is a `TraitId`. */
export interface TraitDefinition extends TraitDefinitionBase {
  id: TraitId;
  /** Every id must be owned (any tier) before the trait can be offered. */
  requires: readonly TraitId[];
}
