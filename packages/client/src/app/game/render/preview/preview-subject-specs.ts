// The preview specs the scene specs walk (docs/architecture/encyclopedia.md §12.9): one per family that ticket
// #363 built, with the cell family spread across the ladder's real trait sets rather than one made-up set.
//
// Shared by `preview-scene.spec.ts` and `preview-framing.spec.ts` so the two cannot drift: the stand-in test in
// the first fails the moment ticket #364 gives an action family a builder, and the fix is to add it here, which
// brings the framing bands in the second along with it.

import {
  BACTERIUM_VARIANT,
  CELL_KIND,
  CELL_STAGE,
  DNA_TAG,
  FOOD_KIND,
  ZONE_ID,
  type OwnedTrait,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { PREVIEW_SCENES_AWAITING_BUILDERS } from './preview-scene';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from './preview-spec';

export const ZONE_IDS = Object.values(ZONE_ID);

const TIER_III: TraitTier = 3;
const FLAGELLUM_TRAIT: TraitId = 'simple_flagellum';
const DIATOM_TRAIT: TraitId = 'diatom_shell';
const AMOEBA_TRAIT: TraitId = 'amoeba_pseudopods';

/**
 * Two cells the ladder's stage sets do not reach, and the framing bands turn on both (#364).
 *
 * `BENCH_STAGE_TRAITS` tops its flagellum out at tier **II**, and a tier-III tail is the widest thing this family
 * draws — it is the case the single `PREVIEW_CELL_VIEW_RADII` 4.4 existed for, so the framing that replaced it has
 * to be measured against it rather than against one tier down. `diatom_shell` is the ladder's only **rigid** form,
 * which is the one path where `restScales` zeroes the breathing, the jitter and the lobes at once; every bench set
 * takes the other branch. Both are entries a reader can open, so both are framings that ship.
 */
const EXTREME_TRAIT_SETS: readonly (readonly OwnedTrait[])[] = [
  BENCH_STAGE_TRAITS[CELL_STAGE.prokaryote].map((owned) =>
    owned.traitId === FLAGELLUM_TRAIT ? { ...owned, tier: TIER_III } : { ...owned },
  ),
  BENCH_STAGE_TRAITS[CELL_STAGE.specialised].map((owned) =>
    owned.traitId === AMOEBA_TRAIT ? { traitId: DIATOM_TRAIT, tier: TIER_III } : { ...owned },
  ),
];

/** One spec per family, plus a spread of the cell family across the ladder's real trait sets. */
export const SUBJECT_SPECS: readonly PreviewSpec[] = [
  ...Object.values(CELL_STAGE).flatMap((stage): PreviewSpec[] =>
    Object.values(PREVIEW_MOTION).map((motion) => ({
      scene: PREVIEW_SCENE.cell,
      cellKind: CELL_KIND.player,
      traits: BENCH_STAGE_TRAITS[stage],
      motion,
    })),
  ),
  { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.wild, traits: [], motion: PREVIEW_MOTION.resting },
  ...EXTREME_TRAIT_SETS.map((traits): PreviewSpec => ({
    scene: PREVIEW_SCENE.cell,
    cellKind: CELL_KIND.player,
    traits,
    motion: PREVIEW_MOTION.swimming,
  })),
  ...Object.values(FOOD_KIND).map((foodKind): PreviewSpec => ({
    scene: PREVIEW_SCENE.food,
    foodKind,
    bacteriumVariant: foodKind === FOOD_KIND.bacterium ? BACTERIUM_VARIANT.aerobic : null,
  })),
  ...Object.values(DNA_TAG).map((tag): PreviewSpec => ({ scene: PREVIEW_SCENE.dnaFragment, tag })),
  ...ZONE_IDS.map((zone): PreviewSpec => ({ scene: PREVIEW_SCENE.zone, zone })),
];

/** Every family in `PREVIEW_SCENE`, one spec each: what `previewSceneFor` must be total over. */
export const EVERY_FAMILY_SPECS: readonly PreviewSpec[] = [
  ...SUBJECT_SPECS,
  ...PREVIEW_SCENES_AWAITING_BUILDERS.map((scene): PreviewSpec => ({ scene })),
];
