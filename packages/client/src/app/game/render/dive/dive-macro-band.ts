// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's Canvas 2D drawing
// (`mockup/dive-mockup-bands.js`) on two canvases of its own, the planet's at the bottom of the stage and the kelp's,
// the drop's and the slime's over the shore band's Pixi canvas (`shore/dive-shore-band.ts`, ticket #801); the game's
// Pixi canvas, which clears to transparent, lies over all three. The browser composites them. Uploading a canvas as a
// Pixi texture every frame (a readback of it) was built first and dropped: the bands' drawing then took 1,498 ms a
// frame at zoom 3.3, against 16 ms on a canvas of their own (§6). The mockup's module, the shore's and the coastlines
// load with the dive — two separate chunks and two JSON files — never with the game.

import type { CancelDeferredCall, Scheduler } from '@evolution/shared';
import {
  DIVE_BAKE_BUDGET_MS,
  DIVE_BAKE_INTERVAL_MS,
  DIVE_BAKE_START_DELAY_MS,
  DIVE_SALISH_RINGS_URL,
  DIVE_WORLD_RINGS_URL,
} from '../constants';
import { DiveGlobeCrossfade } from './dive-globe-crossfade';
import type { MockupBands, MockupFrame, MockupRing } from './mockup/dive-mockup-bands';
import type { PixiAppHandle } from '../pixi-app';
import type { DiveView } from './dive-view';

/** The shore band as the stage drives it (`shore/dive-shore-band.ts`); a spec gives a recording one. */
export interface ShoreBandHandle {
  readonly canvas: HTMLCanvasElement;
  /** Its tiles and its top level have baked. */
  readonly isReady: boolean;
  bakeOn(scheduler: Scheduler, nowMs: () => number, onBaked: () => void): void;
  draw(view: DiveView, isForestShown: boolean): void;
  resize(sizePx: { readonly width: number; readonly height: number }): void;
  destroy(): void;
}

/** What makes the shore band on the shore's own Pixi app (`shore/shore-module.ts`'s parts). */
export interface ShoreBandMaker {
  createBand(pixi: PixiAppHandle, devicePixelRatio: number): ShoreBandHandle;
}

/** The bands above the dish: the mockup's, and the shore's (its band is made on the shore's own Pixi app). */
export interface DiveUpperBands {
  readonly mockup: MockupBands;
  readonly shore: ShoreBandMaker;
}

/** Fetches the mockup's and the shore's modules and the coastlines, and makes the bands on the dive's clock. */
export type UpperBandsLoader = (nowMs: () => number) => Promise<DiveUpperBands>;

/** `fetch` as the loader needs it: a spec passes its own. */
export type JsonFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

async function fetchRings(fetchJson: JsonFetch, url: string): Promise<readonly MockupRing[]> {
  const response = await fetchJson(url);
  if (!response.ok) throw new Error(`The dive's coastline ${url} answered ${response.status}`);
  return (await response.json()) as readonly MockupRing[];
}

/** The loader over `fetchJson`: the two chunks and the two files in parallel; the shore's coast and tiles go to the mockup. */
export function upperBandsLoader(fetchJson: JsonFetch, documentReference: Document): UpperBandsLoader {
  return async (nowMs) => {
    const [module, shoreModule, worldRings, salishRings] = await Promise.all([
      import('./mockup/dive-mockup-bands.js'),
      import('./shore/shore-module'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    const shore = shoreModule.createShoreParts(salishRings, documentReference);
    const mockup = module.createMockupBands({
      worldRings,
      salishRings,
      nowMs,
      coast: shore.coast,
      tiles: shore.mockupTiles,
    });
    return { mockup, shore };
  };
}

/** The real loader, over the page's `fetch` and document. */
export const loadUpperBands: UpperBandsLoader = (nowMs) => upperBandsLoader((url) => fetch(url), document)(nowMs);

export class DiveMacroBand {
  private cancelBake: CancelDeferredCall | null = null;
  private readonly globeCrossfade = new DiveGlobeCrossfade();

  constructor(
    private readonly bands: MockupBands,
    private readonly host: HTMLElement,
  ) {
    // First in the stage, the planet's under the kelp's, so the game's Pixi canvas lies over both.
    host.prepend(bands.upperCanvas);
    host.prepend(bands.canvas);
  }

  /** The shore band's canvas goes between the planet's and the kelp's. */
  stackShore(canvas: HTMLCanvasElement): void {
    this.bands.upperCanvas.before(canvas);
  }

  /** Whether the last frame drew the planet's forest; when not, the shore lays its own under the land. */
  get isForestShown(): boolean {
    return this.bands.isForestShown;
  }

  /**
   * Bakes the tiles on the scheduler, as the mockup's `pump` did on its timer: a slice every interval until every
   * tile is made, whatever the frame rate. A slice that finishes a tile calls `onBaked`, so a still view draws it.
   */
  bakeOn(scheduler: Scheduler, onBaked: () => void): void {
    const slice = (): void => {
      this.cancelBake = null;
      if (this.bands.pumpBakes(DIVE_BAKE_BUDGET_MS)) onBaked();
      if (!this.bands.isBaked) this.cancelBake = scheduler.after(DIVE_BAKE_INTERVAL_MS, slice);
    };
    this.cancelBake = scheduler.after(DIVE_BAKE_START_DELAY_MS, slice);
  }

  /** Every tile baked: the dive can fall through the bands without meeting a placeholder. */
  get isBaked(): boolean {
    return this.bands.isBaked;
  }

  /** The baked planet's opacity over the fallback globe this frame (`DiveGlobeCrossfade`). */
  globeAlphaAt(nowMs: number, isMotionReduced: boolean): number {
    return this.globeCrossfade.alphaAt({ nowMs, isPlanetReady: this.bands.isPlanetReady, isMotionReduced });
  }

  /** Shown and drawn while a mockup band draws; hidden, and not drawn, otherwise. */
  draw(frame: MockupFrame, isDrawing: boolean): void {
    this.bands.canvas.hidden = !isDrawing;
    this.bands.upperCanvas.hidden = !isDrawing;
    if (isDrawing) this.bands.draw(frame);
  }

  /** The canvases leave the stage (they and the bakes stay for the page); the planet's GL context goes back. */
  destroy(): void {
    this.cancelBake?.();
    this.cancelBake = null;
    if (this.bands.canvas.parentElement === this.host) this.bands.canvas.remove();
    if (this.bands.upperCanvas.parentElement === this.host) this.bands.upperCanvas.remove();
    this.bands.release();
  }
}
