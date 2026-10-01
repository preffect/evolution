// The dive's upper bands on the stage (docs/rendering/opening-dive.md §4): the mockup's Canvas 2D drawing
// (`mockup/dive-mockup-bands.js`) on its own canvas beside the Pixi canvas, which clears to transparent. The browser
// composites the two. Uploading the canvas as a Pixi texture every frame (a readback of it) was built first and
// dropped: the bands' drawing then took 1,498 ms a frame at zoom 3.3, against 16 ms on a canvas of their own (§6).
// While the planet shows (it is the game's, on the Pixi canvas: `dive-planet-band.ts`) this canvas lies over the Pixi
// canvas, so the shore draws over the planet; otherwise under it, so the game's dish draws over the slime.
// The module, the planet's bakes and the coastlines load with the dive — a separate chunk and two JSON files — never
// with the game.

import { DIVE_SALISH_RINGS_URL, DIVE_WORLD_RINGS_URL } from '../constants';
import type { DiveBaker } from './dive-bake-pump';
import type { DivePlanetKeptBakes, DivePlanetSource } from './dive-planet-band';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';
import type { DiveCoastRing } from './planet/dive-planet-bakes';

/** What the dive's lazy chunk gives the session: the mockup's bands and the planet's coastline bakes. */
export interface DiveUpperBands {
  readonly mockup: MockupBands;
  readonly planet: DivePlanetSource;
}

/** Fetches the mockup's module, the planet's bakes and the coastlines they draw from; the bands run on the dive's clock. */
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
 * loader, which lives for the page, so a return to the lobby does not bake them again.
 */
export function diveUpperBandsLoader(fetchJson: JsonFetch): DiveUpperBandsLoader {
  const kept: DivePlanetKeptBakes = new Map();
  return async (nowMs) => {
    const [mockupModule, planetModule, worldRings, salishRings] = await Promise.all([
      import('./mockup/dive-mockup-bands.js'),
      import('./planet/dive-planet-bakes'),
      fetchRings(fetchJson, DIVE_WORLD_RINGS_URL),
      fetchRings(fetchJson, DIVE_SALISH_RINGS_URL),
    ]);
    return {
      mockup: mockupModule.createMockupBands({ salishRings, nowMs }),
      planet: { plan: planetModule.createDivePlanetBakePlan(worldRings, salishRings), kept },
    };
  };
}

/** The real loader, over the page's `fetch`. */
export const loadDiveUpperBands: DiveUpperBandsLoader = diveUpperBandsLoader((url) => fetch(url));

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

  /**
   * Shown and drawn while a mockup band draws; hidden, and not drawn, otherwise. Answers whether the planet shows
   * under it: by the mockup's own test while it draws, by the band table when it does not.
   */
  draw(frame: MockupFrame, isDrawing: boolean): boolean {
    this.bands.canvas.hidden = !isDrawing;
    return isDrawing ? this.bands.draw(frame) : frame.bands.planet.isActive;
  }

  /** Lays the canvas over the game's (the planet shows under it) or under it (the game's dish over the slime). */
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
