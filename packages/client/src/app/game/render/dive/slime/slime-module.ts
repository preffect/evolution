// The slime band's lazily loaded entry (docs/rendering/opening-dive.md §4, ticket #803): what the dive's loader gets
// from this chunk. Its scatters and pictures bake on the dive's pump, drawn at the dive's device pixel ratio and kept
// for the page at that ratio, so a return to the lobby bakes nothing again; it draws its caustics with the shore's own
// tile and bakes on the shore's canvases.

import type { DiveBaker } from '../dive-bake-pump';
import type { RenderToTexture } from '../planet/dive-planet-mesh';
import type { ShoreCanvasFactory } from '../shore/shore-canvas';
import type { ShoreTileSource } from '../shore/shore-tiles';
import { DiveSlimeBand } from './dive-slime-band';
import { SlimeBakes, slimeBaker } from './slime-bakes';

/** What the slime shares with the shore (`DiveShoreParts`): its tiles (the caustic net) and its canvases. */
export interface SlimeShoreShare {
  readonly tiles: ShoreTileSource;
  readonly factory: ShoreCanvasFactory;
}

/** A slime band and the bakes the dive's pump runs for it. */
export interface DiveSlimeBandParts {
  readonly band: DiveSlimeBand;
  readonly bakes: DiveBaker;
}

export interface DiveSlimeParts {
  createBand(renderToTexture: RenderToTexture, devicePixelRatio: number): DiveSlimeBandParts;
}

/** Made on the first dive of the page at each device pixel ratio and kept: the bakes outlive the lobby. */
const pageBakes = new Map<number, SlimeBakes>();

/** The slime over the shore's share, its bakes stepped on `nowMs`, the dive's clock. */
export function createSlimeParts(shore: SlimeShoreShare, nowMs: () => number): DiveSlimeParts {
  return {
    createBand: (renderToTexture, devicePixelRatio) => {
      const bakes = pageBakes.get(devicePixelRatio) ?? new SlimeBakes({ factory: shore.factory, devicePixelRatio });
      pageBakes.set(devicePixelRatio, bakes);
      const sources = { bakes, tiles: shore.tiles, factory: shore.factory };
      return { band: new DiveSlimeBand(sources, renderToTexture), bakes: slimeBaker(bakes, nowMs) };
    },
  };
}
