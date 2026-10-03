// The opening dive on the lobby (docs/rendering/opening-dive.md §1): the fourth `FrameLoopSession`, beside a room's,
// the bench's and the encyclopedia preview's. The upper bands draw on the mockup's canvas (`DiveMacroBand`). This
// session's Pixi app clears to transparent and draws the planet (`DivePlanetBand`) and the shore (`shore/`) under it, and the **real** `GameRenderer` on a scripted dish scene at the bottom, clipped to the
// dish's wall while the slime shows and faded in by the band table (the canvas's opacity, a browser-composited fade).
// The renderer's textures bake across frames (ticket #479) while the upper bands draw, so the lobby never freezes; its
// warm-up draw goes through `renderFrame` (ticket #603). It never installs `window.__evolutionDebug`. `destroy` frees
// the planet, then the renderer's textures and the app in ticket #468's order (`disposeLoop`).

import {
  DISH_CENTRE_TARGET,
  MILLISECONDS_PER_SECOND,
  type BalanceConfig,
  type Clock,
  type Scheduler,
} from '@evolution/shared';
import { Container, Graphics, type Application } from 'pixi.js';
import {
  DIVE_AUTOPLAY_DELAY_MS,
  DIVE_CANVAS_TEST_ID,
  DIVE_MAX_DEVICE_PIXEL_RATIO,
  DIVE_PROBE_FRAME_MS,
} from '../constants';
import { OWN_CELL_CHROME } from '../effects/own-cell-indicators-layer';
import { FrameLoopSession } from '../frame-loop-session';
import type { GameRenderer } from '../game-renderer';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import { NO_HUD_INPUTS, outputsBeforeAnyFrame, type RenderInputs, type RenderOutputs } from '../render-io';
import type { RenderFrame } from '../../net/world-store';
import { diveRendererZoom } from './dive-camera';
import { DiveControls } from './dive-controls';
import { clipDiveRendererToDish } from './dive-dish-clip';
import { DiveFrameTimes, type DiveFrameTimesReport } from './dive-frame-times';
import { DiveGlobeIdle } from './dive-globe-idle';
import type { DiveUpperBandsLoader } from './dive-macro-band';
import { DIVE_OWN_PLAYER_ID, createDiveMicroScene, diveTextureOptions } from './dive-micro-scene';
import { openDiveHalves } from './dive-session-open';
import { DiveUpperLayers } from './dive-upper-layers';
import { diveViewAt, isSameViewport, type DiveView } from './dive-view';

export interface DiveSessionDependencies {
  readonly host: HTMLElement;
  /** The injected wall clock: the fall, the ambient motion and the frame times are all read on it. */
  readonly clock: Clock;
  /** The injected scheduler the planet's coastlines and the upper bands' tiles bake on (docs/CODE-STANDARDS.md §8). */
  readonly scheduler: Scheduler;
  readonly devicePixelRatio: number;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly loadUpperBands: DiveUpperBandsLoader;
  readonly balance: () => BalanceConfig;
  readonly isMotionReduced: () => boolean;
  /** Each frame drawn: what the panel's readout, labels and slider show. */
  readonly onView: (view: DiveView) => void;
  /** The cytoplasm tile's edge: the production size unless a test shrinks it (`RenderTextureOptions`). */
  readonly noiseTileSizePx?: number;
}

const NO_EXTENT = { minX: 0, minY: 0, maxX: 0, maxY: 0 } as const;

export class DiveSession extends FrameLoopSession {
  readonly controls = new DiveControls();
  readonly frameTimes: DiveFrameTimes;
  private readonly scene = createDiveMicroScene();
  private readonly devicePixelRatio: number;
  /** The renderer's layers, clipped to the dish while the slime round it shows. */
  private readonly gameRoot = new Container();
  private readonly dishClip = new Graphics();
  private upper: DiveUpperLayers | null = null;
  private view: DiveView | null = null;
  private lastOutputs: RenderOutputs | null = null;
  private openedAtMs = 0;
  private ambientSeconds = 0;
  private readonly globeIdle = new DiveGlobeIdle();
  private isFrameRequested = true;
  private isDestroyed = false;
  /** The stage's last reported visibility: the panel's observer can report before the app exists. */
  private isVisible = true;

  constructor(private readonly dependencies: DiveSessionDependencies) {
    super(dependencies.clock);
    this.devicePixelRatio = Math.min(dependencies.devicePixelRatio, DIVE_MAX_DEVICE_PIXEL_RATIO);
    this.frameTimes = new DiveFrameTimes(dependencies.clock);
  }

