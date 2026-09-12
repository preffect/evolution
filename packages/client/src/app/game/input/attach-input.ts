// Composes the input layer for one room (docs/ARCHITECTURE.md §6): one controller, the two DOM
// adapters and the teardown, so `game-setup.ts` stays a wiring file. Nothing here decides
// anything — the rules are `keyboard-action.ts`, the mapping `game-input-builder.ts`.

import type { Clock, GameInput, Vec2 } from '@evolution/shared';
import type { WorldStore } from '../net/world-store';
import { focusContextOf } from './dom-input-context';
import { InputController } from './input-controller';
import type { CanvasPoint } from './input-state';
import { INPUT_ACTION } from './keyboard-action';
import { attachKeyboardInput } from './keyboard-input';
import { attachPointerInput } from './pointer-input';
import { inputWorldContextOf } from './input-world-context';

export interface AttachInputOptions {
  /** The element the canvas fills: where the pointer listeners go and what takes focus on click. */
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly send: (input: GameInput) => void;
  readonly store: WorldStore;
  /** Canvas px → world units through the live camera (`RenderSession.screenToWorld`). */
  readonly screenToWorld: (point: CanvasPoint) => Vec2 | null;
  /** Escape: the HUD closes the topmost overlay or opens the menu (docs/UI.md §3.5, #189). */
  readonly onMenuKey?: () => void;
}

export interface InputSeam {
  readonly controller: InputController;
  detach(): void;
}

export function attachInput(options: AttachInputOptions): InputSeam {
  const controller = new InputController({
    clock: options.clock,
    send: options.send,
    screenToWorld: options.screenToWorld,
    world: () => inputWorldContextOf(options.store),
    ...(options.onMenuKey === undefined ? {} : { onMenuKey: options.onMenuKey }),
  });
  const ownerDocument = options.host.ownerDocument;
  const detachKeyboard = attachKeyboardInput({
    ownerDocument,
    focusContext: () => focusContextOf(ownerDocument),
    // A room exists as soon as the first `game_state` names the player; the results phase keeps
    // its hotkeys (Escape, the trait keys) and stops only at the send (`input-world-context.ts`).
    isInGame: () => options.store.ownPlayerId !== null,
    onAction: (action) => controller.apply(action),
    onAllKeysReleased: () => controller.releaseAllKeys(),
  });
  const detachPointer = attachPointerInput({
    host: options.host,
    onPointerMoved: (point) => controller.pointerMovedTo(point),
    onSprint: () => controller.apply({ kind: INPUT_ACTION.sprint }),
  });
  return {
    controller,
    detach: () => {
      detachKeyboard();
      detachPointer();
    },
  };
}
