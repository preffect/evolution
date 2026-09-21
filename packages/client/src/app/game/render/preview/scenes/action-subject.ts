// What the three single-cell action scenes share (docs/architecture/encyclopedia.md §12.7, ticket #364): one
// player cell held at the lens centre, **followed as `ownPlayerId`** so the sprint ring and the warning ring
// draw, and a lens framed from whatever that cell is doing this scene.
//
// The subject is a player cell of one fixed trait set rather than the entry's own traits: these entries are about
// the **action**, not the creature, and a reader comparing `eat` with `sprint` should see the same cell doing two
// different things. It carries a flagellum so the speed stretch and the tail read as motion rather than as a
// wobble.

import {
  CELL_KIND,
  ZONE_ID,
  maxSpeedForMass,
  radiusForMass,
  type BalanceConfig,
  type CellView,
} from '@evolution/shared';
import { cellDrawExtentRadii, type CellDrawState } from '../../cells/cell-draw-extent';
import { summariseCellTraits } from '../../cells/cell-traits';
import {
  PREVIEW_ACTION_SUBJECT_TRAITS,
  PREVIEW_CELL_BODY_FILL_FRACTION,
  PREVIEW_CELL_DRAWN_FILL_FRACTION,
  PREVIEW_CELL_MASS,
  PREVIEW_ZONE_CENTRE_WU,
} from '../../constants';
import { previewCellView } from '../preview-frame';
import type { PreviewFraming } from '../preview-scene';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';

/** The action scenes' cell id; distinct from the `cell` family's, so the two never share a cosmetic fork. */
export const ACTION_SUBJECT_CELL_ID = 'preview-action-cell';

/** The first palette: the subject is alone in `eat`, `sprint` and `level_up`. */
const ACTION_SUBJECT_AVATAR_INDEX = 0;

/** The action scenes play in the open broth, the same plain backdrop the `cell` family uses. */
export const ACTION_SUBJECT_CENTRE = PREVIEW_ZONE_CENTRE_WU[ZONE_ID.openBroth];

/** The subject's radius at the preview mass, from the live balance. */
export function actionSubjectRadiusWu(balance: BalanceConfig): number {
  return radiusForMass(PREVIEW_CELL_MASS, balance.growth);
}

/** The subject's own top speed: what a swimming pose is built at, so the stretch reads as it does in play. */
export function actionSubjectMaxSpeed(balance: BalanceConfig): number {
  return maxSpeedForMass(PREVIEW_CELL_MASS, balance.growth);
}

/** What the subject is doing this frame; everything not named here is at rest. */
export interface ActionSubjectPose {
  readonly velocityX: number;
  readonly velocityY: number;
  readonly sprintRemainingTicks?: number;
  readonly sprintCooldownRemainingTicks?: number;
  /** Only `level_up` draws one; every other scene leaves it at `PREVIEW_UNUSED_LEVEL`. */
  readonly level?: number;
}

/** The subject cell at `pose`, parked on the lens centre — the camera follows it, so it never has to travel. */
export function actionSubjectCellView(pose: ActionSubjectPose, balance: BalanceConfig): CellView {
  return previewCellView(
    {
      id: ACTION_SUBJECT_CELL_ID,
      kind: CELL_KIND.player,
      playerId: PREVIEW_SUBJECT_PLAYER_ID,
      avatarIndex: ACTION_SUBJECT_AVATAR_INDEX,
      mass: PREVIEW_CELL_MASS,
      traits: PREVIEW_ACTION_SUBJECT_TRAITS,
      x: ACTION_SUBJECT_CENTRE.x,
      y: ACTION_SUBJECT_CENTRE.y,
      ...pose,
    },
    balance,
  );
}

/**
 * The lens for an action scene: the same rule the `cell` family uses — whichever band binds is filled — but over
 * a `CellDrawState` that includes what the scene's clips do, because an eat pulses the membrane past its resting
 * width and a level-up's outermost ripple is drawn at more than three radii.
 *
 * The subject holds the lens centre, so unlike the `cell` family there is no loop offset to leave room for.
 */
export function actionSubjectFraming(balance: BalanceConfig, state: CellDrawState): PreviewFraming {
  const radiusWu = actionSubjectRadiusWu(balance);
  const extent = cellDrawExtentRadii(actionSubjectTraits(balance), state);
  return {
    target: { ...ACTION_SUBJECT_CENTRE, radius: radiusWu },
    viewRadiusWu:
      radiusWu *
      Math.max(
        extent.bodyRadii / PREVIEW_CELL_BODY_FILL_FRACTION,
        extent.drawnRadii / PREVIEW_CELL_DRAWN_FILL_FRACTION,
      ),
  };
}

/** The subject's trait summary; the stage its traits land on is the live balance's, so this is read per frame. */
function actionSubjectTraits(balance: BalanceConfig) {
  return summariseCellTraits(actionSubjectCellView(AT_REST, balance));
}

const AT_REST: ActionSubjectPose = { velocityX: 0, velocityY: 0 };
