// The client's composition root (docs/ARCHITECTURE.md §6, docs/AUDIO.md §5): wires the net
// seams the host hands in, the render session, the one `AudioHooks.connect` call, the HUD
// crossings and the dev-only debug hook. Under 100 lines by design; every decision lives in the
// modules it composes. Input (#100) joins here with its own seam.

import type { Observable } from 'rxjs';
import type { Clock, GameInput, ServerMessage, TraitId } from '@evolution/shared';
import type { AudioHooksHandle } from './audio/audio-hooks';
import { installEvolutionDebug, type EvolutionDebugHost } from './debug/evolution-debug';
import type { RenderInputs } from './render/game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './render/pixi-app';
import { RenderSession } from './render/render-session';
import type { TransitionOptions } from './state/snapshot-transitions';

export interface GameSetupOptions {
  /** Send one unit of game input to the server (wraps `player_input`). */
  send: (input: GameInput) => void;
  /** Stream of non-coalesced server messages (everything except hot snapshots). */
  messages$: Observable<ServerMessage>;
  /** Drain the freshest un-rendered `game_snapshot` frame, or null. */
  drainLatestSnapshot: () => ServerMessage | null;
  /** The element the canvas mounts in. */
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
  /** The HUD → renderer crossings (docs/UI.md §7); #100 feeds them from its signals. */
  readonly previewTraitId: () => TraitId | null;
  readonly reticle: () => RenderInputs['reticle'];
}

/** Teardown handle returned by `setupGame`. */
export type GameTeardown = () => void;

export function setupGame(options: GameSetupOptions, dependencies: GameSetupDependencies): GameTeardown {
  const session = new RenderSession(
    {
      host: options.host,
      clock: dependencies.clock,
      devicePixelRatio: dependencies.devicePixelRatio,
      createPixiApp: dependencies.createPixiApp,
      connectAudio: dependencies.connectAudio,
      hudInputs: () => ({ previewTraitId: dependencies.previewTraitId(), reticle: dependencies.reticle() }),
    },
    options.drainLatestSnapshot,
  );
  const subscription = options.messages$.subscribe((message) => session.onMessage(message));
  const uninstallDebug = installEvolutionDebug(dependencies.debugHost, session.debugApi(), dependencies.isDevMode);
  return () => {
    subscription.unsubscribe();
    uninstallDebug();
    session.destroy();
  };
}
