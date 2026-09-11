// Food kinds, spawners, zones and decay (docs/ECOLOGY.md §1–§4, §7). Weight tables are keyed by
// the ids of types/game.ts; the spawner draws from them by id, never by a switch.

import { BACTERIUM_VARIANT, CELL_STAGE, DNA_TAG, ENTITY_KIND, FOOD_KIND, ZONE_ID } from '../types/game.js';
import type { BacteriumVariant, CellStage, DnaTag, ZoneId } from '../types/game.js';

/** Kinds the spawner draws; detritus only drops from dead cells. */
export type SpawnedKind = typeof FOOD_KIND.algae | typeof FOOD_KIND.bacterium | typeof ENTITY_KIND.dnaFragment;
/** Zones a spawn point is drawn in; a gel patch is part of the broth for spawning. */
export type SpawnZoneId = Exclude<ZoneId, typeof ZONE_ID.viscousGel>;
/** The two kinds the spawner draws between; their shares change with the world stage (§3.2). */
export type FoodKindWeights = Record<typeof FOOD_KIND.algae | typeof FOOD_KIND.bacterium, number>;
/** The zones whose variant row never changes: a trip is always a trip (§3.2). */
export type TripZoneId = typeof ZONE_ID.warmVent | typeof ZONE_ID.sunlitShallows;

// ---- food kinds (§1) ----
export const ALGAE_MASS = 1;
export const ALGAE_DNA = 0;
export const ALGAE_RADIUS = 6;
export const BACTERIUM_MASS = 3;
export const BACTERIUM_DNA = 1;
export const BACTERIUM_RADIUS = 8;
/** Random-walk speed (wu/s). */
export const BACTERIUM_DRIFT_SPEED = 20;
/** Bacteria spawn as clusters of this many within this radius (wu) of the drawn point. */
export const BACTERIUM_CLUSTER_SIZE = 5;
export const BACTERIUM_CLUSTER_RADIUS = 60;
/** The three variants in walk order (docs/DETERMINISM.md §5). */
export const BACTERIUM_VARIANTS = [
  BACTERIUM_VARIANT.plain,
  BACTERIUM_VARIANT.aerobic,
  BACTERIUM_VARIANT.photosynthetic,
] as const satisfies readonly BacteriumVariant[];
export const BACTERIUM_TAG_BY_VARIANT: Record<BacteriumVariant, DnaTag> = {
  [BACTERIUM_VARIANT.plain]: DNA_TAG.motile,
  [BACTERIUM_VARIANT.aerobic]: DNA_TAG.metabolic,
  [BACTERIUM_VARIANT.photosynthetic]: DNA_TAG.photic,
};
export const DETRITUS_MOTE_MASS = 2;
export const DETRITUS_RADIUS = 7;
/** Share of a dead or dissolved cell's mass that drops as detritus. */
export const DETRITUS_MASS_FRACTION = 0.2;
export const DETRITUS_LIFETIME_SECONDS = 30;
export const DNA_FRAGMENT_DNA = 5;
export const DNA_FRAGMENT_RADIUS = 9;
/** Slow drift (wu/s). */
export const DNA_FRAGMENT_DRIFT_SPEED = 10;

// ---- spawn model (§3, by world stage §3.2) ----
/** Per-mote shares by world stage; the cluster-adjusted event weights are derived in the spawner. */
export const FOOD_KIND_WEIGHTS_BY_WORLD_STAGE: Record<CellStage, FoodKindWeights> = {
  [CELL_STAGE.protocell]: { algae: 0.75, bacterium: 0.25 },
  [CELL_STAGE.prokaryote]: { algae: 0.7, bacterium: 0.3 },
  [CELL_STAGE.endosymbiosis]: { algae: 0.6, bacterium: 0.4 },
  [CELL_STAGE.eukaryote]: { algae: 0.5, bacterium: 0.5 },
  [CELL_STAGE.specialised]: { algae: 0.5, bacterium: 0.5 },
};
/**
 * The broth's (and gel's) share of organelle-carrying bacteria by world stage: plain = 1 − share,
 * aerobic = photosynthetic = share / 2 (derived in simulation/bacterium-variant-weights.ts).
 */
