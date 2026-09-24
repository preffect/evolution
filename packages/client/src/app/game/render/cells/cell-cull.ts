// How far from its centre the cell layer must still draw a cell (docs/rendering/budget.md §6, ticket #529): the cull
// asks whether a disc of this reach touches the camera extent, with no further margin, so it is exactly as generous
// as the cell is wide. The reach is the widest thing the cell can draw in **any** frame — its membrane, halo, cilia
// and a sprinting tail at their peak with the widest clip playing (`cellDrawExtentRadii`), or a ring the cell may
// carry, whose px floors outgrow its radius on a small far cell. Deriving it from the drawn extent, rather than a
// constant number of radii, is what keeps a tail tip or a ring from popping in at the screen edge.

import { MOTION_CLIPS, type MotionClipId } from '@evolution/shared';
import {
  FAR_DOT_HALO_RADII,
  FLAGELLUM_OUTER_PX,
  RELATION_RING_STROKE_PX,
  STARVING_WRINKLE_AMPLITUDE,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { EATING_CLIP_CONTEXT, UNAIMED_CLIP_CONTEXT, clipDeformationPeak, engulfDeformationPeak } from './cell-clips';
import { NO_EFFECT_REACH, cellDrawExtentRadii, type CellDrawState } from './cell-draw-extent';
import { relationRingOuterLinePx, relationRingPackingFor, warningRingRadiusPx } from './cell-instance-builder';
import type { CellTraitSummary } from './cell-traits';
import { REST_CLIP_PEAK, type ClipDeformationPeak } from './shape-terms';
import { RELATION_RING } from '../../hud/format/relations-for';

/** The widest any clip deforms a cell: each clip's peak aimed and unaimed, and the engulf's, taken pointwise. */
function widestClipPeak(): ClipDeformationPeak {
  const clipIds = Object.keys(MOTION_CLIPS) as MotionClipId[];
  const peaks = [
    REST_CLIP_PEAK,
    engulfDeformationPeak(),
    ...clipIds.flatMap((clipId) => [
      clipDeformationPeak(clipId, EATING_CLIP_CONTEXT),
      clipDeformationPeak(clipId, UNAIMED_CLIP_CONTEXT),
    ]),
  ];
  return {
    pulse: Math.max(...peaks.map((peak) => peak.pulse)),
    bumpRadii: Math.max(...peaks.map((peak) => peak.bumpRadii)),
  };
}

/** The widest clip with a starving cell's full wrinkle on top: the one surface term the clips do not carry (#635). */
function widestSurfacePeak(): ClipDeformationPeak {
  const clip = widestClipPeak();
  return { pulse: clip.pulse, bumpRadii: clip.bumpRadii + STARVING_WRINKLE_AMPLITUDE };
}

/** Top speed, sprinting, the widest clip, fully withered: the state no frame of the cell can outgrow. */
export const CULL_DRAW_STATE: CellDrawState = {
  speedRatio: 1,
  isSprinting: true,
  clip: widestSurfacePeak(),
  effectRadii: NO_EFFECT_REACH,
};

/** The widest a cell of these traits is drawn over any frame, in radii (the far dot's halo included). */
export function cullReachRadii(traits: CellTraitSummary): number {
  return Math.max(cellDrawExtentRadii(traits, CULL_DRAW_STATE).drawnRadii, FAR_DOT_HALO_RADII);
}

/**
 * The cull reach in px for a cell of `screenRadiusPx` whose drawing reaches `reachRadii`: the drawing, or the outer
 * edge of the widest ring it could carry (the warning ring's px floor, the toxic ring's outer line), whichever is wider.
 * `reachRadii` measures the tail's centreline, and its round-capped outer stroke reaches half its width further, in px
 * whatever the zoom, so that half is added on top.
 */
export function cullReachPx(reachRadii: number, screenRadiusPx: number): number {
  const warningPx = warningRingRadiusPx(screenRadiusPx) + WARNING_RING_STROKE_PX;
  const relation = relationRingPackingFor(RELATION_RING.toxic, { hasTells: true, screenRadiusPx }, 0);
  const relationPx = relationRingOuterLinePx(relation) + RELATION_RING_STROKE_PX;
  const drawingPx = reachRadii * screenRadiusPx + FLAGELLUM_OUTER_PX * HALF;
  return Math.max(drawingPx, warningPx, relationPx);
}
