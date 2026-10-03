// The kelp band's lazily loaded entry (docs/rendering/opening-dive.md §4, ticket #802): what the dive's loader gets
// from this chunk. Its bakes are made once a page from the shore's land and canvases, like the shore's tiles, so a
// return to the lobby bakes nothing again; the band draws the rock's surface and foam with the shore's own tiles.

import type { RenderToTexture } from '../planet/dive-planet-mesh';
import type { ShoreCanvasFactory } from '../shore/shore-canvas';
import type { LandRings } from '../shore/shore-coast-rings';
import type { ShoreTiles } from '../shore/shore-tiles';
import type { DiveBaker } from '../dive-bake-pump';
import { DiveKelpBand } from './dive-kelp-band';
import { KelpBakes, kelpBaker } from './kelp-bakes';

/** What the kelp shares with the shore (`DiveShoreParts`): the land in metres, its tiles and its canvases. */
export interface KelpShoreShare {
  readonly land: LandRings;
  readonly tiles: ShoreTiles;
  readonly factory: ShoreCanvasFactory;
}

/** The kelp's parts for one dive: its bakes for the dive's pump, and the band for its stage. */
export interface DiveKelpParts {
  readonly bakes: DiveBaker;
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): DiveKelpBand;
}

/** Made on the first dive of the page and kept: the bakes outlive the lobby. */
let pageBakes: KelpBakes | null = null;

/** The kelp over the shore's share, its bakes stepped on `nowMs`, the dive's clock. */
export function createKelpParts(shore: KelpShoreShare, nowMs: () => number): DiveKelpParts {
  pageBakes ??= new KelpBakes({ land: shore.land, factory: shore.factory });
  const bakes = pageBakes;
  return {
    bakes: kelpBaker(bakes, nowMs),
    createBand: (renderToTexture, devicePixelRatio) =>
      new DiveKelpBand({ bakes, tiles: shore.tiles }, devicePixelRatio, renderToTexture),
  };
}
