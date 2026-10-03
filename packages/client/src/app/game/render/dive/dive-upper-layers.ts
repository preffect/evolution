// The dive's layers above the dish (docs/rendering/opening-dive.md §1, §4): the planet (`DivePlanetBand`), the shore
// band over it (ticket #801) and the kelp band over that (ticket #802) on the dive's Pixi stage, one WebGL context, and
// the mockup's slime on a canvas of its own (`DiveMacroBand`); their bakes in slices on the scheduler, the planet's
// forest test, and which canvas lies over which. While the planet, the shore or the kelp and the drop show, the
// mockup's canvas lies over the Pixi canvas and is left clear round the slime, so the slime draws over the drop;
// otherwise it lies under it, so the game's dish draws over the slime.

import type { Clock, Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { DiveBakePump } from './dive-bake-pump';
import { isMockupDrawing } from './dive-bands';
import type { DiveFrameTimes } from './dive-frame-times';
import { DiveMacroBand, type DiveUpperBands, type KelpBandHandle, type ShoreBandHandle } from './dive-macro-band';
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
  private readonly kelp: KelpBandHandle;

  constructor(private readonly parts: DiveUpperLayersParts) {
    this.macro = new DiveMacroBand(parts.bands.mockup, parts.host);
    this.planet = new DivePlanetBand(parts.bands.planet, parts.clock);
    this.planet.attachTo(parts.stage);
    this.shore = parts.bands.shore.createBand(parts.renderToTexture, parts.devicePixelRatio);
    this.kelp = parts.bands.kelp.createBand(parts.renderToTexture, parts.devicePixelRatio);
    parts.stage.addChild(this.shore.view, this.kelp.view);
    // The planet's coastlines first: they are on screen from the first frame; then the kelp's, before the slime's tiles.
    this.bakePump = new DiveBakePump([this.planet, parts.bands.kelp.bakes, this.macro]);
  }

  /** Bakes the coastlines and the tiles in slices on the scheduler; `onBaked` hears each one land. */
  bakeOn(scheduler: Scheduler, onBaked: () => void): void {
    this.bakePump.start(scheduler, onBaked);
    this.shore.bakeOn(scheduler, () => this.parts.clock.nowMilliseconds(), onBaked);
  }

  /** The zoom a play must wait above while the shore or the kelp bakes what lies below it. */
  get fallFloorZoom(): number {
    return Math.max(this.shore.fallFloorZoom, this.kelp.fallFloorZoom);
  }

  /** Every bake done, the shore's tiles and top level and the kelp's too: the dive can fall without a placeholder. */
  get isBaked(): boolean {
    return this.bakePump.isBaked && this.shore.isReady && this.kelp.isReady;
  }

  /**
   * Runs the planet's forest test and draws the mockup's slime (both timed as the upper bands), sets the shore and the
   * kelp up, then draws the planet into its texture when it shows; answers whether the Pixi canvas shows any of them.
   */
  draw(view: DiveView, frame: DiveUpperLayersFrame): boolean {
    const { macro, planet, shore, kelp } = this;
    const { frameTimes, bands } = this.parts;
    let isPlanetShown = false;
    frameTimes.measureUpperBands(() => {
      isPlanetShown = bands.forest.isShown(view);
      macro.draw(mockupFrameOf(view, frame.screenRatio), isMockupDrawing(view.bands));
    });
    let isShoreShown = false;
    frameTimes.measureShore(() => {
      isShoreShown = shore.draw(view, isPlanetShown);
    });
    let isKelpShown = false;
    frameTimes.measureKelp(() => {
      isKelpShown = kelp.draw(view);
    });
    const isPixiShown = isPlanetShown || isShoreShown || isKelpShown;
    macro.stackOverGame(isPixiShown);
    planet.setIsShown(isPlanetShown);
    if (!isPlanetShown) return isPixiShown;
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
   * The planet's, the shore's and the kelp's GPU objects go, and the mockup's canvas leaves the stage; the bakes stay
   * for the page.
   */
  destroy(): void {
    this.bakePump.cancel();
    this.planet.destroy();
    this.macro.destroy();
    this.shore.destroy();
    this.kelp.destroy();
  }
}