export const BROTH_VARIANT_SHARE_BY_WORLD_STAGE: Record<CellStage, number> = {
  [CELL_STAGE.protocell]: 0,
  [CELL_STAGE.prokaryote]: 0.2,
  [CELL_STAGE.endosymbiosis]: 0.4,
  [CELL_STAGE.eukaryote]: 0.6,
  [CELL_STAGE.specialised]: 0.6,
};
export const FOOD_ZONE_WEIGHTS_BY_KIND: Record<SpawnedKind, Record<SpawnZoneId, number>> = {
  [FOOD_KIND.algae]: { [ZONE_ID.sunlitShallows]: 0.7, [ZONE_ID.openBroth]: 0.25, [ZONE_ID.warmVent]: 0.05 },
  [FOOD_KIND.bacterium]: { [ZONE_ID.warmVent]: 0.6, [ZONE_ID.openBroth]: 0.3, [ZONE_ID.sunlitShallows]: 0.1 },
  [ENTITY_KIND.dnaFragment]: { [ZONE_ID.warmVent]: 0.4, [ZONE_ID.openBroth]: 0.4, [ZONE_ID.sunlitShallows]: 0.2 },
};
/**
 * The fixed trip rows: a vent trip is the mitochondrion, a shallows trip the chloroplast. The
 * broth and gel rows follow the world stage (`BROTH_VARIANT_SHARE_BY_WORLD_STAGE`), so they are
 * derived, never declared here.
 */
export const BACTERIUM_VARIANT_WEIGHTS_BY_ZONE: Record<TripZoneId, Record<BacteriumVariant, number>> = {
  [ZONE_ID.warmVent]: { plain: 0.3, aerobic: 0.7, photosynthetic: 0 },
  [ZONE_ID.sunlitShallows]: { plain: 0.3, aerobic: 0, photosynthetic: 0.7 },
};
export const FOOD_CAP_BASE = 600;
export const FOOD_CAP_PER_PLAYER = 100;
export const FOOD_SPAWN_PER_SECOND_BASE = 6;
export const FOOD_SPAWN_PER_SECOND_PER_PLAYER = 1;
export const FOOD_INITIAL_FILL_FRACTION = 0.6;
export const DNA_FRAGMENT_CAP_BASE = 30;
export const DNA_FRAGMENT_CAP_PER_PLAYER = 10;
export const DNA_FRAGMENT_SPAWN_PER_SECOND_BASE = 0.3;
export const DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER = 0.1;
export const DNA_FRAGMENT_INITIAL_FILL_FRACTION = 0.6;
/** A fragment's tag is drawn at spawn from its zone's row (§2); gel uses the broth row. */
export const DNA_FRAGMENT_TAG_TABLE_BY_ZONE: Record<ZoneId, Partial<Record<DnaTag, number>>> = {
  [ZONE_ID.sunlitShallows]: { photic: 0.5, sensory: 0.5 },
  [ZONE_ID.warmVent]: { predatory: 0.4, toxic: 0.3, metabolic: 0.3 },
  [ZONE_ID.viscousGel]: { motile: 0.5, armored: 0.5 },
  [ZONE_ID.openBroth]: { motile: 0.5, armored: 0.5 },
};
/** From `ROUND_BLOOM_START_FRACTION` of the round the rates multiply; caps are unchanged. */
export const FOOD_BLOOM_SPAWN_MULTIPLIER = 1.5;
export const DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER = 2;
/** Point redraws before a spawn is skipped. */
export const SPAWN_POINT_MAX_ATTEMPTS = 10;

// ---- zones (§2) and decay (§4) ----
/** The shallows are the annulus `DISH_RADIUS − SHALLOWS_WIDTH` .. `DISH_RADIUS` (wu). */
export const SHALLOWS_WIDTH = 500;
/** The vent is the disc of this radius at the origin (wu). */
export const VENT_RADIUS = 500;
export const GEL_PATCH_COUNT = 3;
export const GEL_PATCH_RADIUS = 350;
export const GEL_PATCH_MIN_SPACING = 900;
/** Mass decay multiplier inside the vent. */
export const VENT_DECAY_MULTIPLIER = 1.5;
/** decayPerSecond = (mass − CELL_STARTING_MASS) × this × zone × trait multipliers. */
export const MASS_DECAY_RATE_PER_SECOND = 0.002;