  /**
   * Opens the app and loads the upper bands (`openDiveHalves`), then starts the renderer's staged bake. Answers
   * `false`, never throws, when either half fails or `destroy` ran first, and the lobby carries on without it.
   */
  async start(): Promise<boolean> {
    const { dependencies } = this;
    const halves = await openDiveHalves(dependencies, this.devicePixelRatio, {
      nowMs: () => this.nowMs(),
      isCancelled: () => this.isDestroyed,
    });
    if (halves === null) return false;
    const { pixi, bands } = halves;
    this.adoptPixiApp(pixi);
    if (!this.isVisible) pixi.app.ticker.stop();
    pixi.canvas.dataset['testid'] = DIVE_CANVAS_TEST_ID;
    pixi.app.stage.addChild(this.gameRoot, this.dishClip);
    this.upper = new DiveUpperLayers({
      bands,
      host: dependencies.host,
      stage: pixi.app.stage,
      clock: dependencies.clock,
      frameTimes: this.frameTimes,
      renderToTexture: (container, target) => pixi.renderToTexture(container, target),
      devicePixelRatio: this.devicePixelRatio,
    });
    this.upper.bakeOn(dependencies.scheduler, () => this.requestFrame());
    this.showGame(0);
    this.openedAtMs = this.nowMs();
    this.controls.scheduleAutoplay(this.openedAtMs + DIVE_AUTOPLAY_DELAY_MS);
    // A failed bake leaves the dive on its upper bands: the lobby must never break on it.
    void this.buildRendererAcrossFrames(diveTextureOptions(dependencies.noiseTileSizePx)).then(
      () => this.requestFrame(),
      () => this.requestFrame(),
    );
    return true;
  }

  protected override rendererStage(_app: Application): Container {
    return this.gameRoot;
  }

  /** A control changed or a bake landed: a still dive draws once more. */
  requestFrame(): void {
    this.isFrameRequested = true;
  }

  /** The stage changed size: the app follows at once (Pixi's `resizeTo` measures only on a window resize, #805). */
  resizeStage(sizePx: { readonly width: number; readonly height: number }): void {
    this.pixi?.resize(sizePx);
    this.requestFrame();
  }

