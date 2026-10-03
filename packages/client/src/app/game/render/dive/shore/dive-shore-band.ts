// The coast and the shore on the GPU (docs/rendering/opening-dive.md §4, ticket #801): the band from where the coast
// fades in over the planet (zoom 4.85) down to the kelp's blade (−1.42), a quad on the dive's own Pixi stage over the
// planet (the dive keeps one WebGL context), under the mockup's canvas with the kelp. Its tiles bake once a page and its levels of detail as the camera nears them, a few
// milliseconds at a time on the scheduler; each frame it draws one quad: the baked level, the next one crossfading
// in, and the live sea (`shore-mesh.ts`). Before PR #801 the mockup drew all of it on Canvas 2D every frame, and its
// zone layers cost seconds a frame on a box without a GPU.

import type { CancelDeferredCall, Scheduler } from '@evolution/shared';
import { RenderTexture, type Container } from 'pixi.js';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { SHORE_LAND_FILL, SHORE_LOD } from '../../constants/dive-shore';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexToRgb } from '../../colour';
import type { DiveView } from '../dive-view';
import type { RenderToTexture } from '../planet/dive-planet-mesh';
import { shoreLiveFrame } from './shore-live';
import { shoreLevelProgress } from './shore-lod';
import { ShoreLevels } from './shore-levels';
import { ShoreMesh, type ShoreLevelTextures, type ShoreTileTextures } from './shore-mesh';
import type { ShoreSnapshotSources } from './shore-snapshot';
import type { ShoreTiles } from './shore-tiles';
import { SHORE_LEVEL_UPLOADER, liveTileTextures, releaseTileTextures } from './shore-textures';

/** The warm-up's target: one pixel is enough to compile and link the program. */
const WARM_UP_TARGET_PX = 1;

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
    private readonly sources: DiveShoreSources,
    private readonly devicePixelRatio: number,
    renderToTexture: RenderToTexture,
  ) {
    this.levels = new ShoreLevels(sources, SHORE_LEVEL_UPLOADER);
    this.warmUp(renderToTexture);
  }

  /**
   * Draws the quad once, unseen, into a pixel of its own, so its program compiles and links while the lobby opens
   * rather than on the first frame of the fall: on a software GPU the link of this shader blocks the page for seconds.
   */
  private warmUp(renderToTexture: RenderToTexture): void {
    const target = RenderTexture.create({ width: WARM_UP_TARGET_PX, height: WARM_UP_TARGET_PX });
    this.mesh.mesh.visible = true;
    renderToTexture(this.mesh.mesh, target);
    this.mesh.mesh.visible = false;
    target.destroy(true);
  }

  /** The quad, for the dive's stage: over the planet, drawn with the dive's frame. */
  get view(): Container {
    return this.mesh.mesh;
  }

  /** The tiles have baked and the top level has: the dive can start falling into the band. */
  get isReady(): boolean {
    return this.sources.tiles.isBaked && this.levels.isBakedAt(SHORE_LOD.topZoom);
  }

  /** Bakes the tiles, then the levels near the camera, a slice every interval while there is work (`DiveMacroBand`'s pace). */
  bakeOn(scheduler: Scheduler, nowMs: () => number, onBaked: () => void): void {
    this.bakeLoop = { scheduler, onBaked, nowMs };
    // the stage's size comes with the first frame (`draw`), in orbit or not
    this.levels.focus(SHORE_LOD.topZoom, 1);
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

  /**
   * One frame: hidden above and below the band; otherwise the level in view, crossfaded, with the live sea. Answers
   * whether the quad shows, so the dive's frame is drawn. The levels the camera left on the frame before go back
   * first: that frame drew without them, so none is still bound to the shader.
   */
  draw(view: DiveView, isForestShown: boolean): boolean {
    this.levels.releaseRetired();
    const shore = view.bands.shore;
    if (!shore.isActive) {
      this.levels.setStage(view.camera.viewport, this.devicePixelRatio);
      this.mesh.setLevels(null, null);
      return false;
    }
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
    return this.mesh.mesh.visible;
  }

  /** Everything goes back: the slices stop, the quad leaves the stage, the levels and the tiles' textures are destroyed. */
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
  }
}
