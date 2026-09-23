// Reconciliation of the own cell (docs/architecture/client.md §5, #265): when a snapshot moves the prediction, the
// gap between what was on screen and the new prediction is blended out over `RECONCILE_BLEND_SECONDS`, or dropped
// at once when it reaches `RECONCILE_SNAP_DISTANCE_WU`. Only the drawn position carries the correction; the
// prediction itself, and the steer target built on it, always use the uncorrected pose.

import {
  MILLISECONDS_PER_SECOND,
  RECONCILE_BLEND_SECONDS,
  RECONCILE_SNAP_DISTANCE_WU,
  distanceBetween,
  type Vec2,
} from '@evolution/shared';

const NO_OFFSET: Vec2 = { x: 0, y: 0 };

export class PoseCorrection {
  private offset: Vec2 = NO_OFFSET;
  private startedAtMs = 0;

  /** The share of the offset still applied at `nowMs`: 1 at the rebase, 0 once the blend has run. */
  private remainingAt(nowMs: number): number {
    const elapsedSeconds = (nowMs - this.startedAtMs) / MILLISECONDS_PER_SECOND;
    return Math.max(0, 1 - elapsedSeconds / RECONCILE_BLEND_SECONDS);
  }

  /** Where `predicted` is drawn at `nowMs`. */
  displayed(predicted: Vec2, nowMs: number): Vec2 {
    const remaining = this.remainingAt(nowMs);
    return { x: predicted.x + this.offset.x * remaining, y: predicted.y + this.offset.y * remaining };
  }

  /**
   * The prediction moved from under the screen: `shown` is where the cell was drawn a moment ago (`null` when it was
   * not), `next` where the new prediction puts it. A gap under the snap distance starts a fresh blend from `shown`.
   */
  rebase(shown: Vec2 | null, next: Vec2, nowMs: number): void {
    if (shown === null || distanceBetween(shown, next) >= RECONCILE_SNAP_DISTANCE_WU) {
      this.reset();
      return;
    }
    this.offset = { x: shown.x - next.x, y: shown.y - next.y };
    this.startedAtMs = nowMs;
  }

  reset(): void {
    this.offset = NO_OFFSET;
  }
}
