// The page's side of the shore's bake worker (docs/rendering/opening-dive.md §4, ticket #809): the tiles and the
// levels bake in `shore-bake.worker.ts`, so no bake step lands on the page's thread; the page only copies each tile
// into a canvas of its own (the kelp band and the live sea read them) and uploads each level. A level's bake is
// a generator like the page's own (`bakeShoreSnapshot`), so `ShoreLevels` runs either: this one yields
// `SHORE_BAKE_WAITING` until its level lands. Where the platform cannot bake offscreen, or the worker fails, the page
// bakes as it did before: a failed worker hands every bake under way back to the page.

import type { ShoreCanvas } from './shore-canvas';
import type { LandRings } from './shore-coast-rings';
import {
  SHORE_BAKE_MESSAGE,
  type ShoreBakeCommand,
  type ShoreBakeReport,
  type ShoreTileTransfer,
} from './shore-bake-messages';
import { canBakeShoreOffscreen, closeShoreImage } from './shore-offscreen';
import type { ShoreView } from './shore-paint';
import { SHORE_BAKE_WAITING, type ShoreBakeStep } from './shore-pump';
import { bakeShoreSnapshot, type ShoreSnapshot, type ShoreSnapshotSources } from './shore-snapshot';
import { SHORE_TILE_NAMES, type ShoreTiles } from './shore-tiles';

/** The slice of a `Worker` the thread uses; a spec gives a fake. */
export interface ShoreBakePort {
  postMessage(message: ShoreBakeCommand, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ShoreBakeReport>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/** What the thread tells the band: a tile landed (adopted into the page's tiles), a level landed, or it failed. */
export interface ShoreBakeListener {
  onTile(): void;
  onLevel(): void;
  onFailed(): void;
}

interface Landed {
  readonly id: number;
  readonly snapshot: ShoreSnapshot;
}

export class ShoreBakeThread {
  private lastId = 0;
  /** The level asked for last; any other that lands is stale and closed. */
  private wantedId = 0;
  private landed: Landed | null = null;
  private hasWorkerFailed = false;
  private isTerminated = false;
  private listener: ShoreBakeListener | null = null;

  constructor(
    private readonly port: ShoreBakePort,
    private readonly tiles: ShoreTiles,
  ) {
    port.onmessage = (event) => this.receive(event.data);
    port.onerror = () => this.fail();
  }

  /** Sends the land and every tile the page already has (a later dive's worker bakes none of them again). */
  async open(land: LandRings, toBitmap: (canvas: ShoreCanvas) => Promise<ImageBitmap>): Promise<void> {
    const baked = SHORE_TILE_NAMES.flatMap((name) => {
      const tile = this.tiles.has(name) ? this.tiles.get(name) : null;
      return tile === null ? [] : [{ name, tile }];
    });
    try {
      const transfers: ShoreTileTransfer[] = await Promise.all(
        baked.map(async ({ name, tile }) => ({
          name,
          bitmap: await toBitmap(tile.canvas),
          averageRgba: tile.averageRgba,
        })),
      );
      if (this.hasWorkerFailed || this.isTerminated) {
        for (const transfer of transfers) transfer.bitmap.close();
        return;
      }
      const tiles = transfers.map((transfer) => transfer.bitmap);
      this.port.postMessage({ type: SHORE_BAKE_MESSAGE.open, land, tiles: transfers }, tiles);
    } catch {
      this.fail();
    }
  }

  listen(listener: ShoreBakeListener): void {
    this.listener = listener;
  }

  /** Whether the worker has failed and the page bakes from here on. */
  get hasFailed(): boolean {
    return this.hasWorkerFailed;
  }

  /** A level's bake in the worker (`ShoreLevelBaker`); on the page, from where it stands, if the worker fails. */
  readonly bakeLevel = (view: ShoreView, sources: ShoreSnapshotSources): Generator<ShoreBakeStep, ShoreSnapshot> =>
    this.hasWorkerFailed ? bakeShoreSnapshot(view, sources) : this.awaitLevel(view, sources);

  private *awaitLevel(view: ShoreView, sources: ShoreSnapshotSources): Generator<ShoreBakeStep, ShoreSnapshot> {
    const id = this.request(view);
    for (;;) {
      if (this.hasWorkerFailed) return yield* bakeShoreSnapshot(view, sources);
      const landed = this.landed;
      if (landed?.id === id) {
        this.landed = null;
        return landed.snapshot;
      }
      yield SHORE_BAKE_WAITING;
    }
  }

  private request(view: ShoreView): number {
    this.lastId += 1;
    this.wantedId = this.lastId;
    this.dropLanded();
    this.port.postMessage({ type: SHORE_BAKE_MESSAGE.bake, id: this.wantedId, view }, []);
    return this.wantedId;
  }

  private receive(report: ShoreBakeReport): void {
    if (report.type === SHORE_BAKE_MESSAGE.failed) {
      this.fail();
      return;
    }
    if (report.type === SHORE_BAKE_MESSAGE.tile) {
      this.tiles.adoptBitmap(report);
      this.listener?.onTile();
      return;
    }
    if (report.id !== this.wantedId) {
      closeSnapshot(report.snapshot);
      return;
    }
    this.dropLanded();
    this.landed = { id: report.id, snapshot: report.snapshot };
    this.listener?.onLevel();
  }

  private dropLanded(): void {
    if (this.landed !== null) closeSnapshot(this.landed.snapshot);
    this.landed = null;
  }

  private fail(): void {
    if (this.hasWorkerFailed || this.isTerminated) return;
    this.hasWorkerFailed = true;
    this.port.terminate();
    this.listener?.onFailed();
  }

  /** The worker goes, and any level it sent that was not taken is closed. */
  terminate(): void {
    this.isTerminated = true;
    this.port.onmessage = null;
    this.port.onerror = null;
    this.port.terminate();
    this.dropLanded();
    this.listener = null;
  }
}

/** Closes a snapshot's pictures when they are a worker's bitmaps. */
export function closeSnapshot(snapshot: ShoreSnapshot): void {
  closeShoreImage(snapshot.colour.image);
  if (snapshot.stones !== null) closeShoreImage(snapshot.stones.image);
}

/** Starts the worker for a dive, or `null` where it cannot bake offscreen and the page bakes as before. */
export function openShoreBakeThread(
  scope: Partial<Pick<typeof globalThis, 'Worker' | 'OffscreenCanvas'>>,
  page: { readonly land: LandRings; readonly tiles: ShoreTiles },
  toBitmap: (canvas: ShoreCanvas) => Promise<ImageBitmap>,
): ShoreBakeThread | null {
  if (!canBakeShoreOffscreen(scope)) return null;
  // the builder bundles the worker from this exact form: `new Worker(new URL(…, import.meta.url))`
  const worker = new Worker(new URL('./shore-bake.worker', import.meta.url), { type: 'module' });
  const thread = new ShoreBakeThread(worker, page.tiles);
  void thread.open(page.land, toBitmap);
  return thread;
}
