// One room's rendering, from the first `game_state` to the teardown (docs/ARCHITECTURE.md §5, §6):
// creates the Pixi app and the renderer when the round's seed is known, applies every message
// to the store as it arrives (a snapshot is a delta, so none is skipped), runs the read-only
// frame loop on the app's ticker, feeds the audio handle and installs the debug hook. `game-setup.ts`
// builds one and wires the seams. The frame instrumentation (docs/RENDERING.md §7) brackets the
// frame: a snapshot applied on arrival is accrued to the `net` stage, the frame's interpolation is
// measured as `net`, the renderer brackets the rest, and every `RENDER_REPORT_EVERY_FRAMES` frames
// the `ClientPerformanceReport` the debug hook answers is rebuilt.

import {
  RENDER_STAGE,
  SERVER_MESSAGE_TYPE,
  type ClientPerformanceReport,
  type Clock,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import type { TransitionOptions } from '../state/snapshot-transitions';
import type { AudioHooksHandle } from '../audio/audio-hooks';
import { EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../debug/evolution-debug';
import { WorldStore, type RenderFrame } from '../net/world-store';
import { RENDER_REPORT_EVERY_FRAMES } from './constants';
import { FrameLoopSession } from './frame-loop-session';
import type { WorldPoint } from './camera';
import type { GameRenderer, RenderInputs, RenderOutputs } from './game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './pixi-app';

export interface RenderSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly devicePixelRatio: number;
  /** `pixi-app.ts`'s factory in the app; a fake handle in tests. */
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly connectAudio: (options: TransitionOptions) => AudioHooksHandle;
  readonly hudInputs: () => RenderInputs;
  /** `true` in dev builds, where the debug hook screenshots the canvas (`pixi-app.ts`). */
  readonly shouldPreserveDrawingBuffer: boolean;
  /** The cytoplasm tile's edge (`RenderTextureOptions`): the production size unless a test shrinks it. */
  readonly noiseTileSizePx?: number;
}

export class RenderSession extends FrameLoopSession {
  readonly store: WorldStore;
  private lastReport: ClientPerformanceReport | null = null;
  private audio: AudioHooksHandle | null = null;
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
  }

  get startupError(): unknown {
    return this.startupErrorValue;
  }

  /**
   * The world point under a canvas point through the live camera (docs/GAME-DESIGN.md §7); `null`
   * before the renderer exists. The input layer's one read of the render side (docs/UI.md §4).
   */
  screenToWorld(point: { readonly x: number; readonly y: number }): WorldPoint | null {
    return this.renderer?.screenToWorld(point.x, point.y) ?? null;
  }

  onMessage(message: ServerMessage): void {
    const { timer } = this.instrumentation;
    if (message.type === SERVER_MESSAGE_TYPE.gameState) {
      timer.accrue(RENDER_STAGE.net, () => this.store.applyGameState(message));
      this.audio?.disconnect();
      this.audio = this.dependencies.connectAudio({
        ownPlayerId: message.playerId,
        balance: message.balance,
        roundDurationSeconds: message.config.roundDurationSeconds,
      });
      this.ensureRenderer(message.snapshot).catch((error: unknown) => this.recordStartupError(error));
    } else if (message.type === SERVER_MESSAGE_TYPE.gameSnapshot) {
      if (timer.accrue(RENDER_STAGE.net, () => this.store.applySnapshot(message.snapshot))) {
        this.audio?.observe(message.snapshot);
      }
      // A rematch is in-room: no game_state, the new round seed rides the snapshot (docs/ARCHITECTURE.md §4).
      if (message.snapshot.seed !== this.requestedSeed) {
        this.ensureRenderer(message.snapshot).catch((error: unknown) => this.recordStartupError(error));
      }
    } else if (message.type === SERVER_MESSAGE_TYPE.balanceUpdated) {
      this.store.applyBalance(message.balance);
      this.audio?.updateOptions({ balance: message.balance });
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
    if (this.renderer?.seed === snapshot.seed) return;
    if ((await this.ensurePixiApp()) === null) return;
    this.buildRenderer({
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
    pixi.canvas.addEventListener('pointerdown', () => this.audio?.unlock(), { once: true });
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
    this.audio?.disconnect();
    this.disposeLoop();
  }
}
