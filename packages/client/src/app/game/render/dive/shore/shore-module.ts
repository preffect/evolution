// The shore's lazily loaded entry (docs/rendering/opening-dive.md §4, ticket #801): what the dive's loader gets from
// this chunk. The land rings and the tiles are made once a page, like the mockup's bakes, so a return to the lobby
// bakes nothing again; the coast and the tiles are also handed to the mockup's kelp and slime bands until tickets
// #802 and #803 move them.

import type { RenderToTexture } from '../planet/dive-planet-mesh';
import type { MockupTile, MockupTiles } from '../mockup/dive-mockup-bands';
import { DiveShoreBand } from './dive-shore-band';
import { createDomShoreCanvasFactory, type ShoreCanvasFactory } from './shore-canvas';
import { ShoreCoast } from './shore-coast';
import { landRingsOf, type GeoRing, type LandRings } from './shore-coast-rings';
import { SHORE_TILE_NAMES, ShoreTiles, type ShoreTileName } from './shore-tiles';

/** The shore's parts for one dive: its coast and tiles for the mockup, and the band for the dive's stage. */
export interface DiveShoreParts {
  /** The coast the mockup's kelp band and forest test build each frame. */
  readonly coast: ShoreCoast;
  readonly tiles: ShoreTiles;
  /** The tiles as the mockup reads them. */
  readonly mockupTiles: MockupTiles;
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): DiveShoreBand;
}

interface PageShore {
  readonly land: LandRings;
  readonly tiles: ShoreTiles;
  readonly factory: ShoreCanvasFactory;
}

/** Made on the first dive of the page and kept: the tile bakes outlive the lobby, as the mockup's do. */
let pageShore: PageShore | null = null;

function isTileName(name: string): name is ShoreTileName {
  return (SHORE_TILE_NAMES as readonly string[]).includes(name);
}

function mockupTilesOf(tiles: ShoreTiles): MockupTiles {
  return {
    get: (name): MockupTile | null => {
      if (!isTileName(name)) return null;
      const tile = tiles.get(name);
      return tile === null
        ? null
        : { canvas: tile.canvas.image as HTMLCanvasElement, averageColour: tile.averageColour };
    },
  };
}

/** The shore for a dive over the Salish rings, its canvases from `documentReference`. */
export function createShoreParts(salishRings: readonly GeoRing[], documentReference: Document): DiveShoreParts {
  if (pageShore === null) {
    const factory = createDomShoreCanvasFactory(documentReference);
    pageShore = { land: landRingsOf(salishRings), tiles: new ShoreTiles(factory), factory };
  }
  const shore = pageShore;
  return {
    coast: new ShoreCoast(shore.land),
    tiles: shore.tiles,
    mockupTiles: mockupTilesOf(shore.tiles),
    createBand: (renderToTexture, devicePixelRatio) => new DiveShoreBand(shore, devicePixelRatio, renderToTexture),
  };
}
