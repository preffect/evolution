// The dive's layers above the dish (docs/rendering/opening-dive.md §1, §4): the planet (`DivePlanetBand`), the shore
// band over it (ticket #801), the kelp band over that (ticket #802) and the slime band (ticket #803), all on the dive's
// Pixi stage, one WebGL context; their bakes in slices on the scheduler, and the planet's forest test. While the drop
// shows the slime lies over the kelp band (it draws inside the drop); otherwise it lies at the bottom of the stage,
// under the game's dish, which draws over it.

import type { Clock, Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { DiveBakePump } from './dive-bake-pump';
import type { DiveFrameTimes } from './dive-frame-times';
import type { DiveUpperBands, KelpBandHandle, ShoreBandHandle, SlimeBandHandle } from './dive-band-loader';
import { DivePlanetBand } from './dive-planet-band';
import { upperBandsDevicePixelRatio, type DiveView } from './dive-view';
import type { RenderToTexture } from './planet/dive-planet-mesh';

export interface DiveUpperLayersParts {
  readonly bands: DiveUpperBands;
  /** The Pixi stage the bands go in, with the game's renderer. */
  readonly stage: Container;
  readonly clock: Clock;
  readonly frameTimes: DiveFrameTimes;
  readonly renderToTexture: RenderToTexture;
  /** The dive's device pixel ratio, which the shore's levels and the slime's sprites bake at. */
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
  private readonly planet: DivePlanetBand;
  private readonly bakePump: DiveBakePump;
  private readonly shore: ShoreBandHandle;
  private readonly kelp: KelpBandHandle;
  private readonly slime: SlimeBandHandle;
  private isSlimeOverKelp = false;

  constructor(private readonly parts: DiveUpperLayersParts) {
    this.planet = new DivePlanetBand(parts.bands.planet, parts.clock);
    this.planet.attachTo(parts.stage);
    this.shore = parts.bands.shore.createBand(parts.renderToTexture, parts.devicePixelRatio);
    this.kelp = parts.bands.kelp.createBand(parts.renderToTexture, parts.devicePixelRatio);
    const slime = parts.bands.slime.createBand(parts.renderToTexture, parts.devicePixelRatio);
    this.slime = slime.band;
    parts.stage.addChild(this.shore.view, this.kelp.view);
    parts.stage.addChildAt(this.slime.view, 0);
    // The planet's coastlines first: they are on screen from the first frame; then the kelp's, then the slime's.
    this.bakePump = new DiveBakePump([this.planet, parts.bands.kelp.bakes, slime.bakes]);
  }

  /** Bakes the coastlines and the bands' sprites and tiles in slices on the scheduler; `onBaked` hears each land. */
  bakeOn(scheduler: Scheduler, onBaked: () => void): void {
    this.bakePump.start(scheduler, onBaked);
    this.shore.bakeOn(scheduler, () => this.parts.clock.nowMilliseconds(), onBaked);
  }

  /** The zoom a play must wait above while the shore, the kelp or the slime bakes what lies below it. */
  get fallFloorZoom(): number {
    return Math.max(this.shore.fallFloorZoom, this.kelp.fallFloorZoom, this.slime.fallFloorZoom);
  }

  /** Every bake done, the shore's, the kelp's and the slime's: the dive can fall without a stand-in. */
  get isBaked(): boolean {
    return this.bakePump.isBaked && this.shore.isReady && this.kelp.isReady && this.slime.isReady;
  }

  /** The slime over the kelp band while the drop shows (inside it), at the bottom of the stage otherwise. */
  private stackSlime(isOverKelp: boolean): void {
    if (isOverKelp === this.isSlimeOverKelp) return;
    this.isSlimeOverKelp = isOverKelp;
    const stage = this.parts.stage;
    stage.setChildIndex(this.slime.view, isOverKelp ? stage.children.length - 1 : 0);
  }

  /**
   * Runs the planet's forest test (timed as the upper bands), sets the shore, the kelp and the slime up, then draws the
   * planet into its texture when it shows; answers whether the Pixi canvas shows any of them.
   */
  draw(view: DiveView, frame: DiveUpperLayersFrame): boolean {
    const { planet, shore, kelp, slime } = this;
    const { frameTimes, bands } = this.parts;
    let isPlanetShown = false;
    frameTimes.measureUpperBands(() => {
      isPlanetShown = bands.forest.isShown(view);
    });
    let isShoreShown = false;
    frameTimes.measureShore(() => {
      isShoreShown = shore.draw(view, isPlanetShown);
    });
    let isKelpShown = false;
    frameTimes.measureKelp(() => {
      isKelpShown = kelp.draw(view);
    });
    let isSlimeShown = false;
    frameTimes.measureSlime(() => {
      isSlimeShown = slime.draw(view);
    });
    this.stackSlime(isKelpShown);
    planet.setIsShown(isPlanetShown);
    const isPixiShown = isPlanetShown || isShoreShown || isKelpShown || isSlimeShown;
    if (!isPlanetShown) return isPixiShown;
    const planetDraw = {
      view,
      bandsRatio: upperBandsDevicePixelRatio(frame.screenRatio, view.isMoving),
      nowMs: frame.nowMs,
      isMotionReduced: frame.isMotionReduced,
    };
    this.parts.frameTimes.measurePlanet(() => planet.draw(planetDraw, this.parts.renderToTexture));
    return true;
  }

  /** The planet's, the shore's, the kelp's and the slime's GPU objects go; the bakes stay for the page. */
  destroy(): void {
    this.bakePump.cancel();
    this.planet.destroy();
    this.shore.destroy();
    this.kelp.destroy();
    this.slime.destroy();
  }
}
