// What the preview's open and frame cost is measured and judged against (docs/architecture/encyclopedia.md §12.7,
// docs/rendering/budget.md §7): the walk arithmetic the evidence route steps its `ManualClock` by, the p95 over a
// page's warm opens, and the verdict against the two budgets.
//
// It lives under `render/` rather than beside the route because it reads simulation constants, and
// `encyclopedia/` reads its numbers from the live balance it is handed, never from a module import (§12.6).

import { MILLISECONDS_PER_SECOND, P95_QUANTILE, TICK_INTERVAL_S } from '@evolution/shared';
import { quantileOf } from '../bench/render-stage-timer';
import { isClockFineEnoughFor } from '../bench/timer-resolution';
import { PREVIEW_FRAME_BUDGET_MS, PREVIEW_OPEN_BUDGET_MS } from '../constants';

/** `openedToFirstFrameMs` split, so a miss over `PREVIEW_OPEN_BUDGET_MS` points at its lever (§12.7's cost table). */
export interface PreviewOpenTimings {
  /** `createPixiApp` alone: the WebGL2 context and Pixi's init, every program compiled again on a new context. */
  readonly initMs: number;
  /** `createRenderTextures` alone: the whole bundle, paid once per session. Nothing else is inside this span. */
  readonly bakeMs: number;
  /** The first instrumented frame alone: texture uploads and shader compiles. */
  readonly firstSubmitMs: number;
  /**
   * The whole open. The three spans above do **not** sum to it: adopting the ticker and building the scene fall
   * between them, deliberately outside all three so each keeps its name. The residual is small next to the bake.
   *
   * It is **submit-side**: the frame ends at `app.render()`, which returns once the GL commands are queued, not
   * once the frame is presented. On a real GPU those differ, so a hardware run understates the open a little.
   */
  readonly openedToFirstFrameMs: number;
}

/** One walk frame: exactly one simulation tick, so the walk visits the ticks a live preview would have. */
export const PREVIEW_WALK_STEP_MS = TICK_INTERVAL_S * MILLISECONDS_PER_SECOND;

/** How many walk frames reach `parkAtSeconds`: every tick from the loop's start up to it, the parked one apart. */
export function previewWalkFrameCount(parkAtSeconds: number): number {
  return Math.max(0, Math.floor(parkAtSeconds / TICK_INTERVAL_S));
}

/** The two budgets §12.7's cost table owns, as the evidence report carries them. */
export const PREVIEW_BUDGETS = { openMs: PREVIEW_OPEN_BUDGET_MS, frameMs: PREVIEW_FRAME_BUDGET_MS } as const;

/**
 * What `PREVIEW_FRAME_BUDGET_MS` judges (ticket #502): the parked lens's own work per frame, its frame bracket minus
 * its submit, at p95. The whole frame is not the measure: on a real GPU the submit waits on the queue and tracks the
 * refresh interval (#470's run: 7.15 ms p95 at 183 fps), so a 1 ms budget on it could never pass.
 */
export interface PreviewFrameWork {
  readonly workOutsideSubmitP95Ms: number;
  /** The page clock's step (bench/timer-resolution.ts); `null` when it was not measured. */
  readonly timerResolutionMs: number | null;
}

export interface PreviewBudgetVerdict {
  /** `null` when the page ran only its cold open, which is never judged against the p95 budget. */
  readonly isOpenWithinBudget: boolean | null;
  /** `null` when no frame sample could support a p95, or the page's clock is too coarse for a 1 ms budget. */
  readonly isFrameWithinBudget: boolean | null;
}

/** The p95 of the warm opens, or `null` when the page ran only the cold one (`opens=1`). */
export function previewOpenP95Ms(warmOpens: readonly PreviewOpenTimings[]): number | null {
  if (warmOpens.length === 0) return null;
  return quantileOf(
    warmOpens.map((open) => open.openedToFirstFrameMs),
    P95_QUANTILE,
  );
}

/** Whether the frame row can be judged: a finite p95 read off a clock fine enough for the budget. */
export function isPreviewFrameJudgeable(frameWork: PreviewFrameWork): boolean {
  return (
    Number.isFinite(frameWork.workOutsideSubmitP95Ms) &&
    isClockFineEnoughFor(PREVIEW_FRAME_BUDGET_MS, frameWork.timerResolutionMs)
  );
}

/** Each row `null` where the evidence cannot support one. Never judged in the container: SwiftShader is not the GPU. */
export function previewBudgetVerdict(openP95Ms: number | null, frameWork: PreviewFrameWork): PreviewBudgetVerdict {
  return {
    isOpenWithinBudget: openP95Ms === null ? null : openP95Ms <= PREVIEW_OPEN_BUDGET_MS,
    isFrameWithinBudget: isPreviewFrameJudgeable(frameWork)
      ? frameWork.workOutsideSubmitP95Ms <= PREVIEW_FRAME_BUDGET_MS
      : null,
  };
}
