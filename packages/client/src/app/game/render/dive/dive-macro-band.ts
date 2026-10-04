// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's Canvas 2D slime
// (`mockup/dive-mockup-bands.js`) on its own canvas beside the Pixi canvas, which clears to transparent. The browser
// composites the two. Uploading the canvas as a Pixi texture every frame (a readback of it) was built first and
// dropped: the bands' drawing then took 1,498 ms a frame at zoom 3.3, against 16 ms on a canvas of their own (§6).
// While the planet, the shore or the kelp and the drop show (the game's, on the Pixi canvas: `dive-planet-band.ts`,
// `shore/dive-shore-band.ts`, `kelp/dive-kelp-band.ts`) this canvas lies over the Pixi canvas, so the slime draws over
// the drop; otherwise under it, so the game's dish draws over the slime. The modules, the planet's bakes and the
// coastlines load with the dive — separate chunks and two JSON files — never with the game.

import type { Scheduler } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import type { DiveBaker } from './dive-bake-pump';
import type { DivePlanetKeptBakes, DivePlanetSource } from './dive-planet-band';
import type { DiveView } from './dive-view';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';
import type { DiveCoastRing } from './planet/dive-planet-bakes';
import type { RenderToTexture } from './planet/dive-planet-mesh';

/** The shore band as the stage drives it (`shore/dive-shore-band.ts`); a spec gives a recording one. */
export interface ShoreBandHandle {
  /** Its quad, which goes on the dive's stage over the planet. */
  readonly view: Container;
  /** Its tiles and its top level have baked. */
  readonly isReady: boolean;
  /** The zoom a fall must wait above until the levels below it have a stand-in (`ShoreLevels.fallFloorZoom`). */
  readonly fallFloorZoom: number;
  bakeOn(scheduler: Scheduler, nowMs: () => number, onBaked: () => void): void;
  /** Sets the quad up for this frame; answers whether it shows. */
  draw(view: DiveView, isForestShown: boolean): boolean;
  destroy(): void;
}

/** What makes the shore band (`shore/shore-module.ts`'s parts); it warms its shader up through `renderToTexture`. */
export interface ShoreBandMaker {
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): ShoreBandHandle;
}

/** The kelp band as the stage drives it (`kelp/dive-kelp-band.ts`); a spec gives a recording one. */
export interface KelpBandHandle {
  /** Its meshes, which go on the dive's stage over the shore's quad. */
  readonly view: Container;
  /** Its bakes and the shore's tiles are done. */
  readonly isReady: boolean;
  /** The zoom a fall must wait above until it is ready. */
  readonly fallFloorZoom: number;
  /** Sets its meshes up for this frame; answers whether any shows. */
  draw(view: DiveView): boolean;
  destroy(): void;
}

/** What makes the kelp band (`kelp/kelp-module.ts`'s parts): its bakes, which the dive's pump runs, and the band. */
export interface KelpBandMaker {
  readonly bakes: DiveBaker;
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): KelpBandHandle;
}

/** Whether the planet's forest shows under the shore (`shore/shore-forest-test.ts`). */
export interface DiveForestTest {
  isShown(view: DiveView): boolean;
}

/** What the dive's lazy chunks give the session: the mockup's slime, the planet's bakes, the shore and the kelp. */
export interface DiveUpperBands {
  readonly mockup: MockupBands;
  readonly planet: DivePlanetSource;
  readonly shore: ShoreBandMaker;
  readonly kelp: KelpBandMaker;
  readonly forest: DiveForestTest;
}

/** Fetches the modules, the planet's bakes and the coastlines they draw from; the bands run on the dive's clock. */
export type DiveUpperBandsLoader = (nowMs: () => number) => Promise<DiveUpperBands>;

/** `fetch` as the loader needs it: a spec passes its own. */
export type JsonFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

async function fetchRings(fetchJson: JsonFetch, url: string): Promise<readonly DiveCoastRing[]> {
  const response = await fetchJson(url);
  if (!response.ok) throw new Error(`The dive's coastline ${url} answered ${response.status}`);
  return (await response.json()) as readonly DiveCoastRing[];
}

/**
 * The loader over `fetchJson`: the chunks and the two files in parallel. The planet's finished bakes are kept with the
 * loader, which lives for the page, so a return to the lobby does not bake them again; the kelp shares the shore's
 * land and tiles.
 */
export function diveUpperBandsLoader(fetchJson: JsonFetch, documentReference: Document): DiveUpperBandsLoader {
  const kept: DivePlanetKeptBakes = new Map();
  return async (nowMs) => {
    const [mockupModule, planetModule, shoreModule, kelpModule, worldRings, salishRings] = await Promise.all([
      import('./mockup/dive-mockup-bands.js'),
      import('./planet/dive-planet-bakes'),
      import('./shore/shore-module'),
      import('./kelp/kelp-module'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    const shore = shoreModule.createShoreParts(salishRings, documentReference);
    return {
      mockup: mockupModule.createMockupBands({ nowMs }),
      planet: { plan: planetModule.createDivePlanetBakePlan(worldRings, salishRings), kept },
      shore,
      kelp: kelpModule.createKelpParts(shore, nowMs),
      forest: shore.forest,
    };
  };
}

/** The real loader, over the page's `fetch` and document. */
export const loadDiveUpperBands: DiveUpperBandsLoader = diveUpperBandsLoader((url) => fetch(url), document);

export class DiveMacroBand implements DiveBaker {
  private isOverGame = false;

  constructor(
    private readonly bands: MockupBands,
    private readonly host: HTMLElement,
  ) {
    // First in the stage, so the Pixi canvas the app appends lies over it.
    host.prepend(bands.canvas);
  }

  /** Bakes the tiles for about `budgetMs`, as the mockup's `pump` did; `true` when one finished. */
  pumpBakes(budgetMs: number): boolean {
    return this.bands.pumpBakes(budgetMs);
  }

  /** Every tile baked. */
  get isBaked(): boolean {
    return this.bands.isBaked;
  }

  /** Shown and drawn while the slime draws; hidden, and not drawn, otherwise. */
  draw(frame: MockupFrame, isDrawing: boolean): void {
    this.bands.canvas.hidden = !isDrawing;
    if (isDrawing) this.bands.draw(frame);
  }

  /** Lays the canvas over the game's (the planet, the shore or the drop shows under it) or under it (the dish). */
  stackOverGame(isOverGame: boolean): void {
    if (isOverGame === this.isOverGame) return;
    this.isOverGame = isOverGame;
    if (isOverGame) this.host.append(this.bands.canvas);
    else this.host.prepend(this.bands.canvas);
  }

  /** The canvas leaves the stage (it and the bakes stay for the page). */
  destroy(): void {
    if (this.bands.canvas.parentElement === this.host) this.bands.canvas.remove();
    this.bands.release();
  }
}
