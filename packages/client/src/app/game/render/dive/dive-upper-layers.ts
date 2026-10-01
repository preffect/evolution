// The dive's layers above the dish (docs/rendering/opening-dive.md §1, §4): the mockup's canvas (`DiveMacroBand`) and
// the planet on the dive's Pixi stage (`DivePlanetBand`), their bakes in slices on the scheduler, and which canvas
// lies over which. While the planet shows, the mockup's canvas lies over the Pixi canvas and is left clear for it,
// so the shore draws over the planet; otherwise it lies under it, so the game's dish draws over the slime.

import type { Clock, Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { DiveBakePump } from './dive-bake-pump';
import { isMockupDrawing } from './dive-bands';
import type { DiveFrameTimes } from './dive-frame-times';
import { DiveMacroBand, type DiveUpperBands } from './dive-macro-band';
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

  constructor(private readonly parts: DiveUpperLayersParts) {
    this.macro = new DiveMacroBand(parts.bands.mockup, parts.host);
    this.planet = new DivePlanetBand(parts.bands.planet, parts.clock);
    this.planet.attachTo(parts.stage);
    // The planet's coastlines first: they are on screen from the first frame.
    this.bakePump = new DiveBakePump([this.planet, this.macro]);
  }

  /** Bakes the coastlines and the tiles in slices on the scheduler; `onBaked` hears each one land. */
  bakeOn(scheduler: Scheduler, onBaked: () => void): void {
    this.bakePump.start(scheduler, onBaked);
  }

  /** Every bake done: the dive can fall through the bands without meeting a placeholder. */
  get isBaked(): boolean {
    return this.bakePump.isBaked;
  }

  /** Draws the mockup's canvas, then the planet into its texture when it shows; answers whether it shows. */
  draw(view: DiveView, frame: DiveUpperLayersFrame): boolean {
    const { macro, planet } = this;
    const mockupFrame = mockupFrameOf(view, frame.screenRatio);
    let isPlanetShown = false;
    this.parts.frameTimes.measureUpperBands(() => {
      isPlanetShown = macro.draw(mockupFrame, isMockupDrawing(view.bands));
    });
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

  /** The planet's GPU objects go, and the mockup's canvas leaves the stage; the bakes stay for the page. */
  destroy(): void {
    this.bakePump.cancel();
    this.planet.destroy();
    this.macro.destroy();
  }
}
