// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's Canvas 2D drawing
// (`mockup/dive-mockup-bands.js`) on its own canvas beside the Pixi canvas, which clears to transparent. The browser
// composites the two. Uploading the canvas as a Pixi texture every frame (a readback of it) was built first and
// dropped: the bands' drawing then took 1,498 ms a frame at zoom 3.3, against 16 ms on a canvas of their own (§6).
// The shore band's Pixi canvas (`shore/dive-shore-band.ts`, ticket #801) always lies right under this one, so the
// kelp draws over the shore. While the planet shows (it is the game's, on the Pixi canvas: `dive-planet-band.ts`) the
// two lie over the Pixi canvas, so the shore draws over the planet; otherwise under it, so the game's dish draws over
// the slime. The modules, the planet's bakes and the coastlines load with the dive — separate chunks and two JSON
// files — never with the game.

import type { Scheduler } from '@evolution/shared';
import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import type { PixiAppHandle } from '../pixi-app';
import type { DiveBaker } from './dive-bake-pump';
import type { DivePlanetKeptBakes, DivePlanetSource } from './dive-planet-band';
import type { DiveView } from './dive-view';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';
import type { DiveCoastRing } from './planet/dive-planet-bakes';

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

/** What the dive's lazy chunks give the session: the mockup's bands, the planet's coastline bakes and the shore. */
export interface DiveUpperBands {
  readonly mockup: MockupBands;
  readonly planet: DivePlanetSource;
  readonly shore: ShoreBandMaker;
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
 * loader, which lives for the page, so a return to the lobby does not bake them again; the shore's coast and tiles go
 * to the mockup, whose kelp still draws with them.
 */
export function diveUpperBandsLoader(fetchJson: JsonFetch, documentReference: Document): DiveUpperBandsLoader {
  const kept: DivePlanetKeptBakes = new Map();
  return async (nowMs) => {
    const [mockupModule, planetModule, shoreModule, worldRings, salishRings] = await Promise.all([
      import('./mockup/dive-mockup-bands.js'),
      import('./planet/dive-planet-bakes'),
      import('./shore/shore-module'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    const shore = shoreModule.createShoreParts(salishRings, documentReference);
    return {
      mockup: mockupModule.createMockupBands({ nowMs, coast: shore.coast, tiles: shore.mockupTiles }),
      planet: { plan: planetModule.createDivePlanetBakePlan(worldRings, salishRings), kept },
      shore,
    };
  };
}

/** The real loader, over the page's `fetch` and document. */
export const loadDiveUpperBands: DiveUpperBandsLoader = diveUpperBandsLoader((url) => fetch(url), document);

export class DiveMacroBand implements DiveBaker {
  private isOverGame = false;
  private shoreCanvas: HTMLCanvasElement | null = null;

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

  /**
   * Shown and drawn while a mockup band draws; hidden, and not drawn, otherwise. Answers whether the planet shows
   * under it: by the mockup's own test while it draws, by the band table when it does not.
   */
  draw(frame: MockupFrame, isDrawing: boolean): boolean {
    this.bands.canvas.hidden = !isDrawing;
    return isDrawing ? this.bands.draw(frame) : frame.bands.planet.isActive;
  }

  /** The shore band's canvas goes right under this one, and moves with it. */
  stackShore(canvas: HTMLCanvasElement): void {
    this.shoreCanvas = canvas;
    this.bands.canvas.before(canvas);
  }

  /**
   * Lays the canvas, and the shore's under it, over the game's (the planet shows under them) or under it (the game's
   * dish over the slime).
   */
  stackOverGame(isOverGame: boolean): void {
    if (isOverGame === this.isOverGame) return;
    this.isOverGame = isOverGame;
    if (isOverGame) this.host.append(this.bands.canvas);
    else this.host.prepend(this.bands.canvas);
    if (this.shoreCanvas !== null) this.bands.canvas.before(this.shoreCanvas);
  }

  /** The canvas leaves the stage (it and the bakes stay for the page). */
  destroy(): void {
    if (this.bands.canvas.parentElement === this.host) this.bands.canvas.remove();
    this.bands.release();
  }
}
