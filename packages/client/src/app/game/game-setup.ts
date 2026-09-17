// The client's composition root (docs/architecture/client.md §6, docs/AUDIO.md §5): wires the net
// seams the host hands in, the render session, the input seam, the one `AudioHooks.connect` call,
// the HUD crossings and the dev-only debug hook. Under 100 lines by design; every decision lives
// in the modules it composes.

import type { Observable } from 'rxjs';
import type { Clock, GameInput, ServerMessage, TraitId } from '@evolution/shared';
import type { AudioHooksHandle } from './audio/audio-hooks';
import { definedEntriesOf } from './defined-entries';
import { installEvolutionDebug, type EvolutionDebugHost } from './debug/evolution-debug';
import { attachInput, type AttachInputOptions } from './input/attach-input';
import type { InputController } from './input/input-controller';
import { NO_RETICLE, type RenderInputs } from './render/game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './render/pixi-app';
import type { CameraExtent } from './render/camera';
import { RenderSession } from './render/render-session';
import type { OwnCellIndicators } from './state/own-cell-indicators';
import type { TransitionOptions } from './state/snapshot-transitions';

export interface GameSetupOptions {
  /** Send one unit of game input to the server (wraps `player_input`); the input seam's send. */
  send: (input: GameInput) => void;
  /** Every server message in arrival order, snapshots included (docs/architecture/client.md §5). */
  messages$: Observable<ServerMessage>;
  /** Tells the server which snapshot tick this client has applied (#266, docs/architecture/wire-contract.md §4). */
  acknowledgeSnapshot: (tick: number) => void;
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
  /** The HUD → renderer crossings (docs/ui/components-and-constants.md §7); #185–#190 feed them from their signals. */
  readonly previewTraitId: () => TraitId | null;
  /** The onboarding `steer` beat shows the reticle (docs/ui/input-and-onboarding.md §5); its position is the input seam's. */
  readonly isReticleVisible: () => boolean;
  /** The fourth crossing: the own-cell record the indicators draw (docs/ui/hud.md §3.1.4, #187). */
  readonly ownCellIndicators: () => OwnCellIndicators | null;
  /** The camera's world rectangle each frame, handed to `GameStateService` (docs/ui/components-and-constants.md §7, docs/ui/hud.md §3.1.2). */
  readonly onCameraExtent?: (extent: CameraExtent) => void;
  /** Escape, handed to the HUD's overlay state (docs/ui/overlays.md §3.5, #189). */
  readonly onMenuKey?: () => void;
  /** `H`, handed to the HUD's overlay state (docs/ui/encyclopedia.md §11.1, #449). */
  readonly onEncyclopediaKey?: () => void;
  /** Tab held / released, handed to the HUD's overlay state (docs/ui/hud.md §3.1.1, docs/ui/input-and-onboarding.md §4, #185). */
  readonly onFullLeaderboardHeldChanged?: (isHeld: boolean) => void;
  /** The picker's card pick for this room, `null` when the room goes (docs/ui/overlays.md §3.2, #188). */
  readonly onTraitCardPickReady?: (pick: ((cardIndex: number) => void) | null) => void;
}

/** Teardown handle returned by `setupGame`. */
export type GameTeardown = () => void;

/**
 * The renderer's reticle crossing: the HUD owns whether it shows, the input seam where it sits.
 * The seam is `null` for the moment between the session being constructed and the input being
 * attached to it, which no frame falls inside today and none may come to depend on.
 */
function reticleFor(isVisible: boolean, controller: InputController | null): RenderInputs['reticle'] {
  const point = controller?.pointerWorldPoint() ?? null;
  return point === null ? NO_RETICLE : { isVisible, x: point.x, y: point.y };
}

/** The optional HUD handlers, as a spreadable record; an absent one is an absent key. */
function hudHandlersOf(dependencies: GameSetupDependencies): Partial<AttachInputOptions> {
  return definedEntriesOf({
    onMenuKey: dependencies.onMenuKey,
    onEncyclopediaKey: dependencies.onEncyclopediaKey,
    onFullLeaderboardHeldChanged: dependencies.onFullLeaderboardHeldChanged,
    onTraitCardPickReady: dependencies.onTraitCardPickReady,
  });
}

/** The four HUD → renderer crossings this frame (docs/ui/components-and-constants.md §7). */
function hudInputsOf(dependencies: GameSetupDependencies, controller: InputController | null): RenderInputs {
  return {
    previewTraitId: dependencies.previewTraitId(),
    reticle: reticleFor(dependencies.isReticleVisible(), controller),
    ownCellIndicators: dependencies.ownCellIndicators(),
  };
}

export function setupGame(options: GameSetupOptions, dependencies: GameSetupDependencies): GameTeardown {
  // The session reads the input seam and the input seam reads the session's camera and store, so
  // one of the two is late-bound. It is this one, held in a mutable that is assigned on the next
  // line: nothing may read it during the constructor, and `reticleFor` answers for `null`.
  let controller: InputController | null = null;
  const session = new RenderSession({
    host: options.host,
    clock: dependencies.clock,
    devicePixelRatio: dependencies.devicePixelRatio,
    createPixiApp: dependencies.createPixiApp,
    connectAudio: dependencies.connectAudio,
    hudInputs: () => hudInputsOf(dependencies, controller),
    ...definedEntriesOf({ onCameraExtent: dependencies.onCameraExtent }),
    acknowledgeSnapshot: options.acknowledgeSnapshot,
    shouldPreserveDrawingBuffer: dependencies.isDevMode,
  });
  const input = attachInput({
    host: options.host,
    clock: dependencies.clock,
    send: options.send,
    store: session.store,
    projectPointer: (point) => session.projectPointer(point),
    ...hudHandlersOf(dependencies),
  });
  controller = input.controller;
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
