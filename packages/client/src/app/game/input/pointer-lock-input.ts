// The mouse lock's adapter (docs/ui/input-and-onboarding.md §4.1, #794): the one place the input layer talks to the
// Pointer Lock API. It keeps the virtual pointer, asks `pointer-lock-policy.ts` what a click or a lost lock means,
// and tells the HUD where to draw the in-game cursor. `pointer-input.ts` routes the canvas events through it.

import type { Clock } from '@evolution/shared';
import { SHOULD_REQUEST_UNADJUSTED_MOVEMENT, POINTER_LOCK_UNSUPPORTED_OPTION_ERROR } from './input-constants';
import type { CanvasPoint } from './input-state';
import {
  IDLE_POINTER_LOCK_STATE,
  LOCK_LOSS,
  POINTER_LOCK_PHASE,
  UNLOCKED_PRESS,
  lockLossOf,
  shouldReleaseLock,
  unlockedPressOutcome,
  withLockAcquired,
  withLockLost,
  withLockRequested,
  withReleaseRequested,
  withRequestFailed,
  withStaleRequestSettled,
  type PointerLockFacts,
  type PointerLockState,
} from './pointer-lock-policy';
import { VirtualHover } from './virtual-hover';
import { virtualPointerMovedBy, type PointerMovement } from './virtual-pointer';

/** The HUD's side of the mouse lock, wired by the game host (`hud/mouse-lock.service.ts`). */
export interface PointerLockSeam {
  /** The menu toggle (on by default). */
  readonly isEnabled: () => boolean;
  /** A menu, the encyclopedia or the results are up, so the player needs the real cursor. */
  readonly isCursorNeeded: () => boolean;
  /** The player left the lock with Escape: the menu opens, as Escape would have opened it. */
  readonly onUserExit: () => void;
  /** Where the in-game cursor is drawn, in canvas px; `null` while the pointer is not locked. */
  readonly onCursorMoved: (point: CanvasPoint | null) => void;
}

export interface PointerLockInputOptions {
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly seam: PointerLockSeam;
}

/** `requestPointerLock` as browsers ship it: older ones return nothing and report a refusal by event only. */
type PointerLockRequest = (options?: PointerLockOptions) => Promise<void> | undefined;

export class PointerLockInput {
  private state: PointerLockState = IDLE_POINTER_LOCK_STATE;
  private point: CanvasPoint = { x: 0, y: 0 };
  private readonly hover = new VirtualHover();
  private readonly ownerDocument: Document;
  private readonly onLockChange = (): void => this.lockChanged();
  private readonly onLockError = (): void => this.requestFailed();

  constructor(private readonly options: PointerLockInputOptions) {
    this.ownerDocument = options.host.ownerDocument;
    this.ownerDocument.addEventListener('pointerlockchange', this.onLockChange);
    this.ownerDocument.addEventListener('pointerlockerror', this.onLockError);
  }

  isLocked(): boolean {
    return this.state.phase === POINTER_LOCK_PHASE.locked;
  }

  /** The virtual pointer after one locked move; the HUD's cursor and any control under it follow. */
  movedBy(movement: PointerMovement): CanvasPoint {
    this.point = virtualPointerMovedBy(this.point, movement, this.canvasSize());
    this.options.seam.onCursorMoved(this.point);
    this.hover.moveTo(this.controlUnderPointer());
    return this.point;
  }

  /**
   * A primary mouse press on the canvas while unlocked, at `point`. Returns whether it sprints: the locking click
   * does not, and neither does one made while a lock is on its way or the browser's cooldown runs.
   */
  pressWhileUnlocked(point: CanvasPoint): boolean {
    this.state = withStaleRequestSettled(this.state, this.nowMs());
    const outcome = unlockedPressOutcome(this.state, this.facts());
    if (outcome === UNLOCKED_PRESS.requestLock) this.request(point);
    return outcome === UNLOCKED_PRESS.sprint;
  }

  /**
   * A primary press while locked. Over a HUD control that takes the pointer (a trait card, the leaderboard header) it
   * clicks that control, as the real cursor would have; anywhere else it sprints. Returns whether it sprints.
   */
  pressWhileLocked(): boolean {
    const control = this.controlUnderPointer();
    if (control === null) return true;
    control.click();
    return false;
  }

  /** Once a frame: hands the lock back when an overlay needs the real cursor or the toggle went off. */
  syncWithHud(): void {
    if (!shouldReleaseLock(this.state, this.facts())) return;
    this.state = withReleaseRequested(this.state);
    this.ownerDocument.exitPointerLock();
  }

  detach(): void {
    if (this.isLocked()) {
      this.state = withReleaseRequested(this.state);
      this.ownerDocument.exitPointerLock();
    }
    this.ownerDocument.removeEventListener('pointerlockchange', this.onLockChange);
    this.ownerDocument.removeEventListener('pointerlockerror', this.onLockError);
    this.leaveLock();
  }

  private facts(): PointerLockFacts {
    return {
      isEnabled: this.options.seam.isEnabled() && this.isSupported(),
      isCursorNeeded: this.options.seam.isCursorNeeded(),
      nowMs: this.nowMs(),
    };
  }

  private isSupported(): boolean {
    return typeof this.options.host.requestPointerLock === 'function';
  }

  private nowMs(): number {
    return this.options.clock.nowMilliseconds();
  }

  private canvasSize(): { width: number; height: number } {
    const box = this.options.host.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }

  private request(point: CanvasPoint): void {
    this.point = point;
    this.state = withLockRequested(this.state, this.nowMs());
    const request = this.options.host.requestPointerLock.bind(this.options.host) as PointerLockRequest;
    const options = SHOULD_REQUEST_UNADJUSTED_MOVEMENT ? { unadjustedMovement: true } : undefined;
    request(options)?.catch((error: unknown) => {
      // Raw movement is a nicety: a platform without it is asked again for the plain lock, still inside the click's
      // user activation. Any other refusal also fires `pointerlockerror`, which is where it is counted.
      if (
        options !== undefined &&
        error instanceof DOMException &&
        error.name === POINTER_LOCK_UNSUPPORTED_OPTION_ERROR
      ) {
        request()?.catch(() => undefined);
      }
    });
  }

  private requestFailed(): void {
    if (this.state.phase !== POINTER_LOCK_PHASE.requesting) return;
    this.state = withRequestFailed(this.state, this.nowMs());
  }

  private lockChanged(): void {
    if (this.ownerDocument.pointerLockElement === this.options.host) {
      this.state = withLockAcquired(this.state);
      this.options.seam.onCursorMoved(this.point);
      return;
    }
    if (this.state.phase === POINTER_LOCK_PHASE.unlocked) return;
    const loss = lockLossOf(this.state, this.ownerDocument.hasFocus());
    this.state = withLockLost(this.state, loss, this.nowMs());
    this.leaveLock();
    if (loss === LOCK_LOSS.userExit) this.options.seam.onUserExit();
  }

  private leaveLock(): void {
    this.hover.clear();
    this.options.seam.onCursorMoved(null);
  }

  /**
   * The HUD control under the virtual pointer, or `null` over the dish. The HUD layer takes no pointer events, so the
   * hit test passes through it to the canvas host unless a control that opted back in is there.
   */
  private controlUnderPointer(): HTMLElement | null {
    const box = this.options.host.getBoundingClientRect();
    const hit = this.ownerDocument.elementFromPoint(box.left + this.point.x, box.top + this.point.y);
    const isControl = hit instanceof HTMLElement && hit !== this.ownerDocument.body && !this.options.host.contains(hit);
    return isControl ? hit : null;
  }
}
