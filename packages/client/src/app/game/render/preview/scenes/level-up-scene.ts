// The `level_up` preview scene (docs/architecture/encyclopedia.md §12.7, docs/rendering/contents-and-motion.md §4):
// the subject at rest, one `level_up` effect a loop, and the burst the effect layer draws for it — the anticipate
// dip, the pulse, the rays, the shock ring and the three gold ripples.
//
// **This is the widest scene the preview draws, and not because of the cell.** The outermost ripple is placed at
// `LEVEL_UP_RIPPLE_RADII`'s 2.5 plus the `rippleRadii` track's push, which is past three radii — several times
// the membrane. So the lens here is set by the effect, the body sits well inside the safe band, and that is the
// composition the entry wants: the entry is about the burst.
//
// It is also the only preview that carries a real `level`. Nothing draws it today (the own-cell indicators stand
// down under `NO_HUD_INPUTS`), but the effect itself reports a level and a scene that shipped
// `PREVIEW_UNUSED_LEVEL` inside a `level_up` would be saying the player reached level zero.

import {
  EFFECT_KIND,
  MOTION_CLIP,
  MOTION_CLIPS,
  MILLISECONDS_PER_SECOND,
  TICK_INTERVAL_S,
  entityId,
  type BalanceConfig,
  type GameEffect,
} from '@evolution/shared';
import { UNAIMED_CLIP_CONTEXT, clipDeformationPeak } from '../../cells/cell-clips';
import { effectSpriteReachRadii } from '../../effects/effect-reach';
import { PREVIEW_ACTION_REST_SECONDS, PREVIEW_LEVEL_UP_LEVEL } from '../../constants';
import { previewScene } from '../preview-scene';
import type { PreviewScene, PreviewSceneContent, ScheduledPreviewEffect } from '../preview-scene';
import {
  ACTION_SUBJECT_CELL_ID,
  ACTION_SUBJECT_CENTRE,
  NO_FRAGMENTS,
  NO_MOTES,
  actionSubjectCellView,
  actionSubjectFraming,
} from './action-subject';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';

/** The subject holds still: the burst is the motion, and a swimming cell would compete with it. */
const AT_REST = 0;

const LEVEL_UP_CLIP_PEAK = clipDeformationPeak(MOTION_CLIP.levelUp, UNAIMED_CLIP_CONTEXT);

/** The clip's own length, in seconds: the loop has to outlast the burst or it would restart mid-ripple. */
const BURST_SECONDS = MOTION_CLIPS[MOTION_CLIP.levelUp].duration / MILLISECONDS_PER_SECOND;

/** The burst fires one still beat in, so a reader who arrives mid-loop sees it begin rather than already going. */
const FIRES_AT_SECONDS = PREVIEW_ACTION_REST_SECONDS;

function periodSeconds(): number {
  return FIRES_AT_SECONDS + BURST_SECONDS + PREVIEW_ACTION_REST_SECONDS;
}

export function levelUpPreviewScene(): PreviewScene {
  return previewScene({
    subjectPlayerId: PREVIEW_SUBJECT_PLAYER_ID,
    framing: (balance) =>
      actionSubjectFraming(balance, {
        speedRatio: AT_REST,
        isSprinting: false,
        clip: LEVEL_UP_CLIP_PEAK,
        effectRadii: effectSpriteReachRadii(MOTION_CLIP.levelUp),
      }),
    periodSecondsFor: periodSeconds,
    contentAt: levelUpContent,
    schedule: levelUpSchedule,
  });
}

function levelUpContent(_loopSeconds: number, balance: BalanceConfig): PreviewSceneContent {
  return {
    cells: [actionSubjectCellView({ velocityX: 0, velocityY: 0, level: PREVIEW_LEVEL_UP_LEVEL }, balance)],
    motes: NO_MOTES,
    fragments: NO_FRAGMENTS,
  };
}

function levelUpSchedule(): readonly ScheduledPreviewEffect[] {
  const effect: GameEffect = {
    kind: EFFECT_KIND.levelUp,
    tick: 0,
    x: ACTION_SUBJECT_CENTRE.x,
    y: ACTION_SUBJECT_CENTRE.y,
    cellId: entityId(ACTION_SUBJECT_CELL_ID),
    playerId: PREVIEW_SUBJECT_PLAYER_ID,
    level: PREVIEW_LEVEL_UP_LEVEL,
  };
  return [{ atLoopTick: FIRES_AT_SECONDS / TICK_INTERVAL_S, effect }];
}
