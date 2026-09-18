// The preview specs the scene specs walk (docs/architecture/encyclopedia.md §12.9): one per family that ticket
// #363 built, with the cell family spread across the ladder's real trait sets rather than one made-up set.
//
// Shared by `preview-scene.spec.ts` and `preview-framing.spec.ts` so the two cannot drift: the stand-in test in
// the first fails the moment ticket #364 gives an action family a builder, and the fix is to add it here, which
// brings the framing bands in the second along with it.

import { BACTERIUM_VARIANT, CELL_KIND, CELL_STAGE, DNA_TAG, FOOD_KIND, ZONE_ID } from '@evolution/shared';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { PREVIEW_SCENES_AWAITING_BUILDERS } from './preview-scene';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from './preview-spec';

export const ZONE_IDS = Object.values(ZONE_ID);

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
