// One room's rendering, from the first `game_state` to the teardown (docs/ARCHITECTURE.md §6):
// creates the Pixi app and the renderer when the round's seed is known, applies every message
// to the store, runs the frame loop on the app's ticker, feeds the audio handle and installs the
// debug hook. `game-setup.ts` builds one and wires the seams. Slice D (#208) adds the frame-budget
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
}

export class RenderSession {
  readonly store: WorldStore;
  readonly gate = new FrameGate();
  private pixi: PixiAppHandle | null = null;
  private textures: RenderTextures | null = null;
  private renderer: GameRenderer | null = null;
  private audio: AudioHooksHandle | null = null;
  /** The tick of the frame on screen: what the debug hook reports, held while paused. */
  private lastRenderedTick: number | null = null;
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

  /** Resolves once the renderer for the current seed exists (tests await it; the app fires and forgets). */
  async ensureRenderer(snapshot: GameSnapshot): Promise<void> {
    if (this.renderer !== null && this.renderer.seed === snapshot.seed) return;
    this.disposeRenderer();
    const pixi = await this.ensurePixiApp();
    if (pixi === null) return;
    this.textures = createRenderTextures({ seed: snapshot.seed, baker: pixi.textures });
    this.renderer = new GameRenderer(pixi.app.stage, this.textures, pixi.app.screen);
  }

  private async ensurePixiApp(): Promise<PixiAppHandle | null> {
    if (this.pixi !== null) return this.pixi;
    const pixi = await this.dependencies.createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.dependencies.devicePixelRatio,
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

  /** One ticker callback: drains the newest snapshot, then renders the store's frame unless the gate holds it. */
  frame(): void {
    if (this.pixi === null || this.renderer === null || !this.gate.claimFrame()) return;
    const message = this.drainLatestSnapshot();
    if (message?.type === SERVER_MESSAGE_TYPE.gameSnapshot && this.store.applySnapshot(message.snapshot)) {
      this.audio?.observe(message.snapshot);
    }
    const frame = this.store.frame();
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
