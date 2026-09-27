// The held arm's grip (#768, docs/rendering/cells.md §2.1, docs/visual-style/motion-and-legibility.md §5.1): when an
// amoeba's hold starts, the arm nearest the prey swings onto it over `PSEUDOPOD_GRIP_EASE_MS` on the render clock
// rather than in one frame; when the prey escapes mid-hold, it swings back to its flank from where the prey last was.
// The pull-driven hand-back (#753) stays in `forms/amoeba-pseudopods.ts`; the lobes take the lesser of the two.

import { PSEUDOPOD_GRIP_EASE_MS } from '../constants';
import type { ArmGrip } from '../cells/cell-deformation';

/** What a letting-go arm hands the deformation once the engulf has ended: the last hold and the fading grip. */
export interface ArmLetGo {
  readonly armHoldRadii: number;
  readonly armGrip: ArmGrip;
}

const NO_GRIP = 0;
const FULL_GRIP = 1;

/** One cell's grip: linear on the render clock from its share at the last turn (the grab or the let-go). */
export class ArmGripEasing {
  private angle = 0;
  private radii = 0;
  private isHolding = false;
  private shareAtTurn = NO_GRIP;
  private turnMs = 0;

  private shareAt(nowMs: number): number {
    const eased = Math.max(0, nowMs - this.turnMs) / PSEUDOPOD_GRIP_EASE_MS;
    const share = this.isHolding ? this.shareAtTurn + eased : this.shareAtTurn - eased;
    return Math.min(FULL_GRIP, Math.max(NO_GRIP, share));
  }

  /** Turns the ease at `nowMs` from wherever the grip is, so a re-grab mid let-go never jumps. */
  private turn(isHolding: boolean, nowMs: number): void {
    if (this.isHolding === isHolding) return;
    this.shareAtTurn = this.shareAt(nowMs);
    this.turnMs = nowMs;
    this.isHolding = isHolding;
  }

  /** While engulfing: the grip on the prey at `angle`, `radii` past the body, closing. */
  hold(angle: number, radii: number, nowMs: number): ArmGrip {
    this.turn(true, nowMs);
    this.angle = angle;
    this.radii = radii;
    return { angle, share: this.shareAt(nowMs) };
  }

  /** Once the engulf has ended: the arm letting go of where the prey last was; `null` once it has, or had nothing. */
  letGo(nowMs: number): ArmLetGo | null {
    this.turn(false, nowMs);
    const share = this.shareAt(nowMs);
    if (share <= NO_GRIP || this.radii <= 0) return null;
    return { armHoldRadii: this.radii, armGrip: { angle: this.angle, share } };
  }
}
