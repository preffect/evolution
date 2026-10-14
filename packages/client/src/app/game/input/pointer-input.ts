// The pointer adapter (docs/ui/input-and-onboarding.md §4, docs/game-design/controls-and-scope.md §10): pointer events on the canvas host
// become a canvas-relative point and a sprint press. Touch rides the same events, so there is no
// second path. It holds no state: the controller latches the last point it was given. With the mouse lock (§4.1)
// a locked pointer's point is the virtual one `pointer-lock-input.ts` keeps, and the locking click does not sprint.

import { MOUSE_POINTER_TYPE, PRIMARY_POINTER_BUTTON } from './input-constants';
import type { CanvasPoint } from './input-state';
import type { PointerLockInput } from './pointer-lock-input';

export interface PointerInputOptions {
  /** The element the canvas fills (`game-host.component.ts`); points are relative to its box. */
  readonly host: HTMLElement;
  readonly onPointerMoved: (point: CanvasPoint) => void;
  /** A left click or a tap on the canvas: one sprint (docs/ui/input-and-onboarding.md §4). */
  readonly onSprint: () => void;
  /** The mouse lock (docs/ui/input-and-onboarding.md §4.1); absent, the pointer is never locked. */
  readonly pointerLock?: PointerLockInput;
}

/** The event's position in the host's own CSS pixels, which is what the camera inverts. */
export function canvasPointOf(host: HTMLElement, event: { clientX: number; clientY: number }): CanvasPoint {
  const box = host.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/** Whether a primary press sprints: always for a touch or a pen, and for a mouse whatever the lock says. */
function doesPrimaryPressSprint(options: PointerInputOptions, event: PointerEvent, point: CanvasPoint): boolean {
  const lock = options.pointerLock;
  if (lock === undefined || event.pointerType !== MOUSE_POINTER_TYPE) return true;
  return lock.isLocked() ? lock.pressWhileLocked() : lock.pressWhileUnlocked(point);
}

/** Attaches the canvas pointer listeners and returns the detach. */
export function attachPointerInput(options: PointerInputOptions): () => void {
  const onPointerMove = (event: PointerEvent): void => {
    const lock = options.pointerLock;
    options.onPointerMoved(lock?.isLocked() ? lock.movedBy(event) : canvasPointOf(options.host, event));
  };
  const onPointerDown = (event: PointerEvent): void => {
    // The canvas host takes focus on click so the hotkeys leave whatever field had it (docs/ui/input-and-onboarding.md §4).
    options.host.focus();
    // A locked pointer's client position is frozen where the lock began: the virtual point stands, unmoved.
    if (options.pointerLock?.isLocked() !== true) options.onPointerMoved(canvasPointOf(options.host, event));
    if (event.button !== PRIMARY_POINTER_BUTTON) return;
    if (doesPrimaryPressSprint(options, event, canvasPointOf(options.host, event))) options.onSprint();
  };
  options.host.addEventListener('pointermove', onPointerMove);
  options.host.addEventListener('pointerdown', onPointerDown);
  return () => {
    options.host.removeEventListener('pointermove', onPointerMove);
    options.host.removeEventListener('pointerdown', onPointerDown);
  };
}
