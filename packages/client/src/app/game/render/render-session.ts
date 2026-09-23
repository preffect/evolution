// One room's rendering, from the first `game_state` to the teardown (docs/architecture/client.md §5, §6):
// creates the Pixi app and the renderer when the round's seed is known, applies every message
// to the store as it arrives (a snapshot is a delta, so none is skipped), runs the read-only
// frame loop on the app's ticker, feeds the audio handle and installs the debug hook. `game-setup.ts`
// builds one and wires the seams. The frame instrumentation (docs/rendering/budget.md §7) brackets the
// frame: a snapshot applied on arrival is accrued to the `net` stage, the frame's interpolation is
// measured as `net`, the renderer brackets the rest, and every `RENDER_REPORT_EVERY_FRAMES` frames
// the `ClientPerformanceReport` the debug hook answers is rebuilt.

import {
  DISH_CENTRE_TARGET,
  RENDER_STAGE,
  followTargetIn,
  parkCamera,
  type CameraState,
  SERVER_MESSAGE_TYPE,
  type ClientPerformanceReport,
  type Clock,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import type { TransitionOptions } from '../state/snapshot-transitions';
import type { AudioHooksHandle } from '../audio/audio-hooks';
import { AudioSession } from '../audio/audio-session';
import { EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../debug/evolution-debug';
import { SnapshotAcknowledger } from '../net/snapshot-acknowledger';
import { WorldStore, type RenderFrame } from '../net/world-store';
import { RENDER_REPORT_EVERY_FRAMES } from './constants';
import { FrameLoopSession } from './frame-loop-session';
import { screenOffsetToWorld, screenToWorld, type CameraExtent, type WorldPoint } from './camera';
import type { GameRenderer, RenderInputs, RenderOutputs } from './game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './pixi-app';

/** A canvas point resolved through the live camera, both ways the input layer needs it. */
export interface PointerProjection {
  /** The world point under the pointer: where the reticle sits (docs/rendering/budget.md §6). */
  readonly worldPoint: WorldPoint;
  /** The same point as a world-space offset from the middle of the view. */
  readonly offsetFromViewCentre: WorldPoint;
}

export interface RenderSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly devicePixelRatio: number;
  /** `pixi-app.ts`'s factory in the app; a fake handle in tests. */
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly connectAudio: (options: TransitionOptions) => AudioHooksHandle;
  readonly hudInputs: () => RenderInputs;
  /**
   * The camera's world rectangle after each frame: the fourth HUD crossing (docs/ui/components-and-constants.md §7), and the
   * only fact that travels render-side to HUD-side. `threatsFor` needs it to mean "on screen".
   */
  readonly onCameraExtent?: (extent: CameraExtent) => void;
  /** `true` in dev builds, where the debug hook screenshots the canvas (`pixi-app.ts`). */
  readonly shouldPreserveDrawingBuffer: boolean;
  /** The cytoplasm tile's edge (`RenderTextureOptions`): the production size unless a test shrinks it. */
  readonly noiseTileSizePx?: number;
  /**
   * Tells the server the newest snapshot tick this client has applied (#266,
   * docs/architecture/wire-contract.md §4). Flow control, not gameplay: the room reads it to see how deep the
   * queue between them is, and stops sending rather than letting this client fall behind for good.
   */
  readonly acknowledgeSnapshot: (tick: number) => void;
}

export class RenderSession extends FrameLoopSession {
  readonly store: WorldStore;
  private readonly acknowledger: SnapshotAcknowledger;
  private lastReport: ClientPerformanceReport | null = null;
  private readonly audio: AudioSession;
  /** The one in-flight or resolved Pixi app, so two early `game_state`s never create two canvases. */
  private pixiReady: Promise<PixiAppHandle | null> | null = null;
  /** Renderer builds queue behind each other: the newest seed wins and no two share the stage. */
  private rendererReady: Promise<void> = Promise.resolve();
  /** The error that left the session without a renderer (no WebGL, a failed factory); `null` while healthy. */
  private startupErrorValue: unknown = null;
  /** The seed of the newest renderer build asked for, so a rematch snapshot asks exactly once. */
  private requestedSeed: number | null = null;
  private isDestroyed = false;

  constructor(private readonly dependencies: RenderSessionDependencies) {
    super(dependencies.clock);
    this.store = new WorldStore(dependencies.clock);
    this.acknowledger = new SnapshotAcknowledger(dependencies.acknowledgeSnapshot);
    this.audio = new AudioSession(dependencies.connectAudio);
  }

  get startupError(): unknown {
    return this.startupErrorValue;
  }

  /**
   * A canvas point through the live camera (docs/game-design/controls-and-scope.md §7). The input layer's one read of
   * the render side (docs/ui/input-and-onboarding.md §4): the absolute world point is where the reticle is drawn, the
   * offset is what the steer target hangs off the own cell so the camera's smoothing and interpolation delay stay out
   * of the steering command. While the first renderer is still baking (ticket #479) there is no live camera yet, so
   * the point goes through the camera that renderer will open on — parked on the newest snapshot's follow target —
   * and the pointer steers from the first frame; `null` only before a snapshot and an app exist.
   */
  projectPointer(point: { readonly x: number; readonly y: number }): PointerProjection | null {
    const renderer = this.renderer;
    if (renderer !== null) {
      return {
        worldPoint: renderer.screenToWorld(point.x, point.y),
        offsetFromViewCentre: renderer.screenOffsetToWorld(point.x, point.y),
      };
    }
    const camera = this.openingCamera();
    if (camera === null || this.pixi === null) return null;
    const viewport = this.pixi.app.screen;
    return {
      worldPoint: screenToWorld(camera, viewport, point.x, point.y),
      offsetFromViewCentre: screenOffsetToWorld(camera, viewport, point.x, point.y),
    };
  }

  /** The camera a new renderer's first frame parks (`GameRenderer.stepCamera`): on the follow target, or the dish. */
  private openingCamera(): CameraState | null {
    const snapshot = this.store.latestSnapshot();
    const ownPlayerId = this.store.ownPlayerId;
    if (snapshot === null || ownPlayerId === null) return null;
    const target = followTargetIn(snapshot.cells, ownPlayerId, snapshot.ownProgress?.spectatingCellId ?? null);
    return parkCamera(target ?? DISH_CENTRE_TARGET);
  }

  onMessage(message: ServerMessage): void {
    const { timer } = this.instrumentation;
    if (message.type === SERVER_MESSAGE_TYPE.gameState) {
      timer.accrue(RENDER_STAGE.net, () => this.store.applyGameState(message));
      // A full state puts the two in step: the room is waiting to hear it before it resumes deltas.
      this.acknowledger.acknowledgeNow(message.snapshot.tick);
      // A resync keeps the session it is already in (#275): only another room or player starts one over.
      this.audio.begin(message.gameId, {
        ownPlayerId: message.playerId,
        balance: message.balance,
        roundDurationSeconds: message.config.roundDurationSeconds,
      });
      this.ensureRenderer(message.snapshot).catch((error: unknown) => this.recordStartupError(error));
    } else if (message.type === SERVER_MESSAGE_TYPE.gameSnapshot) {
      if (timer.accrue(RENDER_STAGE.net, () => this.store.applySnapshot(message.snapshot))) {
        this.audio.observe(message.snapshot);
        this.acknowledger.recordApplied(message.snapshot.tick);
      }
      // A rematch is in-room: no game_state, the new round seed rides the snapshot (docs/architecture/wire-contract.md §4).
      if (message.snapshot.seed !== this.requestedSeed) {
        this.ensureRenderer(message.snapshot).catch((error: unknown) => this.recordStartupError(error));
      }
    } else if (message.type === SERVER_MESSAGE_TYPE.balanceUpdated) {
      this.store.applyBalance(message.balance);
      this.audio.updateOptions({ balance: message.balance });
    }
  }

  /**
   * Resolves once the renderer for `snapshot.seed` exists; rejects when the Pixi app cannot be
   * created. Calls queue behind each other, so the last seed wins and an earlier renderer is
   * disposed only after it was built. Tests await it; `onMessage` records a rejection.
   */
  ensureRenderer(snapshot: GameSnapshot): Promise<void> {
    this.requestedSeed = snapshot.seed;
    const build = this.rendererReady.then(() => this.buildRendererFor(snapshot));
    this.rendererReady = build.catch(() => undefined);
    return build;
  }

  private async buildRendererFor(snapshot: GameSnapshot): Promise<void> {
    // A seed superseded while it waited in the queue is never baked: the newest one is already queued behind it.
    if (snapshot.seed !== this.requestedSeed || this.renderer?.seed === snapshot.seed) return;
    if ((await this.ensurePixiApp()) === null) return;
    // Staged across frames (ticket #479): baked one step per animation frame rather than in one long task.
    await this.buildRendererAcrossFrames({
      seed: snapshot.seed,
      gelPatches: snapshot.gelPatches,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      noiseTileSizePx: this.dependencies.noiseTileSizePx,
    });
  }

  private ensurePixiApp(): Promise<PixiAppHandle | null> {
    this.pixiReady ??= this.createPixiApp().catch((error: unknown) => {
      // The next `game_state` may try again (a reconnect after the GPU came back).
      this.pixiReady = null;
      throw error;
    });
    return this.pixiReady;
  }

  private async createPixiApp(): Promise<PixiAppHandle | null> {
    const pixi = await this.dependencies.createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      shouldPreserveDrawingBuffer: this.dependencies.shouldPreserveDrawingBuffer,
    });
    if (this.isDestroyed) {
      pixi.destroy();
      return null;
    }
    this.adoptPixiApp(pixi);
    pixi.canvas.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    return pixi;
  }

  /** A room without a canvas is fatal for play but not for the lobby: the failure is kept and logged once. */
  private recordStartupError(error: unknown): void {
    this.startupErrorValue = error;
    console.error('The renderer could not start; the room plays without a canvas.', error);
  }

  /** The frame loop reads the store only: the next interpolated frame, rendered with the HUD's inputs. */
  protected nextFrame(): RenderFrame | null {
    return this.store.nextFrame();
  }

  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    return renderer.render(frame, this.store.ownPlayerId, this.dependencies.hudInputs(), submit);
  }

  /** Every `RENDER_REPORT_EVERY_FRAMES` frames the report the debug hook answers is rebuilt. */
  protected afterFrame(outputs: RenderOutputs): void {
    this.dependencies.onCameraExtent?.(outputs.cameraExtent);
    if (this.instrumentation.frameCount % RENDER_REPORT_EVERY_FRAMES === 0) {
      this.lastReport = this.instrumentation.report(outputs, null);
    }
  }

  /** The `window.__evolutionDebug` mirror for a live room. */
  debugApi(): EvolutionDebugApi {
    return {
      ...this.loopDebugMembers(),
      mode: EVOLUTION_DEBUG_MODE.live,
      step: (frames) => this.gate.step(frames),
      setSeed: () => false,
      performanceReport: () => this.lastReport,
    };
  }

  destroy(): void {
    this.isDestroyed = true;
    this.audio.disconnect();
    this.disposeLoop();
  }
}
