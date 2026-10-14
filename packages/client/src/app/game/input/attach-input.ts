// Composes the input layer for one room (docs/architecture/client.md §6): one controller, the two DOM
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
import { PointerLockInput, type PointerLockSeam } from './pointer-lock-input';
import { inputWorldContextOf } from './input-world-context';

export interface AttachInputOptions {
  /** The element the canvas fills: where the pointer listeners go and what takes focus on click. */
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly send: (input: GameInput) => void;
  readonly store: WorldStore;
  /** Canvas px through the live camera (`RenderSession.projectPointer`). */
  readonly projectPointer: (point: CanvasPoint) => PointerProjection | null;
  /** Escape: the HUD closes the topmost overlay or opens the menu (docs/ui/overlays.md §3.5, #189). */
  readonly onMenuKey?: () => void;
  /** `H`: the HUD opens the encyclopedia (docs/ui/encyclopedia.md §11.1, docs/ui/input-and-onboarding.md §4). */
  readonly onEncyclopediaKey?: () => void;
  /** Tab held / released: the HUD opens the full leaderboard while it is (docs/ui/input-and-onboarding.md §4, #185). */
  readonly onFullLeaderboardHeldChanged?: (isHeld: boolean) => void;
  /**
   * The HUD's card pick for this room, handed over once the controller exists and taken back (`null`) on detach:
   * a clicked card goes through the same pick policy as the `1` `2` `3` keys (docs/ui/overlays.md §3.2, #188).
   */
  readonly onTraitCardPickReady?: (pick: ((cardIndex: number) => void) | null) => void;
  /** The HUD's side of the mouse lock (docs/ui/input-and-onboarding.md §4.1, #794); absent, the pointer never locks. */
  readonly pointerLock?: PointerLockSeam;
}

export interface InputSeam {
  readonly controller: InputController;
  /** Once per animation frame: the lock follows the overlays, then the controller sends what came due. */
  onAnimationFrame(): void;
  detach(): void;
}

/** The mouse lock for this room, when the HUD wired its side (docs/ui/input-and-onboarding.md §4.1). */
function pointerLockOf(options: AttachInputOptions): PointerLockInput | undefined {
  const seam = options.pointerLock;
  return seam === undefined ? undefined : new PointerLockInput({ host: options.host, clock: options.clock, seam });
}

/** The room's one controller: it sends through the store, so prediction sees every input the server will. */
function controllerOf(options: AttachInputOptions): InputController {
  return new InputController({
    clock: options.clock,
    send: (input) => {
      options.store.recordOwnInput(input);
      options.send(input);
    },
    projectPointer: options.projectPointer,
    world: () => inputWorldContextOf(options.store),
    ...definedEntriesOf({
      onMenuKey: options.onMenuKey,
      onEncyclopediaKey: options.onEncyclopediaKey,
      onFullLeaderboardHeldChanged: options.onFullLeaderboardHeldChanged,
    }),
  });
}

export function attachInput(options: AttachInputOptions): InputSeam {
  const controller = controllerOf(options);
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
  const pointerLock = pointerLockOf(options);
  const detachPointer = attachPointerInput({
    host: options.host,
    onPointerMoved: (point) => controller.pointerMovedTo(point),
    onSprint: () => controller.apply({ kind: INPUT_ACTION.sprint }),
    ...definedEntriesOf({ pointerLock }),
  });
  options.onTraitCardPickReady?.((cardIndex) => controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex }));
  return {
    controller,
    onAnimationFrame: () => {
      pointerLock?.syncWithHud();
      controller.pump();
    },
    detach: () => {
      // A room can end with Tab still down (the round ends, a disconnect, a leave control). The
      // HUD state is `providedIn: 'root'` and outlives these components, so the release has to be
      // reported before the listener that would have reported it goes away, or the next room
      // mounts with the full leaderboard already open (docs/ui/hud.md §3.1.1).
      controller.releaseAllKeys();
      options.onTraitCardPickReady?.(null);
      detachKeyboard();
      detachPointer();
      pointerLock?.detach();
    },
  };
}
