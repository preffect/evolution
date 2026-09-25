// The `cell` preview scene (docs/architecture/encyclopedia.md §12.7): one cell of a kind, owning the traits the
// entry is about, resting or swimming. Nothing else is on screen, so the entry's silhouette, organelles and
// appendages are the whole picture.
//
// The lens is **derived from the subject**, not a constant: `subjectViewRadiusWu` frames it from this cell's own
// widest body and widest drawn extent, so a bare protocell and a tier-III flagellate each fill the lens instead of
// sharing one number sized for the longer tail (ticket #364, `render/constants/preview.ts`).
//
// The swim is a lap time, not a speed: the loop's radius is framing (how far from the lens centre it circles), and
// the cell walks it in `PREVIEW_SWIM_LAP_SECONDS`, the tempo the human chose. The stretch, the flagellum wave and the
// cilia beat read that speed against `balance.growth.CELL_BASE_SPEED` (every mass's top speed, #677), the ratio the
// simulation would have given it, so a speed patch changes how the swim looks and not how long it takes.

import {
  CELL_KIND,
  RADIANS_PER_FULL_TURN,
  ZONE_ID,
  playerId,
  radiusForMass,
  type BalanceConfig,
  type CellView,
  type PlayerId,
} from '@evolution/shared';
import { cellDrawExtentRadii, restingDrawState } from '../../cells/cell-draw-extent';
import { summariseCellTraits } from '../../cells/cell-traits';
import {
  PREVIEW_CELL_BODY_FILL_FRACTION,
  PREVIEW_CELL_DRAWN_FILL_FRACTION,
  PREVIEW_CELL_MASS,
  PREVIEW_STILL_PERIOD_SECONDS,
  PREVIEW_SWIM_RADIUS_RADII,
  PREVIEW_SWIM_LAP_SECONDS,
  PREVIEW_ZONE_CENTRE_WU,
} from '../../constants';
import { previewCellView } from '../preview-frame';
import { previewScene, type PreviewScene, type PreviewSceneContent } from '../preview-scene';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../preview-spec';

/** The player id a `player`-kind preview cell carries; no scene makes it the camera's `ownPlayerId` (#363). */
export const PREVIEW_SUBJECT_PLAYER_ID: PlayerId = playerId('preview-subject');

const SUBJECT_CELL_ID = 'preview-cell';
/** The first palette: one cell on its own has nothing to be separable from. */
const SUBJECT_AVATAR_INDEX = 0;

/** A cell preview sits in the open broth: a plain backdrop, rather than the vent's crust at the dish centre. */
const SUBJECT_CENTRE = PREVIEW_ZONE_CENTRE_WU[ZONE_ID.openBroth];

type CellPreviewSpec = Extract<PreviewSpec, { scene: typeof PREVIEW_SCENE.cell }>;

const NO_MOTES = [] as const;
const NO_FRAGMENTS = [] as const;

const RESTING_SPEED_RATIO = 0;

function subjectRadiusWu(balance: BalanceConfig): number {
  return radiusForMass(PREVIEW_CELL_MASS, balance.growth);
}

function loopRadiusWu(balance: BalanceConfig): number {
  return subjectRadiusWu(balance) * PREVIEW_SWIM_RADIUS_RADII;
}

/** The speed that walks the loop in `PREVIEW_SWIM_LAP_SECONDS`: `2πR / lap`. */
function swimSpeed(balance: BalanceConfig): number {
  return (RADIANS_PER_FULL_TURN * loopRadiusWu(balance)) / PREVIEW_SWIM_LAP_SECONDS;
}

/** The swim speed's share of the top speed, so the stretch, tail and cilia read as they would in play. */
export function previewSwimSpeedRatio(balance: BalanceConfig): number {
  return swimSpeed(balance) / balance.growth.CELL_BASE_SPEED;
}

export function cellPreviewScene(spec: CellPreviewSpec): PreviewScene {
  const isSwimming = spec.motion === PREVIEW_MOTION.swimming;
  return previewScene({
    subjectPlayerId: null,
    framing: (balance) => ({
      target: { ...SUBJECT_CENTRE, radius: subjectRadiusWu(balance) },
      viewRadiusWu: subjectViewRadiusWu(spec, balance, isSwimming),
    }),
    periodSecondsFor: () => (isSwimming ? PREVIEW_SWIM_LAP_SECONDS : PREVIEW_STILL_PERIOD_SECONDS),
    contentAt: (loopSeconds, balance) => subjectContent(spec, loopSeconds, balance, isSwimming),
  });
}

