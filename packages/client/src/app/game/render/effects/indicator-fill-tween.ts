// The DNA ring's fill tween (docs/ui/hud.md §3.1.2): the shown share eases linearly toward the record's over
// `INDICATOR_FILL_TWEEN_MS` from wherever it was when the target moved, off the render clock. A jump shows the
// target at once: the first frame of a cell, and a level-up, after which the new near-empty fill shows rather than
// draining from full. Pure state, no Pixi.

import { clamp } from '@evolution/shared';
import { INDICATOR_FILL_TWEEN_MS } from '../constants';

const START = 0;
const END = 1;

export class IndicatorFillTween {
  private fromFill = START;
  private targetFill: number | null = null;
  private startMs = START;

  /** The shown fill at `nowMs` on its way to `target`; `shouldJump` shows the target at once. */
  update(target: number, nowMs: number, shouldJump: boolean): number {
    if (this.targetFill === null || shouldJump) {
      this.fromFill = target;
      this.targetFill = target;
      this.startMs = nowMs;
      return target;
    }
    if (target !== this.targetFill) {
      this.fromFill = this.valueAt(nowMs);
      this.targetFill = target;
      this.startMs = nowMs;
    }
    return this.valueAt(nowMs);
  }

  /** Forgets the target, so the next update jumps. */
  reset(): void {
    this.targetFill = null;
  }

  private valueAt(nowMs: number): number {
    const target = this.targetFill ?? this.fromFill;
    const progress = clamp((nowMs - this.startMs) / INDICATOR_FILL_TWEEN_MS, START, END);
    return this.fromFill + (target - this.fromFill) * progress;
  }
}
