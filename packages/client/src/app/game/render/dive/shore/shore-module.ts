// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4, ticket #801): what the dive's loader gets from
// this chunk. The land rings and the tiles are made once a page, like the mockup's bakes, so a return to the lobby
// bakes nothing again; the kelp band (ticket #802) bakes and draws from the same land and tiles, and the planet's
// forest test measures the shore's coast.

import type { RenderToTexture } from '../planet/dive-planet-mesh';
import { DiveShoreBand } from './dive-shore-band';
import { createDomShoreCanvasFactory, type ShoreCanvasFactory } from './shore-canvas';
import { ShoreCoast } from './shore-coast';
import { landRingsOf, type GeoRing, type LandRings } from './shore-coast-rings';
import { ShoreForestTest } from './shore-forest-test';
import { ShoreTiles } from './shore-tiles';

/** The shore's parts for one dive: the band for the dive's stage, the planet's forest test, and what the kelp shares. */
export interface DiveShoreParts {
  /** The land in metres, the tiles and the canvases they are drawn on: the kelp band bakes and draws from them. */
  readonly land: LandRings;
  readonly tiles: ShoreTiles;
  readonly factory: ShoreCanvasFactory;
  /** Whether the planet's forest shows under the shore, on the shore's coast. */
  readonly forest: ShoreForestTest;
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): DiveShoreBand;
}

interface PageShore {
  readonly land: LandRings;
  readonly tiles: ShoreTiles;
  readonly factory: ShoreCanvasFactory;
}

/** Made on the first dive of the page and kept: the tile bakes outlive the lobby, as the mockup's do. */
let pageShore: PageShore | null = null;

/** The shore for a dive over the Salish rings, its canvases from `documentReference`. */
export function createShoreParts(salishRings: readonly GeoRing[], documentReference: Document): DiveShoreParts {
  if (pageShore === null) {
    const factory = createDomShoreCanvasFactory(documentReference);
    pageShore = { land: landRingsOf(salishRings), tiles: new ShoreTiles(factory), factory };
  }
  const shore = pageShore;
  return {
    land: shore.land,
    tiles: shore.tiles,
    factory: shore.factory,
    forest: new ShoreForestTest(new ShoreCoast(shore.land)),
    createBand: (renderToTexture, devicePixelRatio) => new DiveShoreBand(shore, devicePixelRatio, renderToTexture),
  };
}