/**
 * The tightest lens that holds **this** subject in both bands: the loop offset it circles at, plus its own widest
 * body inside `PREVIEW_CELL_BODY_FILL_FRACTION` and its own widest drawn extent inside
 * `PREVIEW_CELL_DRAWN_FILL_FRACTION`, whichever of the two needs more room.
 *
 * Derived rather than tuned, because no one number serves the family: the tail a tier-III flagellate needs room
 * for is about 2.5 radii that a bare protocell does not have, and framing every cell for the flagellate is what
 * left a protocell at a quarter of the lens (`render/constants/preview.ts`).
 *
 * `cellDrawExtentRadii` is a **bound** — the peak of every term `maxReachRadii` samples — so the band the lens is
 * framed to is the band every frame of the loop then satisfies, and the zoom never breathes with the membrane. It
 * is recomputed per frame because the stage a trait set lands on is the live balance's (`stageOf`), and a
 * protocell halos and wobbles differently from a form; the work is one trait summary for one cell.
 */
function subjectViewRadiusWu(spec: CellPreviewSpec, balance: BalanceConfig, isSwimming: boolean): number {
  const extent = cellDrawExtentRadii(
    summariseCellTraits(subjectCellView(spec, REST_POSE, balance)),
    restingDrawState(isSwimming ? previewSwimSpeedRatio(balance) : RESTING_SPEED_RATIO),
  );
  const offsetRadii = isSwimming ? PREVIEW_SWIM_RADIUS_RADII : 0;
  return (
    subjectRadiusWu(balance) *
    Math.max(
      (offsetRadii + extent.bodyRadii) / PREVIEW_CELL_BODY_FILL_FRACTION,
      (offsetRadii + extent.drawnRadii) / PREVIEW_CELL_DRAWN_FILL_FRACTION,
    )
  );
}

function subjectCellView(spec: CellPreviewSpec, pose: SubjectPose, balance: BalanceConfig): CellView {
  return previewCellView(
    {
      id: SUBJECT_CELL_ID,
      kind: spec.cellKind,
      playerId: spec.cellKind === CELL_KIND.player ? PREVIEW_SUBJECT_PLAYER_ID : null,
      avatarIndex: SUBJECT_AVATAR_INDEX,
      mass: PREVIEW_CELL_MASS,
      traits: spec.traits,
      x: SUBJECT_CENTRE.x + pose.offsetX,
      y: SUBJECT_CENTRE.y + pose.offsetY,
      velocityX: pose.velocityX,
      velocityY: pose.velocityY,
    },
    balance,
  );
}

function subjectContent(
  spec: CellPreviewSpec,
  loopSeconds: number,
  balance: BalanceConfig,
  isSwimming: boolean,
): PreviewSceneContent {
  const pose = isSwimming ? swimPose(loopSeconds, balance) : REST_POSE;
  return { cells: [subjectCellView(spec, pose, balance)], motes: NO_MOTES, fragments: NO_FRAGMENTS };
}

interface SubjectPose {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly velocityX: number;
  readonly velocityY: number;
}

/** At rest the cell holds the lens centre and its velocity is zero, so `speedRatio` is 0 and the heading holds. */
const REST_POSE: SubjectPose = { offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0 };

function swimPose(loopSeconds: number, balance: BalanceConfig): SubjectPose {
  const angle = (RADIANS_PER_FULL_TURN * loopSeconds) / PREVIEW_SWIM_LAP_SECONDS;
  const radiusWu = loopRadiusWu(balance);
  const speed = swimSpeed(balance);
  return {
    offsetX: Math.cos(angle) * radiusWu,
    offsetY: Math.sin(angle) * radiusWu,
    // The tangent of the loop, at the speed the loop is walked: exactly what the pose's own derivative is.
    velocityX: -Math.sin(angle) * speed,
    velocityY: Math.cos(angle) * speed,
  };
}
