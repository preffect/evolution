// The coast and the shore on the GPU (docs/rendering/opening-dive.md §4, ticket #801): the band from where the coast
// fades in over the planet (zoom 4.85) down to the kelp's blade (−1.42), on a Pixi canvas of its own between the
// planet's canvas and the kelp's. Its tiles bake once a page and its levels of detail as the camera nears them, a few
// milliseconds at a time on the scheduler; each frame it draws one quad: the baked level, the next one crossfading
// in, and the live sea (`shore-mesh.ts`). Before PR #801 the mockup drew all of it on Canvas 2D every frame, and its
// zone layers cost seconds a frame on a box without a GPU.

import type { CancelDeferredCall, Scheduler } from '@evolution/shared';
import type { PixiAppHandle } from '../../pixi-app';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { DIVE_SHORE_CANVAS_TEST_ID, SHORE_LAND_FILL, SHORE_LOD } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexToRgb } from '../../colour';
import type { DiveView } from '../dive-view';
import { shoreLiveFrame } from './shore-live';
import { shoreLevelProgress } from './shore-lod';
import { ShoreLevels } from './shore-levels';
import { ShoreMesh, type ShoreLevelTextures, type ShoreTileTextures } from './shore-mesh';
import type { ShoreSnapshotSources } from './shore-snapshot';
import type { ShoreTiles } from './shore-tiles';
import { SHORE_LEVEL_UPLOADER, liveTileTextures, releaseTileTextures } from './shore-textures';

/** What the band bakes from: the snapshot's sources, its tiles the pumped set. */
export interface DiveShoreSources extends ShoreSnapshotSources {
  readonly tiles: ShoreTiles;
}

export class DiveShoreBand {
  private readonly mesh = new ShoreMesh({
    foam: hexToRgb(SHORE_PALETTE.foam),
    land: hexToRgb(SHORE_LAND_FILL),
    sea: hexToRgb(SHORE_PALETTE.seaDeep),
  });
  private readonly levels: ShoreLevels<ShoreLevelTextures>;
  private tileTextures: ShoreTileTextures | null = null;
  private cancelBake: CancelDeferredCall | null = null;
  private bakeLoop: {
    readonly scheduler: Scheduler;
    readonly onBaked: () => void;
    readonly nowMs: () => number;
  } | null = null;
  private lastZoom: number = SHORE_LOD.topZoom;
  private direction = 1;

  constructor(
    private readonly pixi: PixiAppHandle,
    private readonly sources: DiveShoreSources,
    private readonly devicePixelRatio: number,
  ) {
    this.levels = new ShoreLevels(sources, SHORE_LEVEL_UPLOADER);
    pixi.canvas.dataset['testid'] = DIVE_SHORE_CANVAS_TEST_ID;
    // drawn by `draw` alone, never by the app's own ticker
    pixi.app.ticker.stop();
    pixi.app.stage.addChild(this.mesh.mesh);
    pixi.canvas.hidden = true;
    this.warmUp();
  }

  /**
   * Draws the quad once, unseen, so its program compiles and links while the lobby opens rather than on the first
   * frame of the fall: on a software GPU the link of this shader blocks the page for seconds.
   */
  private warmUp(): void {
    this.mesh.mesh.visible = true;
    this.pixi.app.render();
    this.mesh.mesh.visible = false;
  }

  get canvas(): HTMLCanvasElement {
    return this.pixi.canvas;
  }

  /** The tiles have baked and the top level has: the dive can start falling into the band. */
  get isReady(): boolean {
    return this.sources.tiles.isBaked && this.levels.isBakedAt(SHORE_LOD.topZoom);
  }

