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

import {
  MILLISECONDS_PER_SECOND,
  TICK_INTERVAL_S,
  type BalanceConfig,
  type Clock,
  type ClientPerformanceReport,
} from '@evolution/shared';
import { EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../../debug/evolution-debug';
import type { RenderFrame } from '../../net/world-store';
import { PREVIEW_CANVAS_MAX_PX, PREVIEW_GEL_PATCHES, PREVIEW_MAX_DEVICE_PIXEL_RATIO, PREVIEW_SEED } from '../constants';
import { FrameLoopSession } from '../frame-loop-session';
import { NO_HUD_INPUTS, type GameRenderer, type RenderOutputs } from '../game-renderer';
import { HALF } from '../geometry';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import { previewRenderFrame } from './preview-frame';
import { previewSceneFor, type PreviewScene } from './preview-scene';
import type { PreviewSpec } from './preview-spec';

export interface PreviewSizePx {
  readonly width: number;
  readonly height: number;
}

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
  /** `createPixiApp`: the WebGL2 context and Pixi's init, every program compiled again on a new context. */
  readonly initMs: number;
  /** `createRenderTextures`: the whole bundle, paid once per session. */
  readonly bakeMs: number;
  /** The first frame: texture uploads and shader compiles. */
  readonly firstSubmitMs: number;
  readonly openedToFirstFrameMs: number;
}

/** The capped ratio the preview renders **and** bakes at, so a 3× display bakes 2× atlases for its 2× canvas. */
export function cappedPreviewDevicePixelRatio(devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, PREVIEW_MAX_DEVICE_PIXEL_RATIO);
}

/** The canvas in CSS px, each side clamped so no side exceeds `PREVIEW_CANVAS_MAX_PX` **device** pixels. */
export function clampedPreviewCanvasSize(sizePx: PreviewSizePx, cappedDevicePixelRatio: number): PreviewSizePx {
  const maximumCssPx = PREVIEW_CANVAS_MAX_PX / cappedDevicePixelRatio;
  return { width: Math.min(sizePx.width, maximumCssPx), height: Math.min(sizePx.height, maximumCssPx) };
}

const NO_SUBMIT = (): void => undefined;

export class PreviewSession extends FrameLoopSession {
  /** The scene's clock; the wall clock unless a caller drives its own (the evidence route's walk). */
  private readonly sceneClock: Clock;
  private readonly devicePixelRatio: number;
  private sizePx: PreviewSizePx;
  private scene: PreviewScene | null = null;
  /** The local clock's origin: `nowMilliseconds()` when the current scene started playing. */
  private shownAtMs: number | null = null;
  /** The tick the previous frame drew, so a scene emits each effect once. */
  private previousTick = 0;
  /** When the ticker was stopped, so `resume` can re-base the origin by exactly the paused span. */
  private pausedAtMs: number | null = null;
  private lastOutputs: RenderOutputs | null = null;
  /** A caller waiting for the frame report's window to fill (`awaitFrames`); at most one at a time. */
  private frameWindow: { readonly targetFrames: number; readonly resolve: () => void } | null = null;
  private isDestroyed = false;

  constructor(private readonly dependencies: PreviewSessionDependencies) {
    super(dependencies.clock);
    this.sceneClock = dependencies.sceneClock ?? dependencies.clock;
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
    if (this.pausedAtMs !== null) pixi.app.ticker.stop();
    this.buildRenderer({
      seed: PREVIEW_SEED,
      gelPatches: PREVIEW_GEL_PATCHES,
      devicePixelRatio: this.devicePixelRatio,
      noiseTileSizePx: this.dependencies.noiseTileSizePx,
    });
    const bakedAtMs = this.nowMs();
    // The scene starts at the end of the open, so the init and the bake are never played out as scene time.
    this.show(spec);
    this.frame();
    const firstFrameAtMs = this.nowMs();
    return {
      initMs: initialisedAtMs - openedAtMs,
      bakeMs: bakedAtMs - initialisedAtMs,
      firstSubmitMs: firstFrameAtMs - bakedAtMs,
      openedToFirstFrameMs: firstFrameAtMs - openedAtMs,
    };
  }

  /** Swaps the scene and restarts its loop; no texture work. Showing the same spec again is the replay. */
  show(spec: PreviewSpec): void {
    this.scene = previewSceneFor(spec);
    this.shownAtMs = this.sceneNowMs();
    this.previousTick = 0;
    // A scene shown while paused starts when it is shown, so `resume` adds only the span since the swap.
    if (this.pausedAtMs !== null) this.pausedAtMs = this.shownAtMs;
  }

  /** The UI pause (reduced motion, a pane without a preview): the preview app's own ticker, never the `FrameGate`. */
  pause(): void {
    if (this.pausedAtMs !== null) return;
    this.pausedAtMs = this.sceneNowMs();
    this.pixi?.app.ticker.stop();
  }

  /** Restarts the ticker and re-bases the local clock, so the paused span never plays. */
  resume(): void {
    const { pausedAtMs } = this;
    if (pausedAtMs === null) return;
    this.pausedAtMs = null;
    if (this.shownAtMs !== null) this.shownAtMs += this.sceneNowMs() - pausedAtMs;
    this.pixi?.app.ticker.start();
  }

  get isPaused(): boolean {
    return this.pausedAtMs !== null;
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
    const { renderer } = this;
    if (renderer === null) return;
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

  /** The scene's clock: what its local time is measured on, and what a pause re-bases. */
  private sceneNowMs(): number {
    return this.sceneClock.nowMilliseconds();
  }

  /** The preview's local tick: monotonic, never wrapped, and zero at the moment the scene was shown. */
  private localTick(shownAtMs: number): number {
    return (this.sceneNowMs() - shownAtMs) / MILLISECONDS_PER_SECOND / TICK_INTERVAL_S;
  }

  protected nextFrame(): RenderFrame | null {
    const { scene, shownAtMs } = this;
    if (scene === null || shownAtMs === null) return null;
    const balance = this.dependencies.balance();
    const tick = this.localTick(shownAtMs);
    const sceneFrame = scene.frameAt(tick, this.previousTick, balance);
    this.previousTick = tick;
    return previewRenderFrame({ tick, scene: sceneFrame, balance });
  }

  /**
   * The scene's framing is applied per frame rather than at `show`: it is read from the live balance, and the zoom
   * is derived from the canvas the session actually has, so a `resize` reframes with no scene change.
   */
  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    const scene = this.scene;
    if (scene !== null && this.pixi !== null) {
      const framing = scene.framing(frame.balance);
      renderer.setFixedZoom((this.pixi.app.screen.height * HALF) / framing.viewRadiusWu);
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
    this.shownAtMs = null;
    this.lastOutputs = null;
    this.disposeLoop();
  }
}
