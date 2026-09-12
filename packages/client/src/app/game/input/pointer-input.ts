// The pointer adapter (docs/UI.md §4, docs/GAME-DESIGN.md §10): pointer events on the canvas host
// become a canvas-relative point and a sprint press. Touch rides the same events, so there is no
// second path. It holds no state: the controller latches the last point it was given.

import { PRIMARY_POINTER_BUTTON } from './input-constants';
import type { CanvasPoint } from './input-state';

export interface PointerInputOptions {
  /** The element the canvas fills (`game-host.component.ts`); points are relative to its box. */
  readonly host: HTMLElement;
  readonly onPointerMoved: (point: CanvasPoint) => void;
  /** A left click or a tap on the canvas: one sprint (docs/UI.md §4). */
  readonly onSprint: () => void;
}

/** The event's position in the host's own CSS pixels, which is what the camera inverts. */
export function canvasPointOf(host: HTMLElement, event: { clientX: number; clientY: number }): CanvasPoint {
  const box = host.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/** Attaches the canvas pointer listeners and returns the detach. */
export function attachPointerInput(options: PointerInputOptions): () => void {
  const onPointerMove = (event: PointerEvent): void => {
    options.onPointerMoved(canvasPointOf(options.host, event));
  };
  const onPointerDown = (event: PointerEvent): void => {
    // The canvas host takes focus on click so the hotkeys leave whatever field had it (docs/UI.md §4).
    options.host.focus();
    options.onPointerMoved(canvasPointOf(options.host, event));
    if (event.button === PRIMARY_POINTER_BUTTON) options.onSprint();
  };
  options.host.addEventListener('pointermove', onPointerMove);
  options.host.addEventListener('pointerdown', onPointerDown);
  return () => {
    options.host.removeEventListener('pointermove', onPointerMove);
    options.host.removeEventListener('pointerdown', onPointerDown);
  };
}
