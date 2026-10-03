// The shore's bake worker, without the worker (docs/rendering/opening-dive.md §4, ticket #809): the tiles any page
// lacks, then the level the page asks for, a step a turn, handing back to the worker's message queue between steps so
// a newer level asked for replaces the one under way. `shore-bake.worker.ts` gives it the worker's canvases and
// messaging; a spec gives it fakes. Nothing here holds a frame up, so a step needs no budget.

import { rasterise, type ShoreCanvas, type ShoreCanvasFactory, type ShoreImage } from './shore-canvas';
import {
  SHORE_BAKE_MESSAGE,
  snapshotTransfers,
  type ShoreBakeCommand,
  type ShoreBakeOpen,
  type ShoreBakeReport,
  type ShoreBakeRequest,
} from './shore-bake-messages';
import type { ShoreBakeStep } from './shore-pump';
import { bakeShoreSnapshot, type ShoreSnapshot, type ShoreSnapshotSources } from './shore-snapshot';
import { SHORE_TILE_BAKES, SHORE_TILE_NAMES, ShoreTiles, type ShoreTileName } from './shore-tiles';
import type { TileBake } from './shore-tiles-rock';

/** What the core runs on: the worker's own, or a spec's. */
export interface ShoreBakeWorkerScope {
  readonly factory: ShoreCanvasFactory;
  post(report: ShoreBakeReport, transfer: Transferable[]): void;
  /** Calls `resume` once the messages already queued have been handled. */
  yieldToMessages(resume: () => void): void;
  /** A copy of a tile's canvas to send, the canvas kept for the worker's patterns. */
  copyImage(canvas: ShoreCanvas): Promise<ImageBitmap>;
  /** A level's canvas made an image to send; the canvas is done with. */
  takeImage(image: ShoreImage): ImageBitmap;
}

interface LevelJob {
  readonly id: number;
  readonly bake: Generator<ShoreBakeStep, ShoreSnapshot>;
}

export class ShoreBakeWorkerCore {
  private sources: (ShoreSnapshotSources & { readonly tiles: ShoreTiles }) | null = null;
  /** Tiles the page has: baked here, or sent with `open`. */
  private readonly sent = new Set<ShoreTileName>();
  private request: ShoreBakeRequest | null = null;
  private job: LevelJob | null = null;
  private isTurnQueued = false;
  private hasFailed = false;

  constructor(
    private readonly scope: ShoreBakeWorkerScope,
    private readonly tileBakes: Readonly<Record<ShoreTileName, TileBake>> = SHORE_TILE_BAKES,
  ) {}

  handle(command: ShoreBakeCommand): void {
    if (command.type === SHORE_BAKE_MESSAGE.open) this.open(command);
    else this.request = command;
    this.queueTurn();
  }

  private open(command: ShoreBakeOpen): void {
    try {
      const { factory } = this.scope;
      const tiles = new ShoreTiles(factory, this.tileBakes);
      for (const tile of command.tiles) {
        const canvas = factory.create(tile.bitmap.width, tile.bitmap.height);
        canvas.context.drawImage(tile.bitmap, 0, 0, canvas.width, canvas.height);
        tile.bitmap.close();
        rasterise(canvas);
        tiles.adopt(tile.name, canvas, tile.averageRgba);
        this.sent.add(tile.name);
      }
      this.sources = { land: command.land, tiles, factory };
    } catch (error) {
      this.fail(error);
    }
  }

  private get hasWork(): boolean {
    if (this.hasFailed || this.sources === null) return false;
    return !this.sources.tiles.isBaked || this.request !== null;
  }

  private queueTurn(): void {
    if (this.isTurnQueued || !this.hasWork) return;
    this.isTurnQueued = true;
    this.scope.yieldToMessages(() => this.turn());
  }

  private turn(): void {
    this.isTurnQueued = false;
    try {
      this.step();
    } catch (error) {
      this.fail(error);
    }
    this.queueTurn();
  }

  /** The tiles first, as on the page; then a step of the newest level asked for. */
  private step(): void {
    const sources = this.sources;
    if (sources === null) return;
    if (!sources.tiles.isBaked) {
      if (sources.tiles.advance() === 'finished') this.sendNewTiles(sources.tiles);
      return;
    }
    const request = this.request;
    if (request === null) return;
    if (this.job?.id !== request.id) this.job = { id: request.id, bake: bakeShoreSnapshot(request.view, sources) };
    const step = this.job.bake.next();
    if (step.done !== true) return;
    this.sendLevel(request.id, step.value);
    this.job = null;
    this.request = null;
  }

  private sendNewTiles(tiles: ShoreTiles): void {
    for (const name of SHORE_TILE_NAMES) {
      if (this.sent.has(name) || !tiles.has(name)) continue;
      this.sent.add(name);
      const tile = tiles.get(name);
      if (tile === null) continue;
      void this.scope.copyImage(tile.canvas).then(
        (bitmap) =>
          this.scope.post({ type: SHORE_BAKE_MESSAGE.tile, name, bitmap, averageRgba: tile.averageRgba }, [bitmap]),
        (error: unknown) => this.fail(error),
      );
    }
  }

  private sendLevel(id: number, baked: ShoreSnapshot): void {
    const imageOf = (picture: ShoreSnapshot['colour']): ShoreSnapshot['colour'] => {
      const image = this.scope.takeImage(picture.image);
      return { width: image.width, height: image.height, image };
    };
    const snapshot: ShoreSnapshot = {
      ...baked,
      colour: imageOf(baked.colour),
      stones: baked.stones === null ? null : imageOf(baked.stones),
    };
    this.scope.post({ type: SHORE_BAKE_MESSAGE.level, id, snapshot }, snapshotTransfers(snapshot));
  }

  private fail(error: unknown): void {
    if (this.hasFailed) return;
    this.hasFailed = true;
    this.scope.post({ type: SHORE_BAKE_MESSAGE.failed, reason: String(error) }, []);
  }
}
