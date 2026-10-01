// The opening dive on the lobby (docs/rendering/opening-dive.md §1): the fourth `FrameLoopSession`, beside a room's,
// the bench's and the encyclopedia preview's. The upper bands draw on the mockup's own canvas (`DiveMacroBand`); over
// it, the session's Pixi app clears to transparent and draws the **real** `GameRenderer` on a scripted dish scene,
// clipped to the dish's outer wall while the slime round it shows, and faded in by the band table as the dark field
// arrives (the canvas's opacity, so the browser composites the fade).
//
// The renderer's textures bake across frames (ticket #479) while the upper bands already draw, so the lobby never
// freezes on the bake; its warm-up draw goes through `renderFrame` like any other session's (ticket #603). It never
// installs `window.__evolutionDebug`. `destroy` frees the renderer's textures and the app in ticket #468's order
// (`disposeLoop`) and gives the planet's WebGL context back.

import {
  DISH_CENTRE_TARGET,
  MILLISECONDS_PER_SECOND,
  type BalanceConfig,
  type Clock,
  type Scheduler,
} from '@evolution/shared';
import { Container, Graphics, type Application } from 'pixi.js';
import { hexToNumber } from '../colour';
import {
  DIVE_AUTOPLAY_DELAY_MS,
  DIVE_BAKE_DEVICE_PIXEL_RATIO,
  DIVE_CANVAS_TEST_ID,
  DIVE_MAX_DEVICE_PIXEL_RATIO,
  DIVE_PROBE_FRAME_MS,
  DIVE_SEED,
  WHITE,
} from '../constants';
import { OWN_CELL_CHROME } from '../effects/own-cell-indicators-layer';
import { FrameLoopSession } from '../frame-loop-session';
import type { GameRenderer } from '../game-renderer';
import { HALF } from '../geometry';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import { NO_HUD_INPUTS, outputsBeforeAnyFrame, type RenderInputs, type RenderOutputs } from '../render-io';
import type { RenderFrame } from '../../net/world-store';
import { DIVE_DISH_CLIP_RADIUS_WU, isMockupDrawing } from './dive-bands';
import { diveRendererZoom } from './dive-camera';
import { DiveControls } from './dive-controls';
import { DiveFrameTimes, type DiveFrameTimesReport } from './dive-frame-times';
import { DiveMacroBand, type MockupBandsLoader } from './dive-macro-band';
import { DIVE_OWN_PLAYER_ID, createDiveMicroScene } from './dive-micro-scene';
import { diveViewAt, isSameViewport, mockupFrameOf, type DiveView } from './dive-view';

export interface DiveSessionDependencies {
  readonly host: HTMLElement;
  /** The injected wall clock: the fall, the ambient motion and the frame times are all read on it. */
  readonly clock: Clock;
  /** The injected scheduler the upper bands' tiles bake on (`SCHEDULER`, docs/CODE-STANDARDS.md §8). */
  readonly scheduler: Scheduler;
  readonly devicePixelRatio: number;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly loadMockupBands: MockupBandsLoader;
  readonly balance: () => BalanceConfig;
  readonly isMotionReduced: () => boolean;
  /** Each frame drawn: what the panel's readout, labels and slider show. */
  readonly onView: (view: DiveView) => void;
  /** The cytoplasm tile's edge: the production size unless a test shrinks it (`RenderTextureOptions`). */
  readonly noiseTileSizePx?: number;
}

const NO_EXTENT = { minX: 0, minY: 0, maxX: 0, maxY: 0 } as const;
const FULFILLED = 'fulfilled';

