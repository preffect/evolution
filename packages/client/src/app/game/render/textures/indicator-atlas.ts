// The own-cell indicator atlas (docs/rendering/own-cell-indicators.md §10): every ghost the ladder orbit can show, one pip
// block per (variant, eaten) for every endosymbiont tally, the unlock ring and the label pill, each
// baked once at startup at its fixed px size times the device pixel ratio (rounded up, capped). Keys
// are what `effects/orbit-layout.ts` hands the drawing: a ghost by `OrbitGhost.key` (the rung's
// silhouette or the endosymbiont's trait id), a pip block by `pipBlockKey`.

import type { TraitId } from '@evolution/shared';
import { INDICATOR_BAKE_MAX_DPR, INDICATOR_RIM_TINTED_RAMP } from '../constants';
import { LADDER_SILHOUETTE, type LadderSilhouette } from '../../state/own-cell-indicators';
import { GHOST_SHAPE, bakeGhost, type GhostShape } from './ghost-bake';
import { bakeLabelPill, type LabelPillBake } from './label-pill-bake';
import { bakePipBlock, bakeUnlockRing, endosymbiontTallies, pipBlockKey } from './pip-block-bake';
import { bakeScaleFor, type BakeCanvasFactory, type PxBakedSprite } from './texture-bake';

/** A ghost's atlas key: the next rung's silhouette, or the endosymbiont a counter unlocks (`OrbitGhost.key`). */
export type GhostKey = LadderSilhouette | TraitId;

/** The rung ghosts' shapes (ui/hud.md §3.1.2): the nucleoid loop, the envelope circle, the form's slipper. */
export const GHOST_SHAPE_BY_SILHOUETTE: Readonly<Record<LadderSilhouette, GhostShape>> = {
  [LADDER_SILHOUETTE.nucleoid]: GHOST_SHAPE.loop,
  [LADDER_SILHOUETTE.envelope]: GHOST_SHAPE.envelope,
  [LADDER_SILHOUETTE.form]: GHOST_SHAPE.slipper,
};

/** The counters' ghosts: the mitochondrion's bean and the chloroplast's lens. */
export const GHOST_SHAPE_BY_ENDOSYMBIONT: Readonly<Partial<Record<TraitId, GhostShape>>> = {
  mitochondrion: GHOST_SHAPE.bean,
  chloroplast: GHOST_SHAPE.lens,
};

export interface IndicatorAtlasBakes {
  /** Keyed by `GhostKey`; the rung ghosts bake white for the rim-colour tint, the counters' in their organelle colour. */
  readonly ghosts: Readonly<Partial<Record<GhostKey, PxBakedSprite>>>;
  /** Keyed by `pipBlockKey(variant, eaten, required)`, `eaten` from 0 to `required`. */
  readonly pipBlocks: Readonly<Record<string, PxBakedSprite>>;
  readonly unlockRing: PxBakedSprite;
  readonly labelPill: LabelPillBake;
}

/** Texels per CSS px the indicator bakes and fonts use. */
export function indicatorBakeScale(devicePixelRatio: number): number {
  return bakeScaleFor(devicePixelRatio, INDICATOR_BAKE_MAX_DPR);
}

export function bakeIndicatorAtlas(factory: BakeCanvasFactory, devicePixelRatio: number): IndicatorAtlasBakes {
  const scale = indicatorBakeScale(devicePixelRatio);
  const ghosts: Partial<Record<GhostKey, PxBakedSprite>> = {};
  for (const silhouette of Object.values(LADDER_SILHOUETTE)) {
    ghosts[silhouette] = bakeGhost(factory, scale, GHOST_SHAPE_BY_SILHOUETTE[silhouette], INDICATOR_RIM_TINTED_RAMP);
  }
  const pipBlocks: Record<string, PxBakedSprite> = {};
  for (const tally of endosymbiontTallies()) {
    const shape = GHOST_SHAPE_BY_ENDOSYMBIONT[tally.traitId];
    if (shape !== undefined) ghosts[tally.traitId] = bakeGhost(factory, scale, shape, tally.ramp);
    for (let eaten = 0; eaten <= tally.required; eaten += 1) {
      pipBlocks[pipBlockKey(tally.variant, eaten, tally.required)] = bakePipBlock(factory, scale, tally, eaten);
    }
  }
  return { ghosts, pipBlocks, unlockRing: bakeUnlockRing(factory, scale), labelPill: bakeLabelPill(factory, scale) };
}
