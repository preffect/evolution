// What the page and the shore's bake worker say to each other (docs/rendering/opening-dive.md §4, ticket #809). The
// page opens the worker once a dive with the land and any tiles it already has, then asks for one level at a time;
// the worker sends each tile as it bakes and each level when it lands, its pictures as `ImageBitmap`s and its data
// as buffers, all transferred, so nothing is copied on the page's thread.

import { isShoreBitmap } from './shore-offscreen';
import type { LandRings } from './shore-coast-rings';
import type { ShoreView } from './shore-paint';
import type { ShoreSnapshot } from './shore-snapshot';
import type { ShoreTileBitmap } from './shore-tiles';

export const SHORE_BAKE_MESSAGE = {
  open: 'open',
  bake: 'bake',
  tile: 'tile',
  level: 'level',
  failed: 'failed',
} as const;

/** A baked tile on its way between the threads. */
export type ShoreTileTransfer = ShoreTileBitmap;

/** Page to worker, once: the land to draw and the tiles the page already has. */
export interface ShoreBakeOpen {
  readonly type: typeof SHORE_BAKE_MESSAGE.open;
  readonly land: LandRings;
  readonly tiles: readonly ShoreTileTransfer[];
}

/** Page to worker: bake this level; it replaces any level asked for before that has not landed. */
export interface ShoreBakeRequest {
  readonly type: typeof SHORE_BAKE_MESSAGE.bake;
  readonly id: number;
  readonly view: ShoreView;
}

export type ShoreBakeCommand = ShoreBakeOpen | ShoreBakeRequest;

export interface ShoreTileBaked extends ShoreTileTransfer {
  readonly type: typeof SHORE_BAKE_MESSAGE.tile;
}

/** Worker to page: the level asked for as `id`, its pictures `ImageBitmap`s. */
export interface ShoreLevelBaked {
  readonly type: typeof SHORE_BAKE_MESSAGE.level;
  readonly id: number;
  readonly snapshot: ShoreSnapshot;
}

/** Worker to page: it cannot bake (no `OffscreenCanvas` 2D, or a bake threw); the page bakes from here on. */
export interface ShoreBakeFailed {
  readonly type: typeof SHORE_BAKE_MESSAGE.failed;
  readonly reason: string;
}

export type ShoreBakeReport = ShoreTileBaked | ShoreLevelBaked | ShoreBakeFailed;

/** What a level's message hands over rather than copies: its pictures and its data's buffers. */
export function snapshotTransfers(snapshot: ShoreSnapshot): Transferable[] {
  const transfers: Transferable[] = [snapshot.sea.bytes.buffer, snapshot.ramp.bytes.buffer];
  for (const picture of [snapshot.colour, snapshot.stones]) {
    if (picture !== null && isShoreBitmap(picture.image)) transfers.push(picture.image);
  }
  return transfers;
}
