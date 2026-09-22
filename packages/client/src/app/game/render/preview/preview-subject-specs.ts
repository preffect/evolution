// The preview specs the scene specs walk (docs/architecture/encyclopedia.md §12.9): one per family, with the cell
// family spread across the ladder's real trait sets rather than one made-up set.
//
// Shared by `preview-scene.spec.ts` and `preview-framing.spec.ts` so the two cannot drift: a family added here is
// resolved, walked for determinism and measured against the framing bands in one move.

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

/**
 * The action families ticket #364 built: three single-cell, two two-cell. They carry no options — an action scene
 * is one fixed subject doing one thing — so each is its whole coverage, and being here is what puts them through
 * the framing bands, the loop's closure and the determinism walk alongside every other family.
 */
const ACTION_SCENES = [
  PREVIEW_SCENE.eat,
  PREVIEW_SCENE.sprint,
  PREVIEW_SCENE.levelUp,
  PREVIEW_SCENE.engulf,
  PREVIEW_SCENE.escape,
] as const;

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
  ...ACTION_SCENES.map((scene): PreviewSpec => ({ scene })),
];

/** Every family in `PREVIEW_SCENE` has a builder now, so the list above is what `previewSceneFor` is total over. */
export const EVERY_FAMILY_SPECS: readonly PreviewSpec[] = SUBJECT_SPECS;
