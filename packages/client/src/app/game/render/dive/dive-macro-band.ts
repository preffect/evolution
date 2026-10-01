// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's Canvas 2D drawing
// (`mockup/dive-mockup-bands.js`) on its own canvas, under the Pixi canvas, which clears to transparent. The browser
// composites the two. Uploading the canvas as a Pixi texture every frame (a readback of it) was built first and
// dropped: the bands' drawing then took 1,498 ms a frame at zoom 3.3, against 16 ms on a canvas of their own (§6).
// The module and its coastlines load with the dive — a separate chunk and two JSON files — never with the game.

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

/** Fetches the mockup's module and the coastlines it bakes from, and makes its bands on the dive's clock. */
export type MockupBandsLoader = (nowMs: () => number) => Promise<MockupBands>;

/** `fetch` as the loader needs it: a spec passes its own. */
export type JsonFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

async function fetchRings(fetchJson: JsonFetch, url: string): Promise<readonly MockupRing[]> {
  const response = await fetchJson(url);
  if (!response.ok) throw new Error(`The dive's coastline ${url} answered ${response.status}`);
  return (await response.json()) as readonly MockupRing[];
}

/** The loader over `fetchJson`: the chunk and the two files in parallel. */
export function mockupBandsLoader(fetchJson: JsonFetch): MockupBandsLoader {
  return async (nowMs) => {
    const [module, worldRings, salishRings] = await Promise.all([
      import('./mockup/dive-mockup-bands.js'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    return module.createMockupBands({ worldRings, salishRings, nowMs });
  };
}

/** The real loader, over the page's `fetch`. */
export const loadMockupBands: MockupBandsLoader = mockupBandsLoader((url) => fetch(url));

export class DiveMacroBand {
  private cancelBake: CancelDeferredCall | null = null;
  private readonly globeCrossfade = new DiveGlobeCrossfade();

  constructor(
    private readonly bands: MockupBands,
    private readonly host: HTMLElement,
  ) {
    // First in the stage, so the Pixi canvas the app appends lies over it.
    host.prepend(bands.canvas);
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
    if (isDrawing) this.bands.draw(frame);
  }

  /** The canvas leaves the stage (it and the bakes stay for the page); the planet's GL context goes back. */
  destroy(): void {
    this.cancelBake?.();
    this.cancelBake = null;
    if (this.bands.canvas.parentElement === this.host) this.bands.canvas.remove();
    this.bands.release();
  }
}
