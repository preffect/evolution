// The dive's layers above the dish (docs/rendering/opening-dive.md §1, §4): the mockup's canvas (`DiveMacroBand`), and
// the planet (`DivePlanetBand`) and the shore band over it (ticket #801) on the dive's Pixi stage, one WebGL context;
// their bakes in slices on the scheduler, and which canvas lies over which. While the planet or the shore shows, the
// mockup's canvas lies over the Pixi canvas and is left clear for them, so the kelp draws over the shore; otherwise it
// lies under it, so the game's dish draws over the slime.

import type { Clock, Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
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
    this.shore = parts.bands.shore.createBand(parts.renderToTexture, parts.devicePixelRatio);
    parts.stage.addChild(this.shore.view);
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
   * sets the shore up, then draws the planet into its texture when it shows; answers whether the Pixi canvas shows
   * either.
   */
  draw(view: DiveView, frame: DiveUpperLayersFrame): boolean {
    const { macro, planet, shore } = this;
    const mockupFrame = mockupFrameOf(view, frame.screenRatio);
    const isDrawing = isMockupDrawing(view.bands) || view.bands.shore.isActive;
    let isPlanetShown = false;
    this.parts.frameTimes.measureUpperBands(() => {
      isPlanetShown = macro.draw(mockupFrame, isDrawing);
    });
    let isShoreShown = false;
    this.parts.frameTimes.measureShore(() => {
      isShoreShown = shore.draw(view, isPlanetShown);
    });
    macro.stackOverGame(isPlanetShown || isShoreShown);
    planet.setIsShown(isPlanetShown);
    if (!isPlanetShown) return isShoreShown;
    const planetDraw = {
      view,
      bandsRatio: mockupDevicePixelRatio(frame.screenRatio, view.isMoving),
      nowMs: frame.nowMs,
      isMotionReduced: frame.isMotionReduced,
    };
    this.parts.frameTimes.measurePlanet(() => planet.draw(planetDraw, this.parts.renderToTexture));
    return true;
  }

  /**
   * The planet's and the shore's GPU objects go, and the mockup's canvas leaves the stage; the bakes stay for the
   * page.
   */
  destroy(): void {
    this.bakePump.cancel();
    this.planet.destroy();
    this.macro.destroy();
    this.shore.destroy();
  }
}
