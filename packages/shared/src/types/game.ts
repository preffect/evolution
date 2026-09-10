// The views: the wire types of the game (docs/ARCHITECTURE.md §2, their one home). Every id and
// kind is an `as const` object with its union derived from it (docs/CODE-STANDARDS.md §2); the
// ordered arrays the simulation walks (`STAGE_ORDER`, `DNA_TAGS`, `BACTERIUM_VARIANTS`) live in
// the constants files and are pinned complete against these objects. The meaning of each field
// is owned by the design doc named beside it.

import type { EntityId, PlayerId, ValueOf } from './common.js';
import type { TRAIT_CATALOG } from '../constants/traits.js';

// ===== Ids and kinds =====

/** `colony` is reserved for build 2 and rejected by the server (docs/GAME-DESIGN.md §11). */
export const GAME_MODE = { freeForAll: 'free_for_all', colony: 'colony' } as const;
export type GameMode = ValueOf<typeof GAME_MODE>;

/** Dominant-organism and DNA-target end conditions are reserved (docs/GAME-DESIGN.md §5). */
export const ROUND_END_CONDITION = { timer: 'timer' } as const;
export type RoundEndCondition = ValueOf<typeof ROUND_END_CONDITION>;

export const ROUND_PHASE = { playing: 'playing', results: 'results' } as const;
export type RoundPhase = ValueOf<typeof ROUND_PHASE>;

/** docs/ECOLOGY.md §1. */
export const FOOD_KIND = { algae: 'algae', bacterium: 'bacterium', detritus: 'detritus' } as const;
export type FoodKind = ValueOf<typeof FOOD_KIND>;

/** The endosymbiosis hook (docs/ECOLOGY.md §1); `BACTERIUM_VARIANTS` (constants/ecology.ts) fixes the walk order. */
export const BACTERIUM_VARIANT = { plain: 'plain', aerobic: 'aerobic', photosynthetic: 'photosynthetic' } as const;
export type BacteriumVariant = ValueOf<typeof BACTERIUM_VARIANT>;

/** docs/PROGRESSION.md §1; `DNA_TAGS` (constants/progression.ts) fixes the walk order. */
export const DNA_TAG = {
  motile: 'motile',
  photic: 'photic',
  predatory: 'predatory',
  armored: 'armored',
  toxic: 'toxic',
  sensory: 'sensory',
  metabolic: 'metabolic',
} as const;
export type DnaTag = ValueOf<typeof DNA_TAG>;

/** docs/ECOLOGY.md §2: a point belongs to the first zone, in this order, that contains it. */
export const ZONE_ID = {
  sunlitShallows: 'sunlit_shallows',
  warmVent: 'warm_vent',
  viscousGel: 'viscous_gel',
  openBroth: 'open_broth',
} as const;
export type ZoneId = ValueOf<typeof ZONE_ID>;

/** Simulation states only (docs/ECOLOGY.md §6.2); death lives on the player. `dividing` is reserved. */
export const CELL_STATE = {
  free: 'free',
  beingEngulfed: 'being_engulfed',
  engulfing: 'engulfing',
  dividing: 'dividing',
} as const;
export type CellState = ValueOf<typeof CELL_STATE>;

/** The evolution ladder (docs/GAME-DESIGN.md §3); `STAGE_ORDER` (constants/ladder.ts) fixes the climb order. */
export const CELL_STAGE = {
  protocell: 'protocell',
  prokaryote: 'prokaryote',
  endosymbiosis: 'endosymbiosis',
  eukaryote: 'eukaryote',
  specialised: 'specialised',
} as const;
export type CellStage = ValueOf<typeof CELL_STAGE>;

export const PLAYER_LIFE_STATE = { alive: 'alive', spectating: 'spectating' } as const;
export type PlayerLifeState = ValueOf<typeof PLAYER_LIFE_STATE>;

/** The debug tools' entity filter vocabulary and the id prefixes (docs/ARCHITECTURE.md §2). */
export const ENTITY_KIND = { cell: 'cell', foodMote: 'food_mote', dnaFragment: 'dna_fragment' } as const;
export type EntityKind = ValueOf<typeof ENTITY_KIND>;

/** Derived from the catalog (docs/TRAITS.md §3): a trait id exists only as a catalog row. */
export type TraitId = (typeof TRAIT_CATALOG)[number]['id'];
export type TraitTier = 1 | 2 | 3;

// ===== Views =====

export interface OwnedTrait {
  traitId: TraitId;
  tier: TraitTier;
}

export interface CellView {
  id: EntityId;
  playerId: PlayerId;
  /** Equals `id` in build 1: the reserved colony grouping key (docs/GAME-DESIGN.md §11). */
  organismId: EntityId;
  avatarIndex: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  mass: number;
  radius: number;
  level: number;
  /** Derived from the owned traits by `stageOf`; carried for the renderer and the HUD. */
  stage: CellStage;
  traits: OwnedTrait[];
  /** `modifiers.membraneRatioBonus` mirrored at step 1 so `canEngulf` (docs/ECOLOGY.md §6.1) reads views on both sides. */
  membraneRatioBonus: number;
  /** `engulfing` and `being_engulfed` may coexist (a chain). */
  states: CellState[];
  /** 0..1 as prey. */
  engulfProgress: number;
  engulfingCellId: EntityId | null;
  engulfedByCellId: EntityId | null;
  sprintRemainingTicks: number;
  /** 0 = sprint ready; the HUD meter reads it (docs/UI.md §3.1), never estimates it. */
  sprintCooldownRemainingTicks: number;
}

export interface MotePositionView {
  id: EntityId;
  x: number;
  y: number;
}

export interface FoodMoteView {
  id: EntityId;
  kind: FoodKind;
  /** Set when `kind` is `bacterium`, null otherwise. */
  bacteriumVariant: BacteriumVariant | null;
  x: number;
  y: number;
}

export interface DnaFragmentView {
  id: EntityId;
  x: number;
  y: number;
  tag: DnaTag;
}

export interface GelPatchView {
  x: number;
  y: number;
  radius: number;
}

export interface TraitOfferView {
  offerId: number;
  /** The tier each card would grant. */
  cards: OwnedTrait[];
  expiresAtTick: number;
}

export interface TraitChoiceInput {
  offerId: number;
  /** 0..TRAIT_DRAFT_SIZE-1; a stale `offerId` is ignored (docs/PROGRESSION.md §4). */
  cardIndex: number;
}

export interface PlayerProgressView {
  playerId: PlayerId;
  playerName: string;
  level: number;
  dnaCumulative: number;
  dnaCatchUpGift: number;
  dnaTowardNextLevel: number;
  dnaTagPoints: Record<DnaTag, number>;
  /** Endosymbiosis counters, kept on death (docs/ECOLOGY.md §1). */
  bacteriaEatenByVariant: Record<BacteriumVariant, number>;
  absorptions: number;
  score: number;
  offer: TraitOfferView | null;
  /** The only home of death and respawn (docs/ECOLOGY.md §6.2). */
  lifeState: PlayerLifeState;
  spectatingPlayerId: PlayerId | null;
  respawnInTicks: number;
}

export interface LeaderboardRow {
  rank: number;
  playerId: PlayerId;
  score: number;
  mass: number;
  level: number;
  absorptions: number;
}
