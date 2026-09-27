// The states the traced-ring specs walk (#730): every tier resting, swimming flat out and engulfing (the prey under the
// body, or held out on an arm, #753), on a 40 wu cell
// (the amoeba, the paramecium or a round blob) with the warning ring at its 1.3 r. One place, so the clearance and the dash specs judge the same frames.

import {
  AMOEBA_ARM_GRAB_REACH_RADII,
  CELL_STAGE,
  MOTION_CLIPS,
  createSeededRandom,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { createTestCellView } from './builders';
import { ENGULF_WARNING_RING_RADII } from '../app/game/render/constants';
import { buildNoiseStrip } from '../app/game/render/noise/noise-strip';
import { REST_CLIP_INPUT, clipDeformation } from '../app/game/render/cells/cell-clips';
import { REST_DEFORMATION, type CellDeformation } from '../app/game/render/cells/cell-deformation';
import { summariseCellTraits } from '../app/game/render/cells/cell-traits';
import { buildShapeTerms, type ShapeTerms } from '../app/game/render/cells/shape-terms';

export const AMOEBA_RING_RADIUS = 40;
export const AMOEBA_RING_WU = ENGULF_WARNING_RING_RADII * AMOEBA_RING_RADIUS;
export const AMOEBA_TIERS: readonly TraitTier[] = [1, 2, 3];
const REST_TIMES = [0, 1.4, 2.8];

export interface AmoebaState {
  readonly timeSeconds: number;
  readonly speedRatio: number;
  readonly deformation: CellDeformation;
}

/** A 40 wu cell of the stage-five form `formTraitId` at `tier` (none: a round blob), in `state`. */
export function formTerms(formTraitId: TraitId | null, tier: TraitTier, state: AmoebaState): ShapeTerms {
  const view = createTestCellView({
    radius: AMOEBA_RING_RADIUS,
    stage: CELL_STAGE.specialised,
    traits: formTraitId === null ? [] : [{ traitId: formTraitId, tier }],
  });
  return buildShapeTerms({
    view,
    traits: summariseCellTraits(view),
    heading: 0.4,
    phase: 0.3,
    stripRow: 0,
    strip: buildNoiseStrip(createSeededRandom(42)),
    wither: 0,
    ...state,
  });
}

export function amoebaTerms(tier: TraitTier, state: AmoebaState): ShapeTerms {
  return formTerms('amoeba_pseudopods', tier, state);
}

const ENGULF_POSITIONS = [0.25, 0.5, 0.75].map((share) => share * MOTION_CLIPS.engulf.duration);

function engulfing(position: number, armHoldRadii = 0): CellDeformation {
  return clipDeformation({ ...REST_CLIP_INPUT, preyAngle: -1.1, engulfClipPosition: position, armHoldRadii });
}

/** A prey held at the arm's full grab reach, and halfway drawn in (#753). */
const ARM_HOLDS = [AMOEBA_ARM_GRAB_REACH_RADII, AMOEBA_ARM_GRAB_REACH_RADII / 2];
const HOLD_POSITION = ENGULF_POSITIONS[0] ?? 0;

export const AMOEBA_STATES: readonly { readonly name: string; readonly state: AmoebaState }[] = [
  ...REST_TIMES.map((timeSeconds) => ({
    name: `resting at ${timeSeconds} s`,
    state: { timeSeconds, speedRatio: 0, deformation: REST_DEFORMATION },
  })),
  ...REST_TIMES.map((timeSeconds) => ({
    name: `swimming at ${timeSeconds} s`,
    state: { timeSeconds, speedRatio: 1, deformation: REST_DEFORMATION },
  })),
  ...ENGULF_POSITIONS.map((position) => ({
    name: `engulfing at clip ${position}`,
    state: { timeSeconds: 1.1, speedRatio: 0.3, deformation: engulfing(position) },
  })),
  ...ARM_HOLDS.map((armHoldRadii) => ({
    name: `engulfing, the prey held ${armHoldRadii} r out`,
    state: { timeSeconds: 1.1, speedRatio: 0.3, deformation: engulfing(HOLD_POSITION, armHoldRadii) },
  })),
];
