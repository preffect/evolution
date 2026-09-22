// The `sprint` preview scene (docs/architecture/encyclopedia.md §12.7, docs/rendering/own-cell-indicators.md §10):
// the subject sprints, then recharges, and the self ring on its membrane empties and fills again.
//
// **Its whole pace is the live balance's**, never a preview number: the sprint runs for
// `SPRINT_DURATION_SECONDS` and recharges over `SPRINT_COOLDOWN_SECONDS`, both read per frame, so patching either
// through `debug_set_balance` retimes the loop as it plays. The ring is drawn only because the scene names the
// subject as `ownPlayerId` — the own-cell indicators draw for that player and nobody else.
//
// It emits **no effects**. `sprint_ready` is a motion clip the own-cell ring starts when the fill reaches full
// (`own-cell-ring.ts`), not a `GameEffect`, so there is nothing for a schedule to carry.
//
// **The ring is driven through the HUD's own-cell record, not through the view's clocks alone.** The renderer's
// `OwnCellRingTracker` reads `RenderInputs.ownCellIndicators.sprintFill`; the view's `sprintCooldownRemainingTicks`
// reaches it only through `ownCellIndicatorsFor`. A scene that set the clocks and supplied no record showed a full
// ring every frame (PR #500 review), so this one supplies the record and `action-scenes.spec.ts` reads the *ring*.

import { MOTION_CLIP, TICK_INTERVAL_S, type BalanceConfig } from '@evolution/shared';
import { REST_CLIP_PEAK } from '../../cells/shape-terms';
import { UNAIMED_CLIP_CONTEXT, clipDeformationPeak } from '../../cells/cell-clips';
import { PREVIEW_ACTION_SUBJECT_LEVEL } from '../../constants';
import { previewScene, type PreviewScene, type PreviewSceneContent } from '../preview-scene';
import {
  actionSubjectCellView,
  actionSubjectFraming,
  actionSubjectMaxSpeed,
  actionSubjectOwnCellIndicators,
} from './action-subject';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';

const NO_MOTES = [] as const;
const NO_FRAGMENTS = [] as const;
const SPRINTING = 1;
const NO_TICKS_LEFT = 0;

/**
 * The widest the sprint makes the cell: the axial stretch and the doubled tail wave come from `isSprinting`, and
 * `sprintRelease` — the clip that plays as the sprint ends — adds its own stretch on top of them.
 */
const SPRINT_RELEASE_PEAK = clipDeformationPeak(MOTION_CLIP.sprintRelease, UNAIMED_CLIP_CONTEXT);

/** One loop: the sprint itself, then the full recharge, both from the live balance. */
function periodSeconds(balance: BalanceConfig): number {
  return balance.controls.SPRINT_DURATION_SECONDS + balance.controls.SPRINT_COOLDOWN_SECONDS;
}

/** Ticks left of the sprint at `loopSeconds`; 0 once it has ended. */
function sprintRemainingTicks(loopSeconds: number, balance: BalanceConfig): number {
  const left = balance.controls.SPRINT_DURATION_SECONDS - loopSeconds;
  return left > 0 ? left / TICK_INTERVAL_S : NO_TICKS_LEFT;
}

/**
 * Ticks left of the cooldown. It starts full the instant the sprint ends and empties over the cooldown, which is
 * what drives the ring's fill (`sprintFillFor`); it is 0 while the sprint is still running, because a sprint in
 * progress shows a full ring rather than a recharging one.
 */
function sprintCooldownRemainingTicks(loopSeconds: number, balance: BalanceConfig): number {
  if (loopSeconds < balance.controls.SPRINT_DURATION_SECONDS) return NO_TICKS_LEFT;
  const left = periodSeconds(balance) - loopSeconds;
  return left > 0 ? left / TICK_INTERVAL_S : NO_TICKS_LEFT;
}

export function sprintPreviewScene(): PreviewScene {
  return previewScene({
    subjectPlayerId: PREVIEW_SUBJECT_PLAYER_ID,
    // Framed for the sprinting half, which is the wider of the two: the lens must not resize mid-loop.
    framing: (balance) =>
      actionSubjectFraming(balance, {
        speedRatio: SPRINTING,
        isSprinting: true,
        clip: widerOf(SPRINT_RELEASE_PEAK, REST_CLIP_PEAK),
        effectRadii: NO_EFFECTS_DRAWN,
      }),
    periodSecondsFor: periodSeconds,
    contentAt: sprintContent,
    ownCellIndicators: actionSubjectOwnCellIndicators,
  });
}

/** Nothing in this scene emits an effect, so no effect sprite is ever drawn. */
const NO_EFFECTS_DRAWN = 0;

function widerOf(first: typeof REST_CLIP_PEAK, second: typeof REST_CLIP_PEAK): typeof REST_CLIP_PEAK {
  return {
    pulse: Math.max(first.pulse, second.pulse),
    bumpRadii: Math.max(first.bumpRadii, second.bumpRadii),
  };
}

/**
 * The subject swims at its top speed throughout. It does **not** move faster during the sprint half: the camera
 * follows it, so a higher speed would show as nothing but a longer stretch, and the speed ratio the renderer
 * reads is already capped at 1. What changes across the loop is the ring and the sprint's own stretch.
 */
function sprintContent(loopSeconds: number, balance: BalanceConfig): PreviewSceneContent {
  return {
    cells: [
      actionSubjectCellView(
        {
          velocityX: actionSubjectMaxSpeed(balance),
          velocityY: 0,
          sprintRemainingTicks: sprintRemainingTicks(loopSeconds, balance),
          sprintCooldownRemainingTicks: sprintCooldownRemainingTicks(loopSeconds, balance),
          // The record draws the ladder's level pip beside the ring, so the subject wears a real level here.
          level: PREVIEW_ACTION_SUBJECT_LEVEL,
        },
        balance,
      ),
    ],
    motes: NO_MOTES,
    fragments: NO_FRAGMENTS,
  };
}
