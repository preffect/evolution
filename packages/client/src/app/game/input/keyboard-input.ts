// The keyboard adapter (docs/UI.md §4): `keydown` / `keyup` on the document and a window `blur`,
// turned into the decided actions of `keyboard-action.ts`. It holds no state and makes no rules —
// it gathers the facts, asks, forwards, and suppresses the browser default when the answer says to.

import {
  keyDownAction,
  keyUpAction,
  shouldPreventDefaultFor,
  type FocusContext,
  type InputAction,
} from './keyboard-action';

export interface KeyboardInputOptions {
  /** Where the listeners go: the document, so a hotkey works wherever focus sits (docs/UI.md §4). */
  readonly ownerDocument: Document;
  readonly focusContext: () => FocusContext;
  /** Presses act only in a room; releases always do, so no key stays held across a phase change. */
  readonly isInGame: () => boolean;
  readonly onAction: (action: InputAction) => void;
  /** The window lost focus: every key counts as released. */
  readonly onAllKeysReleased: () => void;
}

/** Attaches the hotkey listeners and returns the detach. */
export function attachKeyboardInput(options: KeyboardInputOptions): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!options.isInGame()) return;
    const action = keyDownAction({ code: event.code, isRepeat: event.repeat }, options.focusContext());
    if (shouldPreventDefaultFor(action)) event.preventDefault();
    options.onAction(action);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    options.onAction(keyUpAction(event.code));
  };
  const onWindowBlur = (): void => options.onAllKeysReleased();

  const view = options.ownerDocument.defaultView;
  options.ownerDocument.addEventListener('keydown', onKeyDown);
  options.ownerDocument.addEventListener('keyup', onKeyUp);
  view?.addEventListener('blur', onWindowBlur);
  return () => {
    options.ownerDocument.removeEventListener('keydown', onKeyDown);
    options.ownerDocument.removeEventListener('keyup', onKeyUp);
    view?.removeEventListener('blur', onWindowBlur);
  };
}
