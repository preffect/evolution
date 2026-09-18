// The encyclopedia's live preview (docs/architecture/encyclopedia.md §12.7): the **real** `GameRenderer` on a
// fixture scene and a local clock, with no room, no snapshot and no socket. The third `FrameLoopSession` beside
// `RenderSession` (a room) and `BenchSession` (the bench route).
//
// **It bakes once per session.** `createRenderTextures` runs synchronously on the render thread (ticket #442
// measures the same bake at about 1.2 s at room entry on this box's software GL), so paying it per entry would
// freeze the page every time the reader turned a page. `start` pays it once and `show` only swaps the scene, which
// is why `PreviewOpenTimings` exists: the open's cost is reported, in three parts, rather than assumed.
//
// It never installs `window.__evolutionDebug` — the room's hook stays in place while the encyclopedia is open over
// it — and its pause is the preview app's own `ticker.stop()`, never the debug `FrameGate`, for the same reason.

import type { BalanceConfig, Clock, ClientPerformanceReport } from '@evolution/shared';
import { EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../../debug/evolution-debug';
import type { RenderFrame } from '../../net/world-store';
import { PREVIEW_GEL_PATCHES, PREVIEW_SEED } from '../constants';
import { FrameLoopSession } from '../frame-loop-session';
import { NO_HUD_INPUTS, type GameRenderer, type RenderOutputs } from '../game-renderer';
import { HALF } from '../geometry';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import {
  cappedPreviewDevicePixelRatio,
  clampedPreviewCanvasSize,
  previewLensSidePx,
  type PreviewSizePx,
} from './preview-canvas';
import { PreviewLocalClock } from './preview-clock';
import { previewRenderFrame } from './preview-frame';
import { previewSceneFor, type PreviewScene } from './preview-scene';
import type { PreviewSpec } from './preview-spec';

export type { PreviewSizePx } from './preview-canvas';
export { cappedPreviewDevicePixelRatio, clampedPreviewCanvasSize } from './preview-canvas';

export interface PreviewSessionDependencies {
  readonly host: HTMLElement;
  /**
   * The **wall** clock (the injected `Clock`, docs/CODE-STANDARDS.md §8): what `PreviewOpenTimings` and the frame
   * instrumentation are measured on. It is never the evidence route's `ManualClock`, or the open would be reported
   * as the zero milliseconds that clock advanced by while the bundle baked.
   */
  readonly clock: Clock;
  /**
   * Where the **scene's** local time comes from; the wall clock unless a caller drives one. The evidence route
   * passes its `ManualClock` here, which is what lets it walk to a tick without waiting out a wall second.
   */
  readonly sceneClock?: Clock;
  /** The display's raw ratio. The session caps it at `PREVIEW_MAX_DEVICE_PIXEL_RATIO` — the one place that happens. */
  readonly devicePixelRatio: number;
  /** The lens's bounding square in CSS px; `resize` is the only other path for it. */
  readonly sizePx: PreviewSizePx;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  /** Read every frame: the live balance, so a patch retimes and reframes a preview as it plays. */
  readonly balance: () => BalanceConfig;
  /** `true` on the evidence route only (`toDataURL` needs it); it copies the framebuffer every frame. */
  readonly shouldPreserveDrawingBuffer: boolean;
  /** The cytoplasm tile's edge: the production size unless a test shrinks it (`RenderTextureOptions`). */
  readonly noiseTileSizePx?: number;
}

/** `openedToFirstFrameMs` split, so a miss over `PREVIEW_OPEN_BUDGET_MS` points at its lever (§12.7's cost table). */
export interface PreviewOpenTimings {
  /** `createPixiApp` alone: the WebGL2 context and Pixi's init, every program compiled again on a new context. */
  readonly initMs: number;
  /** `createRenderTextures` alone: the whole bundle, paid once per session. Nothing else is inside this span. */
  readonly bakeMs: number;
  /** The first instrumented frame alone: texture uploads and shader compiles. */
  readonly firstSubmitMs: number;
  /**
   * The whole open. The three spans above do **not** sum to it: adopting the ticker and building the scene fall
   * between them, deliberately outside all three so each keeps its name. The residual is small next to the bake.
   *
   * It is **submit-side**: the frame ends at `app.render()`, which returns once the GL commands are queued, not
   * once the frame is presented. On a real GPU those differ, so a hardware run understates the open a little.
   */
  readonly openedToFirstFrameMs: number;
}

const NO_SUBMIT = (): void => undefined;

export class PreviewSession extends FrameLoopSession {
  private readonly devicePixelRatio: number;
  private sizePx: PreviewSizePx;
  private scene: PreviewScene | null = null;
  /** The local clock: monotonic for the renderer, restartable in phase for a scene (`preview-clock.ts`). */
  private readonly localClock: PreviewLocalClock;
  /** The scene tick the previous frame drew, so a scene emits each effect once. */
  private previousSceneTick = 0;
  /** The scene tick on screen: what a spec reads to see that `show` restarted the loop. */
  private lastSceneTickValue: number | null = null;
  private lastOutputs: RenderOutputs | null = null;
  /** A caller waiting for the frame report's window to fill (`awaitFrames`); at most one at a time. */
  private frameWindow: { readonly targetFrames: number; readonly resolve: () => void } | null = null;
  private isDestroyed = false;

  constructor(private readonly dependencies: PreviewSessionDependencies) {
    super(dependencies.clock);
    this.localClock = new PreviewLocalClock(dependencies.sceneClock ?? dependencies.clock);
    this.devicePixelRatio = cappedPreviewDevicePixelRatio(dependencies.devicePixelRatio);
    this.sizePx = dependencies.sizePx;
  }

  /**
   * Opens the preview on `spec` and resolves once its first frame is on the canvas, or with `null` when `destroy`
   * ran first — an app that arrives after `destroy` is destroyed on arrival, so no context is leaked toward the
   * browser's cap of 16. §12.7 declares `start()` and leaves the first spec to arrive through `show`; taking it
   * here instead is what makes `openedToFirstFrameMs` a frame that was actually drawn.
   */
  async start(spec: PreviewSpec): Promise<PreviewOpenTimings | null> {
    const openedAtMs = this.nowMs();
    const pixi = await this.dependencies.createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.devicePixelRatio,
      fixedSize: clampedPreviewCanvasSize(this.sizePx, this.devicePixelRatio),
      shouldPreserveDrawingBuffer: this.dependencies.shouldPreserveDrawingBuffer,
    });
    if (this.isDestroyed) {
      pixi.destroy();
      return null;
    }
    const initialisedAtMs = this.nowMs();
    this.adoptPixiApp(pixi);
    if (this.localClock.isPaused) pixi.app.ticker.stop();
    // Each span below brackets exactly the call it is named for, so `bakeMs` is the bundle and nothing else: it is
    // the number a reader weighs lever 2 (skipping the dish-field and light-pool bakes) against.
    const bakeStartedAtMs = this.nowMs();
    this.buildRenderer({
      seed: PREVIEW_SEED,
      gelPatches: PREVIEW_GEL_PATCHES,
      devicePixelRatio: this.devicePixelRatio,
      noiseTileSizePx: this.dependencies.noiseTileSizePx,
    });
    const bakedAtMs = this.nowMs();
    // The scene starts at the end of the open, so the init and the bake are never played out as scene time.
    this.show(spec);
    const firstFrameStartedAtMs = this.nowMs();
    this.frame();
    const firstFrameAtMs = this.nowMs();
    return {
      initMs: initialisedAtMs - openedAtMs,
      bakeMs: bakedAtMs - bakeStartedAtMs,
      firstSubmitMs: firstFrameAtMs - firstFrameStartedAtMs,
      openedToFirstFrameMs: firstFrameAtMs - openedAtMs,
    };
  }

  /**
   * Swaps the scene and restarts its loop; no texture work. Showing the same spec again is the replay.
   *
   * The restart is a **phase change, not a clock change**: the tick the renderer sees keeps climbing, and only the
   * scene's own loop returns to its start. Resetting the clock here would drive `timeSeconds` — and so the
   * renderer's `nowMs` — backwards, and a clip started before the swap would never satisfy
   * `nowMs - startMs >= duration` and so would never be pruned (§12.7, `effects/motion-clip-player.ts`).
   */
  show(spec: PreviewSpec): void {
    this.scene = previewSceneFor(spec);
    this.localClock.restartScene();
    this.previousSceneTick = 0;
  }

  /** The UI pause (reduced motion, a pane without a preview): the preview app's own ticker, never the `FrameGate`. */
  pause(): void {
    if (this.localClock.isPaused) return;
    this.localClock.pause();
    this.pixi?.app.ticker.stop();
  }

  /** Restarts the ticker and re-bases the local clock, so the paused span never plays. */
  resume(): void {
    if (!this.localClock.isPaused) return;
    this.localClock.resume();
    this.pixi?.app.ticker.start();
  }

  get isPaused(): boolean {
    return this.localClock.isPaused;
  }

  /** A `--ui-scale` change: the canvas resizes and the framing follows it; nothing is rebaked. */
  resize(sizePx: PreviewSizePx): void {
    this.sizePx = sizePx;
    this.pixi?.resize(clampedPreviewCanvasSize(sizePx, this.devicePixelRatio));
  }

  /**
   * One frame through the renderer with a **no-op submit**: the clips, the ghost registry and the sprint-ring
   * tracker advance, nothing is drawn and nothing is measured. The evidence route walks to its parked tick with
   * these (a 3 s loop is 180 frames, about 27 minutes of SwiftShader submits otherwise) and submits only the park.
   */
  walkFrame(): void {
    const { renderer, pixi } = this;
    if (renderer === null || pixi === null) return;
    // `frame()` resizes before every instrumented frame; a walk must too, or a walk straddling a `resize` would
    // advance its clips against the previous screen box and be framed differently from the parked frame.
    renderer.resize(pixi.app.screen);
    const frame = this.nextFrame();
    if (frame === null) return;
    this.renderFrame(renderer, frame, NO_SUBMIT);
  }

  /**
   * Resolves once `frames` frames have been **submitted** since the session opened, so a report taken after it has
   * a window to estimate a p95 from rather than the one frame the open drew. Resolves early on `destroy`, so a
   * caller is never left waiting on a session that has gone. Walk frames are not submitted and do not count.
   */
  awaitFrames(frames: number): Promise<void> {
    if (this.instrumentation.frameCount >= frames) return Promise.resolve();
    return new Promise((resolve) => {
      this.frameWindow = { targetFrames: frames, resolve };
    });
  }

  /** The frame report the evidence route writes into the DOM; `null` before the first frame. */
  performanceReport(): ClientPerformanceReport | null {
    return this.lastOutputs === null ? null : this.instrumentation.report(this.lastOutputs, null);
  }

  /** The hook the evidence route alone installs (§12.7); the encyclopedia never calls it. */
  debugApi(): EvolutionDebugApi {
    return {
      ...this.loopDebugMembers(),
      mode: EVOLUTION_DEBUG_MODE.preview,
      step: (frames) => this.gate.step(frames),
      setSeed: () => false,
      performanceReport: () => this.performanceReport(),
    };
  }

  /** The wall clock: what the open timings are measured on. */
  private nowMs(): number {
    return this.dependencies.clock.nowMilliseconds();
  }

  /** The scene tick on screen: the loop phase since the last `show`; `null` before the first frame. */
  get lastSceneTick(): number | null {
    return this.lastSceneTickValue;
  }

  protected nextFrame(): RenderFrame | null {
    const { scene } = this;
    if (scene === null || !this.localClock.isStarted) return null;
    const balance = this.dependencies.balance();
    // The renderer gets the monotonic tick; the scene gets its own loop phase since the last `show`.
    const renderTick = this.localClock.renderTick();
    const sceneTick = this.localClock.sceneTick();
    const sceneFrame = scene.frameAt(sceneTick, this.previousSceneTick, balance);
    this.previousSceneTick = sceneTick;
    this.lastSceneTickValue = sceneTick;
    return previewRenderFrame({ renderTick, scene: sceneFrame, balance });
  }

  /**
   * The scene's framing is applied per frame rather than at `show`: it is read from the live balance, and the zoom
   * is derived from the canvas the session actually has, so a `resize` reframes with no scene change.
   */
  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    const scene = this.scene;
    if (scene !== null && this.pixi !== null) {
      const framing = scene.framing(frame.balance);
      renderer.setFixedZoom((previewLensSidePx(this.pixi.app.screen) * HALF) / framing.viewRadiusWu);
      renderer.parkOn(framing.target);
    }
    return renderer.render(frame, scene?.subjectPlayerId ?? null, NO_HUD_INPUTS, submit);
  }

  protected afterFrame(outputs: RenderOutputs): void {
    this.lastOutputs = outputs;
    const waiting = this.frameWindow;
    if (waiting !== null && this.instrumentation.frameCount >= waiting.targetFrames) {
      this.frameWindow = null;
      waiting.resolve();
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    this.frameWindow?.resolve();
    this.frameWindow = null;
    this.scene = null;
    this.localClock.reset();
    this.lastSceneTickValue = null;
    this.lastOutputs = null;
    this.disposeLoop();
  }
}
