// The own-cell indicator atlas (docs/rendering/own-cell-indicators.md §10): every ghost the ladder orbit can show, one pip
// block per (variant, eaten) for every endosymbiont tally and the label pill (rings are arc rows), each
// baked once at startup at its fixed px size times the device pixel ratio (rounded up, capped). Keys
// are what `effects/orbit-layout.ts` hands the drawing: a ghost by `OrbitGhost.key` (the rung's
// silhouette or the endosymbiont's trait id), a pip block by `pipBlockKey`. The legibility cues (docs/ui/hud.md
// §3.1.5) add their trend triangle and zone dot, one cue pill per rim role and the zone pill (a label pill without
// the danger rim).

import type { TraitId } from '@evolution/shared';
import { INDICATOR_BAKE_MAX_DPR, INDICATOR_RIM_TINTED_RAMP } from '../constants';
import { CUE_RIM_COLOUR, type CueRim } from '../../hud/format/mass-cues';
import { LADDER_SILHOUETTE, type LadderSilhouette } from '../../state/own-cell-ladder';
import { GHOST_SHAPE, bakeGhost, type GhostShape } from './ghost-bake';
import {
  GAIN_LABEL_PILL_SPEC,
  LABEL_PILL_SPEC,
  bakeLabelPill,
  bakePill,
  cuePillSpec,
  type LabelPillBake,
} from './label-pill-bake';
import { bakePipBlock, endosymbiontTallies, pipBlockKey } from './pip-block-bake';
import { bakeScaleFor, type BakeCanvasFactory, type PxBakedSprite } from './texture-bake';
import { bakeTrendGlyph, bakeZoneDot } from './trend-glyph-bake';

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
  readonly labelPill: LabelPillBake;
  /** The label pill rimmed in `GAIN`: the edible relation label's (docs/ui/hud.md §3.1.5). */
  readonly gainLabelPill: LabelPillBake;
  /** The mass chip's trend triangle and the zone pill's dot, both white for a tint. */
  readonly trendGlyph: PxBakedSprite;
  readonly zoneDot: PxBakedSprite;
  /** One cue pill per rim role. */
  readonly cuePills: Readonly<Record<CueRim, LabelPillBake>>;
  /** The zone pill: the label pill's size without a rim. */
  readonly zonePill: LabelPillBake;
}

/** Texels per CSS px the indicator bakes and fonts use. */
export function indicatorBakeScale(devicePixelRatio: number): number {
  return bakeScaleFor(devicePixelRatio, INDICATOR_BAKE_MAX_DPR);
}

function bakeOrbitSprites(
  factory: BakeCanvasFactory,
  scale: number,
): Pick<IndicatorAtlasBakes, 'ghosts' | 'pipBlocks'> {
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
  return { ghosts, pipBlocks };
}

function bakeCuePills(factory: BakeCanvasFactory, scale: number): Record<CueRim, LabelPillBake> {
  const rims = Object.keys(CUE_RIM_COLOUR) as CueRim[];
  return Object.fromEntries(
    rims.map((rim) => [rim, bakePill(factory, scale, cuePillSpec(CUE_RIM_COLOUR[rim]))]),
  ) as Record<CueRim, LabelPillBake>;
}

export function bakeIndicatorAtlas(factory: BakeCanvasFactory, devicePixelRatio: number): IndicatorAtlasBakes {
  const scale = indicatorBakeScale(devicePixelRatio);
  return {
    ...bakeOrbitSprites(factory, scale),
    labelPill: bakeLabelPill(factory, scale),
    gainLabelPill: bakePill(factory, scale, GAIN_LABEL_PILL_SPEC),
    trendGlyph: bakeTrendGlyph(factory, scale),
    zoneDot: bakeZoneDot(factory, scale),
    cuePills: bakeCuePills(factory, scale),
    zonePill: bakePill(factory, scale, { ...LABEL_PILL_SPEC, rimColour: null }),
  };
}
