// Composes the input layer for one room (docs/ARCHITECTURE.md §6): one controller, the two DOM
// adapters and the teardown, so `game-setup.ts` stays a wiring file. Nothing here decides
// anything — the rules are `keyboard-action.ts`, the mapping `game-input-builder.ts`.

import type { Clock, GameInput } from '@evolution/shared';
import type { WorldStore } from '../net/world-store';
import type { PointerProjection } from '../render/render-session';
import { definedEntriesOf } from '../defined-entries';
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
  /** Canvas px through the live camera (`RenderSession.projectPointer`). */
  readonly projectPointer: (point: CanvasPoint) => PointerProjection | null;
  /** Escape: the HUD closes the topmost overlay or opens the menu (docs/UI.md §3.5, #189). */
  readonly onMenuKey?: () => void;
  /** Tab held / released: the HUD opens the full leaderboard while it is (docs/UI.md §4, #185). */
  readonly onFullLeaderboardHeldChanged?: (isHeld: boolean) => void;
}

export interface InputSeam {
  readonly controller: InputController;
  detach(): void;
}

export function attachInput(options: AttachInputOptions): InputSeam {
  const controller = new InputController({
    clock: options.clock,
    send: options.send,
    projectPointer: options.projectPointer,
    world: () => inputWorldContextOf(options.store),
    ...definedEntriesOf({
      onMenuKey: options.onMenuKey,
      onFullLeaderboardHeldChanged: options.onFullLeaderboardHeldChanged,
    }),
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
      // A room can end with Tab still down (the round ends, a disconnect, a leave control). The
      // HUD state is `providedIn: 'root'` and outlives these components, so the release has to be
      // reported before the listener that would have reported it goes away, or the next room
      // mounts with the full leaderboard already open (docs/UI.md §3.1.1).
      controller.releaseAllKeys();
      detachKeyboard();
      detachPointer();
    },
  };
}
