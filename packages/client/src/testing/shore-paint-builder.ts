// What a shore drawing spec draws on (docs/rendering/opening-dive.md §4, ticket #801): a level's view at a zoom, a
// recording canvas, the coast built over a small test land, and tiles that are all baked (recording canvases with a
// known mean colour), so a spec reads the calls a drawing makes without baking a single real tile.

import { DIVE_FOCUS_DEGREES } from '../app/game/render/constants/dive';
import { ShoreCoast } from '../app/game/render/dive/shore/shore-coast';
import { landRingsOf, type GeoRing, type LandRings } from '../app/game/render/dive/shore/shore-coast-rings';
import { shoreLevelAt, shoreLevelView, type StageSize } from '../app/game/render/dive/shore/shore-lod';
import type { ShorePaint, ShoreView } from '../app/game/render/dive/shore/shore-paint';
import {
  SHORE_TILE_NAMES,
  type ShoreTile,
  type ShoreTileName,
  type ShoreTileSource,
} from '../app/game/render/dive/shore/shore-tiles';
import type { TileBake, TileBakeKit } from '../app/game/render/dive/shore/shore-tiles-rock';
import {
  createFakeShoreCanvasFactory,
  type FakeShoreCanvas,
  type FakeShoreCanvasFactory,
  type FakeShoreContext,
} from './fake-shore-canvas';

const { longitude, latitude } = DIVE_FOCUS_DEGREES;
const QUICK_TILE_PX = 8;

/** The lobby's stage at 1280 × 800 (`dive-1280-*` baselines). */
export const TEST_SHORE_STAGE: StageSize = { width: 830, height: 467 };

/**
 * Land north of the focus with a wavy coast through it, and a far frame that sets the data's box, so every edge of
 * the land near the focus is coast.
 */
export const TEST_SHORE_RINGS: readonly GeoRing[] = [
  [
    [longitude, latitude],
    [longitude + 0.004, latitude + 0.0004],
    [longitude + 0.02, latitude - 0.001],
    [longitude + 0.03, latitude + 0.03],
    [longitude - 0.03, latitude + 0.03],
    [longitude - 0.02, latitude - 0.0005],
    [longitude - 0.004, latitude + 0.0003],
    [longitude, latitude],
  ],
  [
    [longitude - 1, latitude - 1],
    [longitude + 1, latitude - 1],
    [longitude + 1, latitude + 1],
    [longitude - 1, latitude + 1],
    [longitude - 1, latitude - 1],
  ],
];

export const TEST_SHORE_LAND: LandRings = landRingsOf(TEST_SHORE_RINGS);

/** A tile source where every tile has baked: a recording canvas its size with a mid-grey mean colour. */
export function bakedTestTiles(factory: FakeShoreCanvasFactory = createFakeShoreCanvasFactory()): ShoreTileSource {
  const tiles = new Map<ShoreTileName, ShoreTile>();
  for (const name of SHORE_TILE_NAMES) {
    const canvas = factory.create(64, 64);
    tiles.set(name, {
      canvas,
      sizePx: canvas.width,
      averageColour: 'rgba(128,128,128,0.5)',
      averageRgba: [0.5, 0.5, 0.5, 0.5],
    });
  }
  return { get: (name) => tiles.get(name) ?? null, isBaked: true };
}

export interface TestShorePaint extends ShorePaint {
  readonly canvas: FakeShoreCanvas;
  readonly context: FakeShoreContext;
  readonly factory: FakeShoreCanvasFactory;
}

/** A paint over the level `zoom` lies in, or over `view` when one is given. */
export function testShorePaint(zoom: number, view?: ShoreView): TestShorePaint {
  const shoreView = view ?? shoreLevelView(shoreLevelAt(zoom), TEST_SHORE_STAGE, 1);
  const factory = createFakeShoreCanvasFactory();
  const canvas = factory.create(
    shoreView.widthPx * shoreView.devicePixelRatio,
    shoreView.heightPx * shoreView.devicePixelRatio,
  );
  const coast = new ShoreCoast(TEST_SHORE_LAND);
  coast.build({
    halfWidthM: shoreView.halfWidthM,
    halfHeightM: shoreView.halfHeightM,
    pixelsPerMetre: shoreView.pixelsPerMetre,
  });
  return {
    view: shoreView,
    canvas,
    context: canvas.context,
    coast,
    tiles: bakedTestTiles(factory),
    factory,
    patterns: new Map(),
    zoneLayers: new Map(),
  };
}

/**
 * Time allowed for one real tile bake in `shore-tiles.spec.ts`: a full-size foam tile is a per-pixel loop that takes
 * seconds on a loaded 4-core box, past vitest's 5 s default (it timed out in PR #808's merge gate).
 */
export const SHORE_TILE_BAKE_TEST_TIMEOUT_MS = 30_000;

/**
 * Time allowed for one shore integration case in `dive-shore.integration.spec.ts`: each opens a dive and steps the
 * scheduler through seconds of real level bakes 10 ms at a time, which ran past vitest's 5 s default on a loaded box
 * (PR #810's merge gate).
 */
export const SHORE_INTEGRATION_TEST_TIMEOUT_MS = 30_000;

/** Every tile's bake as a quick stand-in: one step, then a small recording canvas. */
export const QUICK_TILE_BAKES = Object.fromEntries(
  SHORE_TILE_NAMES.map((name) => [
    name,
    function* (kit: TileBakeKit) {
      yield;
      return kit.factory.create(QUICK_TILE_PX, QUICK_TILE_PX);
    },
  ]),
) as Record<ShoreTileName, TileBake>;
