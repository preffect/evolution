// One room's rendering, from the first `game_state` to the teardown (docs/ARCHITECTURE.md §6):
// creates the Pixi app and the renderer when the round's seed is known, applies every message
// to the store, runs the frame loop on the app's ticker, feeds the audio handle, reports the
// frame budget and installs the debug hook. `game-setup.ts` builds one and wires the seams.

import { PERFORMANCE_REPORT_EVERY_FRAMES } from './constants';
import {
  SERVER_MESSAGE_TYPE,
  type ClientPerformanceReport,
  type Clock,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import type { TransitionOptions } from '../state/snapshot-transitions';
import type { AudioHooksHandle } from '../audio/audio-hooks';
import { FrameGate, EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../debug/evolution-debug';
import { WorldStore } from '../net/world-store';
import { buildPerformanceReport } from './bench/render-benchmark';
import { GameRenderer, type RenderInputs } from './game-renderer';
import { createPixiApp, type PixiAppHandle } from './pixi-app';
import { createRenderTextures } from './render-textures';
import { createDomBakeCanvasFactory } from './textures/texture-bake';

export interface RenderSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly documentReference: Document;
  readonly devicePixelRatio: number;
  readonly connectAudio: (options: TransitionOptions) => AudioHooksHandle;
  readonly reportPerformance: (report: ClientPerformanceReport) => void;
  readonly hudInputs: () => RenderInputs;
}

export class RenderSession {
  readonly store: WorldStore;
  readonly gate = new FrameGate();
  private pixi: PixiAppHandle | null = null;
  private renderer: GameRenderer | null = null;
  private audio: AudioHooksHandle | null = null;
  private frames = 0;
  private lastReport: ClientPerformanceReport | null = null;
  private isDestroyed = false;

  constructor(
    private readonly dependencies: RenderSessionDependencies,
    private readonly drainLatestSnapshot: () => ServerMessage | null,
  ) {
    this.store = new WorldStore(dependencies.clock);
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
      void this.ensureRenderer(message.snapshot);
    } else if (message.type === SERVER_MESSAGE_TYPE.balanceUpdated) {
      this.store.applyBalance(message.balance);
      this.audio?.updateOptions({ balance: message.balance });
    }
  }

  private async ensureRenderer(snapshot: GameSnapshot): Promise<void> {
    if (this.renderer !== null && this.renderer.seed === snapshot.seed) return;
    this.renderer?.destroy();
    this.renderer = null;
    if (this.pixi === null) {
      this.pixi = await createPixiApp({
        host: this.dependencies.host,
        devicePixelRatio: this.dependencies.devicePixelRatio,
      });
      if (this.isDestroyed) return;
      this.pixi.app.ticker.remove(this.pixi.app.render, this.pixi.app);
      this.pixi.app.ticker.add(() => this.frame());
      this.pixi.canvas.addEventListener('pointerdown', () => this.audio?.unlock(), { once: true });
    }
    const textures = createRenderTextures({
      seed: snapshot.seed,
      gelPatches: snapshot.gelPatches,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      factory: createDomBakeCanvasFactory(this.dependencies.documentReference),
    });
    this.renderer = new GameRenderer(this.pixi.app.stage, textures, this.dependencies.clock, this.pixi.app.screen);
  }

  private frame(): void {
    if (this.pixi === null || this.renderer === null || !this.gate.claimFrame()) return;
    const message = this.drainLatestSnapshot();
    if (message?.type === SERVER_MESSAGE_TYPE.gameSnapshot && this.store.applySnapshot(message.snapshot)) {
      this.audio?.observe(message.snapshot);
    }
    const frame = this.store.frame();
    if (frame === null) return;
    const { app } = this.pixi;
    this.renderer.resize(app.screen);
    const outputs = this.renderer.render(frame, this.store.ownPlayerId, this.dependencies.hudInputs(), () =>
      app.render(),
    );
    this.frames += 1;
    if (this.frames % PERFORMANCE_REPORT_EVERY_FRAMES === 0) {
      this.lastReport = buildPerformanceReport(this.renderer.timer.report(), {
        drawCalls: 0,
        visibleCells: outputs.visibleCells,
        visibleMotes: outputs.visibleMotes,
        gpuMs: null,
        heapBytes: null,
      });
      this.dependencies.reportPerformance(this.lastReport);
    }
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
      renderTick: () => this.store.frame()?.renderTick ?? null,
      performanceReport: () => this.lastReport,
    };
  }

  destroy(): void {
    this.isDestroyed = true;
    this.audio?.disconnect();
    this.renderer?.destroy();
    this.pixi?.destroy();
    this.renderer = null;
    this.pixi = null;
  }
}
