// The engulf grip (#768, #771, docs/rendering/cells.md §2.1, docs/visual-style/motion-and-legibility.md §5.1): when an
// amoeba's hold starts, the arm nearest the prey swings onto it and the whole fan turns to flank it over
// `PSEUDOPOD_GRIP_EASE_MS` on the render clock rather than in one frame; when the engulf ends, by an escape or the
// seal, they swing back from where the prey last was. When the held prey changes, the grip slides from the old prey
// to the new one over the same ease. The pull-driven hand-back (#753) stays in `forms/amoeba-pseudopods.ts`; the lobes
// take the lesser of the two.

import type { EntityId } from '@evolution/shared';
import { PSEUDOPOD_GRIP_EASE_MS } from '../constants';
import { FULL_GRIP_SHARE, NO_GRIP_SHARE, type ArmGrip } from '../cells/cell-deformation';
import { wrapAngle } from '../geometry';

/** What a letting-go arm hands the deformation once the engulf has ended: the last hold and the fading grip. */
export interface ArmLetGo {
  readonly armHoldRadii: number;
  readonly armGrip: ArmGrip;
}

/** Where the grip was when the held prey changed, and when: the slide to the new prey starts there. */
interface PreySwitch {
  readonly angle: number;
  readonly radii: number;
  readonly atMs: number;
}

/** One cell's grip: linear on the render clock from its share at the last turn (the grab or the let-go). */
export class ArmGripEasing {
  private preyId: EntityId | null = null;
  private angle = 0;
  private radii = 0;
  private isHolding = false;
  private shareAtTurn = NO_GRIP_SHARE;
  private turnMs = 0;
  private preySwitch: PreySwitch | null = null;

  private shareAt(nowMs: number): number {
    const eased = Math.max(0, nowMs - this.turnMs) / PSEUDOPOD_GRIP_EASE_MS;
    const share = this.isHolding ? this.shareAtTurn + eased : this.shareAtTurn - eased;
    return Math.min(FULL_GRIP_SHARE, Math.max(NO_GRIP_SHARE, share));
  }

  /** How far the slide from the previous prey has come: 1 once done, or with no switch. */
  private slideAt(nowMs: number): number {
    if (this.preySwitch === null) return FULL_GRIP_SHARE;
    return Math.min(FULL_GRIP_SHARE, Math.max(0, nowMs - this.preySwitch.atMs) / PSEUDOPOD_GRIP_EASE_MS);
  }

  /** Where the grip is at `nowMs`: the prey, or on its way there from the previous one. */
  private gripAt(nowMs: number): { readonly angle: number; readonly radii: number } {
    const from = this.preySwitch;
    const slide = this.slideAt(nowMs);
    if (from === null || slide >= FULL_GRIP_SHARE) return { angle: this.angle, radii: this.radii };
    return {
      angle: wrapAngle(from.angle + wrapAngle(this.angle - from.angle) * slide),
      radii: from.radii + (this.radii - from.radii) * slide,
    };
  }

  /** Turns the ease at `nowMs` from wherever the grip is, so a re-grab mid let-go never jumps. */
  private turn(isHolding: boolean, nowMs: number): void {
    if (this.isHolding === isHolding) return;
    this.shareAtTurn = this.shareAt(nowMs);
    this.turnMs = nowMs;
    this.isHolding = isHolding;
  }

  /** A new prey while the grip is still on the old one slides there from wherever the grip is now. */
  private switchPrey(preyId: EntityId, nowMs: number): void {
    if (this.preyId === preyId) return;
    const isGripping = this.preyId !== null && this.shareAt(nowMs) > NO_GRIP_SHARE;
    this.preySwitch = isGripping ? { ...this.gripAt(nowMs), atMs: nowMs } : null;
    this.preyId = preyId;
  }

  /** While engulfing `preyId`: the grip on the prey at `angle`, `radii` past the body, closing. */
  hold(preyId: EntityId, angle: number, radii: number, nowMs: number): ArmLetGo {
    this.switchPrey(preyId, nowMs);
    this.turn(true, nowMs);
    this.angle = angle;
    this.radii = radii;
    const grip = this.gripAt(nowMs);
    return { armHoldRadii: grip.radii, armGrip: { angle: grip.angle, share: this.shareAt(nowMs) } };
  }

  /**
   * Once the engulf has ended: the arm letting go of, and the fan turning back from, where the prey last was; `null`
   * once it has, or had nothing. A prey the body had covered (the seal) has no arm on it, but the fan still turns back.
   */
  letGo(nowMs: number): ArmLetGo | null {
    this.turn(false, nowMs);
    const share = this.shareAt(nowMs);
    if (share <= NO_GRIP_SHARE || this.preyId === null) return null;
    const grip = this.gripAt(nowMs);
    return { armHoldRadii: grip.radii, armGrip: { angle: grip.angle, share } };
  }
}
