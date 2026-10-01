// One level of detail of the shore, baked (docs/rendering/opening-dive.md §4, ticket #801): everything of the
// mockup's `drawShore` that stands still, drawn once on a CPU canvas, step by step across frames, plus the live sea's
// data texture. The order is the mockup's: the sea, then the land's edge inside the land (the zones, the beaches, the
// pools, the driftwood), then the boulders over both.

import { SHORE_BOULDER_SCATTER } from '../../constants/dive-shore-boulders';
import { SHORE_SEA_GRID } from '../../constants/dive-shore';
import { SHORE_DRIFTWOOD, SHORE_POOLS } from '../../constants/dive-shore-objects';
import { smoothstep } from '../../geometry';
import type { Boulder } from './shore-boulder';
import { drawBoulders } from './shore-boulders';
import { rasterise, type ShoreCanvas, type ShoreCanvasFactory } from './shore-canvas';
import { ShoreCoast } from './shore-coast';
import type { LandRings } from './shore-coast-rings';
import { drawLandEdge, withLandClip } from './shore-land';
import { setWorldTransform, type ShorePaint, type ShoreView } from './shore-paint';
import { drawPools } from './shore-pools';
import { drawSea } from './shore-sea';
import { shoreSeaData, shoreStones, type ShoreSeaData } from './shore-sea-data';
import { capHalfWidth, seaGridOf } from './shore-sea-grid';
import { shoreSeaRamp, type ShoreSeaRamp } from './shore-sea-ramp';
import { drawBeaches, drawDriftwood } from './shore-shore-life';
import type { ShoreTileSource } from './shore-tiles';

/** A baked level: its view, its colour, the distance grid, the stones in the water, and the sea strokes' reach. */
export interface ShoreSnapshot {
  readonly view: ShoreView;
  readonly colour: ShoreCanvas;
  readonly sea: ShoreSeaData;
  readonly stones: ShoreCanvas | null;
  /** The water's colour and the floor's share by distance to the coast. */
  readonly ramp: ShoreSeaRamp;
}

/** What a snapshot is drawn from: the land in metres, the tiles and a canvas factory. */
export interface ShoreSnapshotSources {
  readonly land: LandRings;
  readonly tiles: ShoreTileSource;
  readonly factory: ShoreCanvasFactory;
}

function paintFor(view: ShoreView, sources: ShoreSnapshotSources): ShorePaint {
  const canvas = sources.factory.create(view.widthPx * view.devicePixelRatio, view.heightPx * view.devicePixelRatio);
  const coast = new ShoreCoast(sources.land);
  coast.build({ halfWidthM: view.halfWidthM, halfHeightM: view.halfHeightM, pixelsPerMetre: view.pixelsPerMetre });
  return {
    view,
    canvas,
    context: canvas.context,
    coast,
    tiles: sources.tiles,
    factory: sources.factory,
    patterns: new Map(),
    zoneLayers: new Map(),
  };
}

/** The land's edge and what lies on the upper shore, inside the land, a few steps at a time. */
function* drawLand(paint: ShorePaint): Generator<void, void> {
  const { context, view } = paint;
  context.save();
  setWorldTransform(paint);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  yield* drawLandEdge(paint);
  withLandClip(paint, () => {
    drawBeaches(paint);
    if (view.zoom < SHORE_POOLS.showBelowZoom) drawPools(paint);
    if (view.zoom < SHORE_DRIFTWOOD.showBelowZoom) drawDriftwood(paint);
  });
  context.restore();
  rasterise(paint.canvas);
  yield;
}

function drawStones(paint: ShorePaint): readonly Boulder[] {
  if (paint.view.zoom >= SHORE_BOULDER_SCATTER.showBelowZoom) return [];
  paint.context.save();
  setWorldTransform(paint);
  const boulders = drawBoulders(paint);
  paint.context.restore();
  return boulders;
}

/** Bakes the level drawn over `view`, a step at a time: each `yield` is a point the scheduler may stop at. */
export function* bakeShoreSnapshot(view: ShoreView, sources: ShoreSnapshotSources): Generator<void, ShoreSnapshot> {
  const paint = paintFor(view, sources);
  yield;
  const grid = seaGridOf(paint);
  const sea = shoreSeaData(paint, grid);
  const ramp = shoreSeaRamp({
    strokeReachM: capHalfWidth(paint, Number.POSITIVE_INFINITY),
    cellM: SHORE_SEA_GRID.cellPx / view.pixelsPerMetre,
    farthestM: grid.maxDistance,
  });
  yield;
  drawSea(paint);
  rasterise(paint.canvas);
  yield;
  yield* drawLand(paint);
  const boulders = drawStones(paint);
  rasterise(paint.canvas);
  yield;
  const boulderAlpha = smoothstep(SHORE_BOULDER_SCATTER.showBelowZoom, SHORE_BOULDER_SCATTER.fullBelowZoom, view.zoom);
  const stones = shoreStones(paint, { boulders, alpha: boulderAlpha });
  return { view, colour: paint.canvas, sea, stones, ramp };
}
