// What the three single-cell action scenes share (docs/architecture/encyclopedia.md §12.7, ticket #364): one
// player cell held at the lens centre, **followed as `ownPlayerId`** so the sprint ring and the warning ring
// draw, and a lens framed from whatever that cell is doing this scene.
//
// The subject is a player cell of one fixed trait set rather than the entry's own traits: these entries are about
// the **action**, not the creature, and a reader comparing `eat` with `sprint` should see the same cell doing two
// different things. It carries a flagellum so the speed stretch and the tail read as motion rather than as a
// wobble.

import {
  BACTERIUM_VARIANTS,
  CELL_KIND,
  DNA_TAGS,
  PLAYER_LIFE_STATE,
  ZONE_ID,
  maxSpeedForMass,
  radiusForMass,
  zeroRecord,
  type BalanceConfig,
  type CellView,
  type OwnProgressView,
} from '@evolution/shared';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../../state/own-cell-indicators';
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
import type { PreviewFraming, PreviewSceneContent } from '../preview-scene';
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

/** The action subject threatens nobody and is threatened by nobody: it is alone on its lens. */
const NO_THREATS = [] as const;
const NO_PREVIEWED_TRAIT = null;
const NOTHING_COUNTED = 0;
const ACTION_SUBJECT_NAME = 'You';

/**
 * The HUD's own-cell record for the subject this frame, built by the HUD's own `ownCellIndicatorsFor` so the ring
 * reads exactly what it reads in play: `sprintFill` from the view's `sprintCooldownRemainingTicks` against the
 * live `SPRINT_COOLDOWN_SECONDS`, `isSprinting` from `sprintRemainingTicks`. Without this the renderer's
 * `OwnCellRingTracker` gets no source and answers `REST_OWN_CELL_RING` — a full ring every frame, whatever the
 * view's clocks say (PR #500 review). `null` when the subject is not in the frame.
 */
export function actionSubjectOwnCellIndicators(
  content: PreviewSceneContent,
  balance: BalanceConfig,
): OwnCellIndicators | null {
  const ownCell = content.cells.find((cell) => cell.playerId === PREVIEW_SUBJECT_PLAYER_ID);
  if (ownCell === undefined) return null;
  return ownCellIndicatorsFor({
    ownCell,
    ownProgress: actionSubjectProgress(ownCell),
    balance,
    threats: NO_THREATS,
    previewTraitId: NO_PREVIEWED_TRAIT,
  });
}

/** The subject's progress as the record needs it: its own level, traits and stage, and nothing yet counted. */
function actionSubjectProgress(ownCell: CellView): OwnProgressView {
  return {
    playerId: PREVIEW_SUBJECT_PLAYER_ID,
    playerName: ACTION_SUBJECT_NAME,
    level: ownCell.level,
    dnaCumulative: NOTHING_COUNTED,
    dnaCatchUpGift: NOTHING_COUNTED,
    dnaTowardNextLevel: NOTHING_COUNTED,
    dnaTagPoints: zeroRecord(DNA_TAGS),
    bacteriaEatenByVariant: zeroRecord(BACTERIUM_VARIANTS),
    absorptions: NOTHING_COUNTED,
    wildAbsorptions: NOTHING_COUNTED,
    score: NOTHING_COUNTED,
    ownedTraits: ownCell.traits.map((owned) => ({ ...owned })),
    stage: ownCell.stage,
    offer: null,
    lifeState: PLAYER_LIFE_STATE.alive,
    spectatingCellId: null,
    respawnInTicks: NOTHING_COUNTED,
    massFlow: null,
  };
}
