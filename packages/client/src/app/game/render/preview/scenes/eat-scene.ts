// The `eat` preview scene (docs/architecture/encyclopedia.md §12.7, docs/rendering/contents-and-motion.md §4): a
// cell swimming, a mote drifting in to meet it, and the `eat` effect at the moment it arrives — the dimple and
// wrap at the mote, the pulse, and the halo ring the effect layer draws.
//
// **The mote is removed by the same tick the effect is emitted at**, not a frame either side. That is the
// contract the renderer reads: `cellClipStarts` aims the eat clip at the effect's position, so a mote still on
// screen after its own eat would be a second mote, and a mote gone before it would leave the clip aiming at
// nothing. `eat-scene.spec.ts` pins the two together.

import {
  EFFECT_KIND,
  ENTITY_KIND,
  FOOD_KIND,
  MOTION_CLIP,
  RADIANS_PER_FULL_TURN,
  TICK_INTERVAL_S,
  entityId,
  type BalanceConfig,
  type FoodMoteView,
  type GameEffect,
} from '@evolution/shared';
import { EATING_CLIP_CONTEXT, clipDeformationPeak } from '../../cells/cell-clips';
import { effectSpriteReachRadii } from '../../effects/effect-reach';
import {
  PREVIEW_ACTION_REST_SECONDS,
  PREVIEW_EAT_APPROACH_RADII,
  PREVIEW_EAT_APPROACH_SECONDS,
  PREVIEW_EAT_APPROACH_TURNS,
  PREVIEW_EAT_DNA_GAINED,
  PREVIEW_EAT_MASS_GAINED,
} from '../../constants';
import {
  previewScene,
  type PreviewScene,
  type PreviewSceneContent,
  type ScheduledPreviewEffect,
} from '../preview-scene';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';
import {
  ACTION_SUBJECT_CELL_ID,
  ACTION_SUBJECT_CENTRE,
  actionSubjectCellView,
  actionSubjectFraming,
  actionSubjectMaxSpeed,
  actionSubjectRadiusWu,
} from './action-subject';

const MOTE_ID = 'preview-eat-mote';
const NO_FRAGMENTS = [] as const;
const NO_MOTES = [] as const;

/** The mote comes in on this heading; the subject swims to meet it, so its stretch points the same way. */
const APPROACH_ANGLE = PREVIEW_EAT_APPROACH_TURNS * RADIANS_PER_FULL_TURN;

/** The eat clip's own deformation and its halo sprite: what the lens has to hold while the clip plays. */
const EAT_CLIP_PEAK = clipDeformationPeak(MOTION_CLIP.eat, EATING_CLIP_CONTEXT);

/** The mote arrives, and is eaten, at this tick of the loop. */
function eatAtTick(): number {
  return PREVIEW_EAT_APPROACH_SECONDS / TICK_INTERVAL_S;
}

/** The loop: the mote drifts in, the eat fires, then a still beat before it all begins again. */
function periodSeconds(): number {
  return PREVIEW_EAT_APPROACH_SECONDS + PREVIEW_ACTION_REST_SECONDS;
}

/** Where the mote is at `loopSeconds`: on the approach line, closing on the subject; `null` once eaten. */
function motePosition(loopSeconds: number, balance: BalanceConfig): { readonly x: number; readonly y: number } | null {
  if (loopSeconds > PREVIEW_EAT_APPROACH_SECONDS) return null;
  const share = loopSeconds / PREVIEW_EAT_APPROACH_SECONDS;
  const distanceWu = PREVIEW_EAT_APPROACH_RADII * actionSubjectRadiusWu(balance) * (1 - share);
  return {
    x: ACTION_SUBJECT_CENTRE.x + Math.cos(APPROACH_ANGLE) * distanceWu,
    y: ACTION_SUBJECT_CENTRE.y + Math.sin(APPROACH_ANGLE) * distanceWu,
  };
}

/** The mote's resting place at the instant it is eaten: the subject's own centre, which is where it arrives. */
const EATEN_AT = ACTION_SUBJECT_CENTRE;

export function eatPreviewScene(): PreviewScene {
  return previewScene({
    subjectPlayerId: PREVIEW_SUBJECT_PLAYER_ID,
    framing: (balance) =>
      actionSubjectFraming(balance, {
        speedRatio: SWIMMING,
        isSprinting: false,
        clip: EAT_CLIP_PEAK,
        effectRadii: effectSpriteReachRadii(MOTION_CLIP.eat),
      }),
    periodSecondsFor: periodSeconds,
    contentAt: eatContent,
    schedule: eatSchedule,
  });
}

/** The subject swims toward the mote the whole loop, so the stretch and the tail read through the eat. */
const SWIMMING = 1;

function eatContent(loopSeconds: number, balance: BalanceConfig): PreviewSceneContent {
  const speed = actionSubjectMaxSpeed(balance);
  const mote = motePosition(loopSeconds, balance);
  return {
    cells: [
      actionSubjectCellView(
        { velocityX: Math.cos(APPROACH_ANGLE) * speed, velocityY: Math.sin(APPROACH_ANGLE) * speed },
        balance,
      ),
    ],
    motes: mote === null ? NO_MOTES : [moteView(mote)],
    fragments: NO_FRAGMENTS,
  };
}

function moteView(position: { readonly x: number; readonly y: number }): FoodMoteView {
  return { id: entityId(MOTE_ID), kind: FOOD_KIND.algae, bacteriumVariant: null, x: position.x, y: position.y };
}

function eatSchedule(): readonly ScheduledPreviewEffect[] {
  const effect: GameEffect = {
    kind: EFFECT_KIND.eat,
    tick: 0,
    x: EATEN_AT.x,
    y: EATEN_AT.y,
    cellId: entityId(ACTION_SUBJECT_CELL_ID),
    eatenId: entityId(MOTE_ID),
    eatenKind: ENTITY_KIND.foodMote,
    massGained: PREVIEW_EAT_MASS_GAINED,
    dnaGained: PREVIEW_EAT_DNA_GAINED,
  };
  return [{ atLoopTick: eatAtTick(), effect }];
}
