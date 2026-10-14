// Boulders along the shore (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `drawBoulders`): scattered
// near the coast from a few metres out in the water up to the rock band's top, more often low on the shore, never on
// the focal rock or the hand-placed pool, drawn back to front.

import { SHORE_ZONE_REACH_M } from '../../constants/dive-shore';
import { SHORE_BOULDER_SCATTER } from '../../constants/dive-shore-boulders';
import { SHORE_FIXED_POOL, SHORE_FOCAL_ROCK } from '../../constants/dive-shore-objects';
import { smoothstep } from '../../geometry';
import { drawBoulder, type Boulder } from './shore-boulder';
import { nearCoastCells, type NearCoastCell } from './shore-near-cells';
import type { ShorePaint } from './shore-paint';

function keepShare(heightM: number): number {
  const scatter = SHORE_BOULDER_SCATTER;
  if (heightM < 0) return scatter.keepInSea;
  return heightM < scatter.lowUnderM ? scatter.keepLow : scatter.keepHigh;
}

function isClear(cell: NearCoastCell): boolean {
  const scatter = SHORE_BOULDER_SCATTER;
  const rock = SHORE_FOCAL_ROCK;
  const pool = SHORE_FIXED_POOL;
  const isOnRock = Math.hypot(cell.x - rock.x, cell.y - rock.y) < scatter.clearOfRockM;
  const isOnPool =
    Math.hypot((cell.x - pool.x) / scatter.clearOfPool.squashX, cell.y - pool.y) < scatter.clearOfPool.radiusM;
  return !isOnRock && !isOnPool;
}

/** The boulders in view, back to front. */
export function shoreBoulders(paint: ShorePaint): Boulder[] {
  const scatter = SHORE_BOULDER_SCATTER;
  const cells = nearCoastCells(paint, {
    cellM: scatter.cellM,
    fromM: scatter.seaM,
    toM: SHORE_ZONE_REACH_M.band - scatter.belowBandM,
    salt: scatter.salt,
    maxCells: scatter.maxCells,
  });
  return cells
    .filter((cell) => cell.roll <= keepShare(cell.distanceM) && isClear(cell))
    .map((cell) => ({
      x: cell.x,
      y: cell.y,
      radius: scatter.radiusM.min + cell.size * cell.size * scatter.radiusM.span,
      seed: cell.column * scatter.seed.column + cell.row,
      heightM: cell.distanceM,
    }))
    .sort((first, second) => first.y - second.y);
}

/** Draws the boulders and answers them, so the live sea can keep its surf off the stones in the water. */
export function drawBoulders(paint: ShorePaint): readonly Boulder[] {
  const scatter = SHORE_BOULDER_SCATTER;
  const alpha = smoothstep(scatter.showBelowZoom, scatter.fullBelowZoom, paint.view.zoom);
  const boulders = shoreBoulders(paint);
  for (const boulder of boulders) {
    paint.context.globalAlpha = alpha;
    drawBoulder(paint, boulder);
  }
  paint.context.globalAlpha = 1;
  return boulders;
}
