// Fakes for the shore's bake worker (docs/rendering/opening-dive.md §4, ticket #809): a bitmap that records being
// closed (stubbed in as `ImageBitmap`, so the code under test takes it for one), a worker port that records what the
// page posts, and a worker scope whose turns a spec runs by hand.

import type { ShoreBakeCommand, ShoreBakeReport } from '../app/game/render/dive/shore/shore-bake-messages';
import type { ShoreBakePort } from '../app/game/render/dive/shore/shore-bake-thread';
import type { ShoreBakeWorkerScope } from '../app/game/render/dive/shore/shore-bake-worker-core';
import type { ShoreCanvas, ShoreImage } from '../app/game/render/dive/shore/shore-canvas';
import type { ShoreView } from '../app/game/render/dive/shore/shore-paint';
import type { ShoreSnapshot } from '../app/game/render/dive/shore/shore-snapshot';
import { createFakeShoreCanvasFactory, type FakeShoreCanvasFactory } from './fake-shore-canvas';

/** Stands in for `ImageBitmap`: its size, and whether it was closed. */
export class FakeBitmap {
  isClosed = false;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  close(): void {
    this.isClosed = true;
  }
}

/** A fake bitmap typed as the platform's, for the code under test. */
export function fakeBitmap(width = 4, height = 4): ImageBitmap {
  return new FakeBitmap(width, height) as unknown as ImageBitmap;
}

export function isClosed(bitmap: ShoreImage | ImageBitmap): boolean {
  return (bitmap as unknown as FakeBitmap).isClosed;
}

/** A level as the worker sends it: its pictures fake bitmaps, its data a texel each. */
export function fakeWorkerSnapshot(view: ShoreView): ShoreSnapshot {
  return {
    view,
    colour: { width: 4, height: 4, image: fakeBitmap() },
    stones: { width: 2, height: 2, image: fakeBitmap() },
    sea: { width: 1, height: 1, cellsPerMetre: 1, bytes: new Uint8Array(4) },
    ramp: { bytes: new Uint8Array(4), entries: 1, stepM: 1 },
  };
}

export interface Posted<Message> {
  readonly message: Message;
  readonly transfer: readonly Transferable[];
}

/** A worker as the page sees it: what was posted to it, and a way to answer as the worker. */
export class FakeShoreBakePort implements ShoreBakePort {
  readonly posted: Posted<ShoreBakeCommand>[] = [];
  onmessage: ((event: MessageEvent<ShoreBakeReport>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  isTerminated = false;

  postMessage(message: ShoreBakeCommand, transfer: Transferable[]): void {
    this.posted.push({ message, transfer });
  }

  terminate(): void {
    this.isTerminated = true;
  }

  /** The worker sends `report`. */
  send(report: ShoreBakeReport): void {
    this.onmessage?.({ data: report } as MessageEvent<ShoreBakeReport>);
  }

  /** The worker's script throws. */
  throwError(): void {
    this.onerror?.({} as ErrorEvent);
  }
}

/** A worker the page can make: it records where its script is and what it was sent. */
export class RecordingWorker extends FakeShoreBakePort {
  static made: RecordingWorker[] = [];

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    super();
    RecordingWorker.made.push(this);
  }
}

/** An `OffscreenCanvas` that has a 2D context, as far as the platform check asks. */
export class TwoDimensionalCanvas {
  getContext(): object {
    return {};
  }
}

/** The worker's side: recorded reports, and its turns queued until the spec runs them. */
export interface FakeShoreBakeScope extends ShoreBakeWorkerScope {
  readonly factory: FakeShoreCanvasFactory;
  readonly reports: Posted<ShoreBakeReport>[];
  /** Runs queued turns (and the ones they queue) until none is left or `limit` have run; answers how many ran. */
  runTurns(limit?: number): number;
}

const TURN_LIMIT = 100_000;

export function createFakeShoreBakeScope(): FakeShoreBakeScope {
  const turns: (() => void)[] = [];
  const reports: Posted<ShoreBakeReport>[] = [];
  return {
    factory: createFakeShoreCanvasFactory(),
    reports,
    post: (report, transfer) => reports.push({ message: report, transfer }),
    yieldToMessages: (resume) => turns.push(resume),
    copyImage: (canvas: ShoreCanvas) => Promise.resolve(fakeBitmap(canvas.width, canvas.height)),
    takeImage: (image: ShoreImage) => fakeBitmap(image.width, image.height),
    runTurns(limit = TURN_LIMIT) {
      let ran = 0;
      while (turns.length > 0 && ran < limit) {
        turns.shift()?.();
        ran += 1;
      }
      return ran;
    },
  };
}
