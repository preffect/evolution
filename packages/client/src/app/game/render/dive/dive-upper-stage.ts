// The bands above the dish on the stage (docs/rendering/opening-dive.md §1, §4): the mockup's two canvases (the planet's
// at the bottom, the kelp's, the drop's and the slime's over the shore) and the shore band's Pixi canvas between them
// (ticket #801). Each bakes on the scheduler; a frame draws the mockup's first, since the shore lays its flat forest
// under the land only when the planet's forest was not drawn.

import type { Scheduler } from '@evolution/shared';
import type { PixiAppHandle } from '../pixi-app';
import { isMockupDrawing } from './dive-bands';
import type { DiveFrameTimes } from './dive-frame-times';
import { DiveMacroBand, type DiveUpperBands, type ShoreBandHandle } from './dive-macro-band';
import { mockupFrameOf, type DiveView } from './dive-view';

export interface DiveUpperStageOptions {
  readonly host: HTMLElement;
  readonly devicePixelRatio: number;
  readonly scheduler: Scheduler;
  readonly nowMs: () => number;
  /** A bake landed: a still dive draws once more. */
  readonly onBaked: () => void;
}

export class DiveUpperStage {
  private readonly macro: DiveMacroBand;
  private readonly shore: ShoreBandHandle;

  constructor(
    bands: DiveUpperBands,
    shorePixi: PixiAppHandle,
    private readonly options: DiveUpperStageOptions,
  ) {
    this.macro = new DiveMacroBand(bands.mockup, options.host);
    this.shore = bands.shore.createBand(shorePixi, options.devicePixelRatio);
    this.macro.stackShore(this.shore.canvas);
    this.macro.bakeOn(options.scheduler, options.onBaked);
    this.shore.bakeOn(options.scheduler, options.nowMs, options.onBaked);
  }

  /** The mockup's tiles and the shore's tiles and top level have baked: the dive can fall without a placeholder. */
  get isBaked(): boolean {
    return this.macro.isBaked && this.shore.isReady;
  }

  /** One frame of the upper bands, each part's script time charged to its own column. */
  draw(view: DiveView, frameTimes: DiveFrameTimes, isMotionReduced: boolean): void {
    const macro = this.macro;
    const globeAlpha = macro.globeAlphaAt(this.options.nowMs(), isMotionReduced);
    const frame = mockupFrameOf(view, this.options.devicePixelRatio, globeAlpha);
    frameTimes.measureUpperBands(() => macro.draw(frame, isMockupDrawing(view.bands)));
    frameTimes.measureShore(() => this.shore.draw(view, macro.isForestShown));
  }

  resize(sizePx: { readonly width: number; readonly height: number }): void {
    this.shore.resize(sizePx);
  }

  /** The mockup's canvases leave the stage, and the shore's app and its levels go back. */
  destroy(): void {
    this.macro.destroy();
    this.shore.destroy();
  }
}
