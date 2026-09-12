// The client's composition root (docs/ARCHITECTURE.md §6, docs/AUDIO.md §5): wires the net
// seams the host hands in, the render session, the input seam, the one `AudioHooks.connect` call,
// the HUD crossings and the dev-only debug hook. Under 100 lines by design; every decision lives
// in the modules it composes.

import type { Observable } from 'rxjs';
import type { Clock, GameInput, ServerMessage, TraitId } from '@evolution/shared';
import type { AudioHooksHandle } from './audio/audio-hooks';
import { installEvolutionDebug, type EvolutionDebugHost } from './debug/evolution-debug';
import { attachInput } from './input/attach-input';
import type { InputController } from './input/input-controller';
import { NO_RETICLE, type RenderInputs } from './render/game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './render/pixi-app';
import { RenderSession } from './render/render-session';
import type { TransitionOptions } from './state/snapshot-transitions';

export interface GameSetupOptions {
  /** Send one unit of game input to the server (wraps `player_input`); the input seam's send. */
  send: (input: GameInput) => void;
  /** Every server message in arrival order, snapshots included (docs/ARCHITECTURE.md §5). */
  messages$: Observable<ServerMessage>;
  /** The element the canvas mounts in, and the element the pointer is read against. */
  host: HTMLElement;
}

/** What the composition root injects: the clock, the audio seam, the platform and the HUD signals. */
export interface GameSetupDependencies {
  readonly clock: Clock;
  readonly connectAudio: (options: TransitionOptions) => AudioHooksHandle;
  /** `render/pixi-app.ts`'s `createPixiApp`; a fake handle in tests (no WebGL under jsdom). */
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly devicePixelRatio: number;
  readonly debugHost: EvolutionDebugHost;
  readonly isDevMode: boolean;
  /** The HUD → renderer crossings (docs/UI.md §7); #185–#190 feed them from their signals. */
  readonly previewTraitId: () => TraitId | null;
  /** The onboarding `steer` beat shows the reticle (docs/UI.md §5); its position is the input seam's. */
  readonly isReticleVisible: () => boolean;
  /** Escape, handed to the HUD's overlay state (docs/UI.md §3.5, #189). */
  readonly onMenuKey?: () => void;
}

/** Teardown handle returned by `setupGame`. */
export type GameTeardown = () => void;

/** The renderer's reticle crossing: the HUD owns whether it shows, the input seam where it sits. */
function reticleFor(isVisible: boolean, controller: InputController): RenderInputs['reticle'] {
  const point = controller.pointerWorldPoint();
  return point === null ? NO_RETICLE : { isVisible, x: point.x, y: point.y };
}

export function setupGame(options: GameSetupOptions, dependencies: GameSetupDependencies): GameTeardown {
  const session = new RenderSession({
    host: options.host,
    clock: dependencies.clock,
    devicePixelRatio: dependencies.devicePixelRatio,
    createPixiApp: dependencies.createPixiApp,
    connectAudio: dependencies.connectAudio,
    hudInputs: () => ({
      previewTraitId: dependencies.previewTraitId(),
      reticle: reticleFor(dependencies.isReticleVisible(), input.controller),
    }),
    shouldPreserveDrawingBuffer: dependencies.isDevMode,
  });
  const input = attachInput({
    host: options.host,
    clock: dependencies.clock,
    send: options.send,
    store: session.store,
    screenToWorld: (point) => session.screenToWorld(point),
    ...(dependencies.onMenuKey === undefined ? {} : { onMenuKey: dependencies.onMenuKey }),
  });
  session.setAnimationFrameListener(() => input.controller.pump());
  const subscription = options.messages$.subscribe((message) => session.onMessage(message));
  const uninstallDebug = installEvolutionDebug(
    dependencies.debugHost,
    { ...session.debugApi(), input: () => input.controller.debugState() },
    dependencies.isDevMode,
  );
  return () => {
    subscription.unsubscribe();
    uninstallDebug();
    session.setAnimationFrameListener(null);
    input.detach();
    session.destroy();
  };
}