  /** Off screen: the ticker stops and nothing draws until it is back. Kept for `start` when it comes first. */
  setIsVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    if (isVisible) this.pixi?.app.ticker.start();
    else this.pixi?.app.ticker.stop();
  }

  private nowMs(): number {
    return this.dependencies.clock.nowMilliseconds();
  }

  /**
   * The evidence probe (docs/rendering/opening-dive.md §6): `frames` frames at `zoom` drawn back to back in one task,
   * the ambient time a 60th of a second on each, so a band's script ms is its own work and never a wait on the GPU
   * process for an earlier frame. Answers their means; the dive stays at `zoom`.
   */
  probeFrames(zoom: number, frames: number): DiveFrameTimesReport {
    this.controls.scrub(zoom);
    this.frameTimes.take();
    for (let frame = 0; frame < frames; frame += 1) {
      // The ambient time is read off the open, so moving the open back moves the scene on.
      this.openedAtMs -= DIVE_PROBE_FRAME_MS;
      this.requestFrame();
      this.frame();
    }
    return this.frameTimes.take();
  }

  /** One animation frame: through the renderer, or the upper bands alone while it bakes. */
  override frame(): void {
    super.frame();
    if (this.renderer === null) this.upperBandsOnlyFrame();
  }

  /** Before the renderer is current: the upper bands and the planet draw on their own, with no dish. */
  private upperBandsOnlyFrame(): void {
    const view = this.advanceView();
    const pixi = this.pixi;
    if (view === null || pixi === null) return;
    const isUpperShown = this.drawUpperBands(view);
    this.gameRoot.visible = false;
    this.showGame(isUpperShown ? 1 : 0);
    if (isUpperShown) this.frameTimes.measureSubmit(() => pixi.app.render());
    this.finishFrame(view);
  }

  /**
   * The game's canvas at `opacity`: 1 while it shows the planet or the shore, the dish band's weight at the bottom. The browser
   * composites it, so the dish's fade is the whole dish's (a group alpha), and at 0 the canvas is neither drawn nor
   * seen.
   */
  private showGame(opacity: number): void {
    if (this.pixi !== null) this.pixi.canvas.style.opacity = String(opacity);
  }

  /** The zoom and the ambient time for this frame; `null` when a still dive has nothing new to draw. */
  private advanceView(): DiveView | null {
    const pixi = this.pixi;
    if (pixi === null) return null;
    const nowMs = this.nowMs();
    const isMotionReduced = this.dependencies.isMotionReduced();
    this.settleControls(nowMs, isMotionReduced);
    const isMoving = this.controls.isPlaying && !this.controls.isPaused;
    const zoom = this.controls.tick(nowMs, this.upper?.fallFloorZoom);
    if (!isMotionReduced) this.ambientSeconds = (nowMs - this.openedAtMs) / MILLISECONDS_PER_SECOND;
    this.globeIdle.advance({ nowMs, zoom, isMotionReduced, isPaused: this.controls.isPaused });
    const viewport = { width: pixi.app.screen.width, height: pixi.app.screen.height };
    const hasResized = this.view === null || !isSameViewport(this.view.camera.viewport, viewport);
    if (isMotionReduced && !isMoving && !this.isFrameRequested && !hasResized) return null;
    this.isFrameRequested = false;
    this.view = diveViewAt({
      zoom,
      viewport,
      timeSeconds: this.ambientSeconds,
      isMoving,
      globeIdleSpinDegrees: this.globeIdle.spinDegrees,
    });
    return this.view;
  }

  /**
   * The lobby's autoplay once its time comes and the tiles have baked, and reduced motion asked for mid-fall: the
   * opening jumps to its stop at once, paused or not.
   */
  private settleControls(nowMs: number, isMotionReduced: boolean): void {
    this.controls.autoplay(nowMs, isMotionReduced, this.upper?.isBaked ?? false);
    if (isMotionReduced) this.controls.finishPlay();
  }

  /** The layers above the dish; answers whether the planet or the shore shows on the game's canvas. */
  private drawUpperBands(view: DiveView): boolean {
    const upper = this.upper;
    if (upper === null) return false;
    return upper.draw(view, {
      screenRatio: this.devicePixelRatio,
      nowMs: this.nowMs(),
      isMotionReduced: this.dependencies.isMotionReduced(),
    });
  }

  protected nextFrame(): RenderFrame | null {
    // The staged renderer's warm-up asks for a frame off the stage: the view on screen, never a new one.
    const view = this.isBuildingRenderer ? this.view : this.advanceView();
    if (view === null) return null;
    return this.scene.frameAt(view.timeSeconds, this.dependencies.balance());
  }

  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    const view = this.view;
    if (view === null) return outputsBeforeAnyFrame(NO_EXTENT);
    const isWarmUp = this.isBuildingRenderer;
    const timedSubmit = (): void => this.frameTimes.measureSubmit(submit);
    const dish = view.bands.dish;
    if (!isWarmUp) {
      const isUpperShown = this.drawUpperBands(view);
      this.gameRoot.visible = dish.isActive;
      this.showGame(isUpperShown ? 1 : dish.isActive ? dish.weight : 0);
      // Above the dish band the renderer does no work at all: the canvas shows the planet and the shore, or nothing.
      if (!dish.isActive) {
        if (isUpperShown) timedSubmit();
        return outputsBeforeAnyFrame(NO_EXTENT);
      }
    }
    clipDiveRendererToDish(this.gameRoot, this.dishClip, view);
    renderer.setFixedZoom(diveRendererZoom(view.camera));
    renderer.parkOn(DISH_CENTRE_TARGET);
    const inputs: RenderInputs = {
      ...NO_HUD_INPUTS,
      ownCellIndicators: this.scene.ownCellIndicators(frame),
      ownCellChrome: OWN_CELL_CHROME.lens,
      // The dive's end is on your cell, not the vent under it, and its bacteria grow from specks into cells with no
      // far-dot halo between (docs/rendering/opening-dive.md §4).
      isVentShown: false,
      isFarDotShown: false,
    };
    return this.frameTimes.measureDish(() => renderer.render(frame, DIVE_OWN_PLAYER_ID, inputs, timedSubmit));
  }

  /** What the renderer answered for the last frame drawn through it: what it culled to, and the dish's counts. */
  get lastRenderOutputs(): RenderOutputs | null {
    return this.lastOutputs;
  }

  protected afterFrame(outputs: RenderOutputs): void {
    this.lastOutputs = outputs;
    if (this.view !== null) this.finishFrame(this.view);
  }

  private finishFrame(view: DiveView): void {
    this.frameTimes.endFrame();
    this.dependencies.onView(view);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.gameRoot.mask = null;
    this.upper?.destroy();
    this.upper = null;
    this.view = null;
    this.disposeLoop();
  }
}