export class DiveSession extends FrameLoopSession {
  readonly controls = new DiveControls();
  readonly frameTimes: DiveFrameTimes;
  private readonly scene = createDiveMicroScene();
  private readonly devicePixelRatio: number;
  /** The renderer's layers, clipped to the dish while the slime round it shows. */
  private readonly gameRoot = new Container();
  private readonly dishClip = new Graphics();
  private macro: DiveMacroBand | null = null;
  private view: DiveView | null = null;
  private lastOutputs: RenderOutputs | null = null;
  private openedAtMs = 0;
  private ambientSeconds = 0;
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
   * Opens the app and loads the upper bands, then starts the renderer's staged bake. Answers `false`, never throws,
   * when either half fails (no WebGL, a missing coastline, the chunk) or `destroy` ran first: the half that did
   * arrive is given back at once, so nothing outlives a dive that never opened, and the lobby carries on without it.
   */
  async start(): Promise<boolean> {
    const { dependencies } = this;
    const [pixiResult, bandsResult] = await Promise.allSettled([
      dependencies.createPixiApp({
        host: dependencies.host,
        devicePixelRatio: this.devicePixelRatio,
        shouldPreserveDrawingBuffer: false,
        isTransparent: true,
      }),
      dependencies.loadMockupBands(() => this.nowMs()),
    ]);
    const pixi = pixiResult.status === FULFILLED ? pixiResult.value : null;
    const bands = bandsResult.status === FULFILLED ? bandsResult.value : null;
    if (this.isDestroyed || pixi === null || bands === null) {
      pixi?.destroy();
      bands?.release();
      return false;
    }
    this.macro = new DiveMacroBand(bands, dependencies.host);
    this.macro.bakeOn(dependencies.scheduler, () => this.requestFrame());
    this.adoptPixiApp(pixi);
    if (!this.isVisible) pixi.app.ticker.stop();
    pixi.canvas.dataset['testid'] = DIVE_CANVAS_TEST_ID;
    pixi.app.stage.addChild(this.gameRoot, this.dishClip);
    this.showGame(0);
    this.openedAtMs = this.nowMs();
    this.controls.scheduleAutoplay(this.openedAtMs + DIVE_AUTOPLAY_DELAY_MS);
    const options = {
      seed: DIVE_SEED,
      gelPatches: [],
      // At the atlases' highest ratio whatever the screen's, so your cell holds its detail down to the dive's bottom.
      devicePixelRatio: DIVE_BAKE_DEVICE_PIXEL_RATIO,
      noiseTileSizePx: dependencies.noiseTileSizePx,
      // with the vent sprite hidden (renderFrame), the field's warm vent tint goes too: your cell is the dive's end
      isVentTinted: false,
    };
    // A failed bake leaves the dive on its upper bands: the lobby must never break on it.
    void this.buildRendererAcrossFrames(options).then(
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

  /** Before the renderer is current: the upper bands draw on their own, under an empty canvas. */
  private upperBandsOnlyFrame(): void {
    const view = this.advanceView();
    if (view === null) return;
    this.drawUpperBands(view);
    this.finishFrame(view);
  }

  /**
   * The game's canvas over the upper bands at `opacity`: the dish band's weight. The browser composites it, so the
   * fade is the whole dish's (a group alpha), and at 0 the canvas is neither drawn nor seen.
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
    const zoom = this.controls.tick(nowMs);
    if (!isMotionReduced) this.ambientSeconds = (nowMs - this.openedAtMs) / MILLISECONDS_PER_SECOND;
    const viewport = { width: pixi.app.screen.width, height: pixi.app.screen.height };
    const hasResized = this.view === null || !isSameViewport(this.view.camera.viewport, viewport);
    if (isMotionReduced && !isMoving && !this.isFrameRequested && !hasResized) return null;
    this.isFrameRequested = false;
    this.view = diveViewAt({ zoom, viewport, timeSeconds: this.ambientSeconds, isMoving });
    return this.view;
  }

  /**
   * The lobby's autoplay once its time comes and the tiles have baked, and reduced motion asked for mid-fall: the
   * opening jumps to its stop at once, paused or not.
   */
  private settleControls(nowMs: number, isMotionReduced: boolean): void {
    this.controls.autoplay(nowMs, isMotionReduced, this.macro?.isBaked ?? false);
    if (isMotionReduced) this.controls.finishPlay();
  }

  private drawUpperBands(view: DiveView): void {
    const macro = this.macro;
    if (macro === null) return;
    const isDrawing = isMockupDrawing(view.bands);
    this.frameTimes.measureUpperBands(() => macro.draw(mockupFrameOf(view, this.devicePixelRatio), isDrawing));
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
    if (!isWarmUp) this.drawUpperBands(view);
    const dish = view.bands.dish;
    if (!isWarmUp) this.showGame(dish.isActive ? dish.weight : 0);
    // Above the dish band the renderer does no work at all: its canvas is not shown, so it is not drawn.
    if (!dish.isActive && !isWarmUp) return outputsBeforeAnyFrame(NO_EXTENT);
    this.clipToDish(view);
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

  /** The renderer is clipped to the dish's wall while the slime round it shows; inside the dish, not at all. */
  private clipToDish(view: DiveView): void {
    this.dishClip.clear();
    if (!view.bands.slime.isActive) {
      this.gameRoot.mask = null;
      return;
    }
    const { width, height } = view.camera.viewport;
    const radiusPx = DIVE_DISH_CLIP_RADIUS_WU * diveRendererZoom(view.camera);
    this.dishClip.circle(width * HALF, height * HALF, radiusPx).fill(hexToNumber(WHITE));
    this.gameRoot.mask = this.dishClip;
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
    this.macro?.destroy();
    this.macro = null;
    this.view = null;
    this.disposeLoop();
  }
}