  /** Bakes the tiles, then the levels near the camera, a slice every interval while there is work (`DiveMacroBand`'s pace). */
  bakeOn(scheduler: Scheduler, nowMs: () => number, onBaked: () => void): void {
    this.bakeLoop = { scheduler, onBaked, nowMs };
    this.levels.focus(SHORE_LOD.topZoom, 1);
    this.levels.setStage(
      { width: this.pixi.app.screen.width, height: this.pixi.app.screen.height },
      this.devicePixelRatio,
    );
    this.cancelBake = scheduler.after(DIVE_BAKE_START_DELAY_MS, () => this.slice());
  }

  private get hasWork(): boolean {
    return !this.sources.tiles.isBaked || this.levels.hasWork;
  }

  private slice(): void {
    const loop = this.bakeLoop;
    this.cancelBake = null;
    if (loop === null) return;
    const hasFinished = this.sources.tiles.isBaked
      ? this.levels.pump(DIVE_BAKE_BUDGET_MS, loop.nowMs)
      : this.sources.tiles.pump(DIVE_BAKE_BUDGET_MS, loop.nowMs);
    if (hasFinished) loop.onBaked();
    if (this.hasWork) this.cancelBake = loop.scheduler.after(DIVE_BAKE_INTERVAL_MS, () => this.slice());
  }

  /** New work after the slices stopped (the camera moved toward an unbaked level): they start again. */
  private wake(): void {
    const loop = this.bakeLoop;
    if (loop === null || this.cancelBake !== null || !this.hasWork) return;
    this.cancelBake = loop.scheduler.after(DIVE_BAKE_INTERVAL_MS, () => this.slice());
  }

  private follow(view: DiveView): void {
    const zoom = view.camera.zoom;
    if (zoom !== this.lastZoom) this.direction = zoom < this.lastZoom ? 1 : -1;
    this.lastZoom = zoom;
    this.levels.setStage(view.camera.viewport, this.devicePixelRatio);
    this.levels.focus(zoom, this.direction);
    this.wake();
  }

  /** One frame: hidden above and below the band; otherwise the level in view, crossfaded, with the live sea. */
  draw(view: DiveView, isForestShown: boolean): void {
    const shore = view.bands.shore;
    this.pixi.canvas.hidden = !shore.isActive;
    if (!shore.isActive) return;
    this.follow(view);
    if (this.tileTextures === null) {
      this.tileTextures = liveTileTextures(this.sources.tiles);
      if (this.tileTextures !== null) this.mesh.setTiles(this.tileTextures);
    }
    const { camera } = view;
    const pair = this.levels.levelsAt(camera.zoom);
    const next = pair.isExact ? pair.next : null;
    this.mesh.setLevels(pair.level, next);
    this.mesh.update(
      {
        stageWidthPx: camera.viewport.width,
        stageHeightPx: camera.viewport.height,
        pixelsPerMetre: camera.pixelsPerMetre,
        landFillWeight: isForestShown ? 0 : 1,
        bandAlpha: shore.weight,
        fineWeight: shoreLevelProgress(camera.zoom),
        live: shoreLiveFrame({
          zoom: camera.zoom,
          pixelsPerMetre: camera.pixelsPerMetre,
          timeSeconds: view.timeSeconds,
        }),
      },
      next !== null,
    );
    this.pixi.app.render();
    // only now is no level the camera left still bound to the shader
    this.levels.releaseRetired();
  }

  /** The stage changed size: the canvas follows, and the levels rebake at the new size. */
  resize(sizePx: { readonly width: number; readonly height: number }): void {
    this.pixi.resize(sizePx);
  }

  /** Everything goes back: the slices stop, the levels and the tiles' textures are destroyed, then the app. */
  destroy(): void {
    this.cancelBake?.();
    this.cancelBake = null;
    this.bakeLoop = null;
    // the shader first, so no texture is destroyed while it is still bound to it
    this.mesh.destroy();
    this.levels.clear();
    this.levels.releaseRetired();
    if (this.tileTextures !== null) releaseTileTextures(this.tileTextures);
    this.tileTextures = null;
    this.pixi.destroy();
  }
}
