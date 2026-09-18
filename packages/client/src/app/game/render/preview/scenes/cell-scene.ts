// The `cell` preview scene (docs/architecture/encyclopedia.md §12.7): one cell of a kind, owning the traits the
// entry is about, resting or swimming. Nothing else is on screen, so the entry's silhouette, organelles and
// appendages are the whole picture.
//
// The swim is the cell's **own** top speed, not a framing number: the loop's radius is framing (how far from the
// lens centre it circles), and its period is whatever carrying the cell around that circle at
// `maxSpeedForMass(mass, balance.growth)` takes. A speed patch therefore retimes the swim as it plays, and the
// stretch, the flagellum wave and the cilia beat all read the speed ratio the simulation would have given it.

import {
  CELL_KIND,
  RADIANS_PER_FULL_TURN,
  ZONE_ID,
  maxSpeedForMass,
  playerId,
  radiusForMass,
  type BalanceConfig,
  type PlayerId,
} from '@evolution/shared';
import {
  PREVIEW_CELL_MASS,
  PREVIEW_CELL_VIEW_RADII,
  PREVIEW_STILL_PERIOD_SECONDS,
  PREVIEW_SWIM_RADIUS_RADII,
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

function subjectRadiusWu(balance: BalanceConfig): number {
  return radiusForMass(PREVIEW_CELL_MASS, balance.growth);
}

function loopRadiusWu(balance: BalanceConfig): number {
  return subjectRadiusWu(balance) * PREVIEW_SWIM_RADIUS_RADII;
}

/** One trip around the loop at the cell's own top speed: `2πR / maxSpeed`. */
function swimPeriodSeconds(balance: BalanceConfig): number {
  return (RADIANS_PER_FULL_TURN * loopRadiusWu(balance)) / maxSpeedForMass(PREVIEW_CELL_MASS, balance.growth);
}

export function cellPreviewScene(spec: CellPreviewSpec): PreviewScene {
  const isSwimming = spec.motion === PREVIEW_MOTION.swimming;
  return previewScene({
    subjectPlayerId: null,
    framing: (balance) => ({
      target: { ...SUBJECT_CENTRE, radius: subjectRadiusWu(balance) },
      viewRadiusWu: subjectRadiusWu(balance) * PREVIEW_CELL_VIEW_RADII,
    }),
    periodSecondsFor: (balance) => (isSwimming ? swimPeriodSeconds(balance) : PREVIEW_STILL_PERIOD_SECONDS),
    contentAt: (loopSeconds, balance) => subjectContent(spec, loopSeconds, balance, isSwimming),
  });
}

function subjectContent(
  spec: CellPreviewSpec,
  loopSeconds: number,
  balance: BalanceConfig,
  isSwimming: boolean,
): PreviewSceneContent {
  const isPlayerCell = spec.cellKind === CELL_KIND.player;
  const pose = isSwimming ? swimPose(loopSeconds, balance) : REST_POSE;
  return {
    cells: [
      previewCellView(
        {
          id: SUBJECT_CELL_ID,
          kind: spec.cellKind,
          playerId: isPlayerCell ? PREVIEW_SUBJECT_PLAYER_ID : null,
          avatarIndex: SUBJECT_AVATAR_INDEX,
          mass: PREVIEW_CELL_MASS,
          traits: spec.traits,
          x: SUBJECT_CENTRE.x + pose.offsetX,
          y: SUBJECT_CENTRE.y + pose.offsetY,
          velocityX: pose.velocityX,
          velocityY: pose.velocityY,
        },
        balance,
      ),
    ],
    motes: NO_MOTES,
    fragments: NO_FRAGMENTS,
  };
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
  const angle = (RADIANS_PER_FULL_TURN * loopSeconds) / swimPeriodSeconds(balance);
  const radiusWu = loopRadiusWu(balance);
  const speed = maxSpeedForMass(PREVIEW_CELL_MASS, balance.growth);
  return {
    offsetX: Math.cos(angle) * radiusWu,
    offsetY: Math.sin(angle) * radiusWu,
    // The tangent of the loop, at the speed the loop is walked: exactly what the pose's own derivative is.
    velocityX: -Math.sin(angle) * speed,
    velocityY: Math.cos(angle) * speed,
  };
}
