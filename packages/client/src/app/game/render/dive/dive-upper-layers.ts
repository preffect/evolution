// The dive's layers above the dish (docs/rendering/opening-dive.md §1, §4): the mockup's canvas (`DiveMacroBand`), the
// planet on the dive's Pixi stage (`DivePlanetBand`) and the shore band on a Pixi app of its own right under the
// mockup's canvas (ticket #801), their bakes in slices on the scheduler, and which canvas lies over which. While the
// planet shows, the shore's and the mockup's canvases lie over the Pixi canvas and are left clear for it, so the shore
// draws over the planet; otherwise they lie under it, so the game's dish draws over the slime.

import type { Clock, Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import type { PixiAppHandle } from '../pixi-app';
import { DiveBakePump } from './dive-bake-pump';
import { isMockupDrawing } from './dive-bands';
import type { DiveFrameTimes } from './dive-frame-times';
import { DiveMacroBand, type DiveUpperBands, type ShoreBandHandle } from './dive-macro-band';
import { DivePlanetBand } from './dive-planet-band';
import { mockupDevicePixelRatio, mockupFrameOf, type DiveView } from './dive-view';
import type { RenderToTexture } from './planet/dive-planet-mesh';

export interface DiveUpperLayersParts {
  readonly bands: DiveUpperBands;
  /** The stage element the mockup's canvas goes in, beside the Pixi canvas. */
  readonly host: HTMLElement;
  /** The Pixi stage the planet goes in, under the game's renderer. */
  readonly stage: Container;
  readonly clock: Clock;
  readonly frameTimes: DiveFrameTimes;
  readonly renderToTexture: RenderToTexture;
  /** The shore band's own Pixi app. */
  readonly shorePixi: PixiAppHandle;
  /** The dive's device pixel ratio, which the shore's levels bake at. */
  readonly devicePixelRatio: number;
}

/** What a frame of the layers needs beside its view. */
export interface DiveUpperLayersFrame {
  /** The screen's device pixel ratio, as far as the dive renders it. */
  readonly screenRatio: number;
  readonly nowMs: number;
  readonly isMotionReduced: boolean;
}

export class DiveUpperLayers {
  private readonly macro: DiveMacroBand;
  private readonly planet: DivePlanetBand;
  private readonly bakePump: DiveBakePump;
  private readonly shore: ShoreBandHandle;

  constructor(private readonly parts: DiveUpperLayersParts) {
    this.macro = new DiveMacroBand(parts.bands.mockup, parts.host);
    this.planet = new DivePlanetBand(parts.bands.planet, parts.clock);
    this.planet.attachTo(parts.stage);
    this.shore = parts.bands.shore.createBand(parts.shorePixi, parts.devicePixelRatio);
    this.macro.stackShore(this.shore.canvas);
    // The planet's coastlines first: they are on screen from the first frame.
    this.bakePump = new DiveBakePump([this.planet, this.macro]);
  }

  /** Bakes the coastlines and the tiles in slices on the scheduler; `onBaked` hears each one land. */
  bakeOn(scheduler: Scheduler, onBaked: () => void): void {
    this.bakePump.start(scheduler, onBaked);
    this.shore.bakeOn(scheduler, () => this.parts.clock.nowMilliseconds(), onBaked);
  }

  /** Every bake done, the shore's tiles and top level too: the dive can fall without meeting a placeholder. */
  get isBaked(): boolean {
    return this.bakePump.isBaked && this.shore.isReady;
  }

  /**
   * Draws the mockup's canvas (its test says whether the planet's forest shows, so it runs while the shore draws too),
   * the shore, then the planet into its texture when it shows; answers whether it shows.
   */
  draw(view: DiveView, frame: DiveUpperLayersFrame): boolean {
    const { macro, planet, shore } = this;
    const mockupFrame = mockupFrameOf(view, frame.screenRatio);
    const isDrawing = isMockupDrawing(view.bands) || view.bands.shore.isActive;
    let isPlanetShown = false;
    this.parts.frameTimes.measureUpperBands(() => {
      isPlanetShown = macro.draw(mockupFrame, isDrawing);
    });
    this.parts.frameTimes.measureShore(() => shore.draw(view, isPlanetShown));
    macro.stackOverGame(isPlanetShown);
    planet.setIsShown(isPlanetShown);
    if (!isPlanetShown) return false;
    const planetDraw = {
      view,
      bandsRatio: mockupDevicePixelRatio(frame.screenRatio, view.isMoving),
      nowMs: frame.nowMs,
      isMotionReduced: frame.isMotionReduced,
    };
    this.parts.frameTimes.measurePlanet(() => planet.draw(planetDraw, this.parts.renderToTexture));
    return true;
  }

  /** The stage changed size: the shore's app follows (the game's is the session's). */
  resize(sizePx: { readonly width: number; readonly height: number }): void {
    this.shore.resize(sizePx);
  }

  /**
   * The planet's GPU objects go, the mockup's canvas leaves the stage, and the shore's app and its levels go back; the
   * bakes stay for the page.
   */
  destroy(): void {
    this.bakePump.cancel();
    this.planet.destroy();
    this.macro.destroy();
    this.shore.destroy();
  }
}
