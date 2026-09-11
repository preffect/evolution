// One room's rendering, from the first `game_state` to the teardown (docs/ARCHITECTURE.md §5, §6):
// creates the Pixi app and the renderer when the round's seed is known, applies every message
// to the store as it arrives (a snapshot is a delta, so none is skipped), runs the read-only
// frame loop on the app's ticker, feeds the audio handle and installs the debug hook. `game-setup.ts` builds one and wires the seams. Slice D (#208) adds the frame-budget
// report (`ClientPerformanceReport`) on top of the frame loop.

import { SERVER_MESSAGE_TYPE, type Clock, type GameSnapshot, type ServerMessage } from '@evolution/shared';
import type { TransitionOptions } from '../state/snapshot-transitions';
import type { AudioHooksHandle } from '../audio/audio-hooks';
import { FrameGate, EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../debug/evolution-debug';
import { WorldStore } from '../net/world-store';
import { GameRenderer, type RenderInputs } from './game-renderer';
import type { PixiAppHandle, PixiAppOptions } from './pixi-app';
import { createRenderTextures, destroyRenderTextures, type RenderTextures } from './render-textures';

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
}

export class RenderSession {
  readonly store: WorldStore;
  readonly gate = new FrameGate();
  private pixi: PixiAppHandle | null = null;
  private textures: RenderTextures | null = null;
  private renderer: GameRenderer | null = null;
  private audio: AudioHooksHandle | null = null;
  /** The one in-flight or resolved Pixi app, so two early `game_state`s never create two canvases. */
  private pixiReady: Promise<PixiAppHandle | null> | null = null;
  /** Renderer builds queue behind each other: the newest seed wins and no two share the stage. */
  private rendererReady: Promise<void> = Promise.resolve();
  /** The error that left the session without a renderer (no WebGL, a failed factory); `null` while healthy. */
  private startupErrorValue: unknown = null;
  /** The seed of the newest renderer build asked for, so a rematch snapshot asks exactly once. */
  private requestedSeed: number | null = null;
  /** The tick of the frame on screen: what the debug hook reports, held while paused. */
  private lastRenderedTick: number | null = null;
  private isDestroyed = false;

  constructor(private readonly dependencies: RenderSessionDependencies) {
    this.store = new WorldStore(dependencies.clock);
  }

  get startupError(): unknown {
    return this.startupErrorValue;
  }

  onMessage(message: ServerMessage): void {
    if (message.type === SERVER_MESSAGE_TYPE.gameState) {
      this.store.applyGameState(message);
      this.audio?.disconnect();
      this.audio = this.dependencies.connectAudio({
        ownPlayerId: message.playerId,
        balance: message.balance,
        roundDurationSeconds: message.config.roundDurationSeconds,
      });
      this.ensureRenderer(message.snapshot).catch((error: unknown) => this.recordStartupError(error));
    } else if (message.type === SERVER_MESSAGE_TYPE.gameSnapshot) {
      if (this.store.applySnapshot(message.snapshot)) this.audio?.observe(message.snapshot);
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
    const build = this.rendererReady.then(() => this.buildRenderer(snapshot));
    this.rendererReady = build.catch(() => undefined);
    return build;
  }

  private async buildRenderer(snapshot: GameSnapshot): Promise<void> {
    if (this.renderer !== null && this.renderer.seed === snapshot.seed) return;
    const pixi = await this.ensurePixiApp();
    if (pixi === null) return;
    this.disposeRenderer();
    this.textures = createRenderTextures({
      seed: snapshot.seed,
      baker: pixi.textures,
      gelPatches: snapshot.gelPatches,
      devicePixelRatio: this.dependencies.devicePixelRatio,
    });
    this.renderer = new GameRenderer(pixi.app.stage, this.textures, pixi.app.screen);
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
    this.pixi = pixi;
    pixi.app.ticker.remove(pixi.app.render, pixi.app);
    pixi.app.ticker.add(() => this.frame());
    pixi.canvas.addEventListener('pointerdown', () => this.audio?.unlock(), { once: true });
    return pixi;
  }

  /** A room without a canvas is fatal for play but not for the lobby: the failure is kept and logged once. */
  private recordStartupError(error: unknown): void {
    this.startupErrorValue = error;
    console.error('The renderer could not start; the room plays without a canvas.', error);
  }

  /** One ticker callback: renders the store's next frame unless the gate holds it. Reads only. */
  frame(): void {
    if (this.pixi === null || this.renderer === null || !this.gate.claimFrame()) return;
    const frame = this.store.nextFrame();
    if (frame === null) return;
    this.lastRenderedTick = frame.renderTick;
    const { app } = this.pixi;
    this.renderer.resize(app.screen);
    this.renderer.render(frame, this.store.ownPlayerId, this.dependencies.hudInputs(), () => app.render());
  }

  /** The `window.__evolutionDebug` mirror for a live room. */
  debugApi(): EvolutionDebugApi {
    return {
      mode: EVOLUTION_DEBUG_MODE.live,
      pause: () => this.gate.pause(),
      resume: () => this.gate.resume(),
      step: (frames) => this.gate.step(frames),
      setSeed: () => false,
      isPaused: () => this.gate.isPaused(),
      renderTick: () => this.lastRenderedTick,
      // Slice D (#208) returns the last frame-budget report here.
      performanceReport: () => null,
    };
  }

  private disposeRenderer(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.lastRenderedTick = null;
    if (this.textures !== null) destroyRenderTextures(this.textures);
    this.textures = null;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.audio?.disconnect();
    this.disposeRenderer();
    this.pixi?.destroy();
    this.pixi = null;
  }
}
