// The shore's bake worker (docs/rendering/opening-dive.md §4, ticket #809): `ShoreBakeWorkerCore` on this worker's
// `OffscreenCanvas`es, so a tile or a level bake step never blocks the page. Bundled by the Angular builder from
// `shore-bake-thread.ts`'s `new Worker(new URL(…))`, inside the dive's lazy chunk; terminated with the dive.

import type { ShoreBakeCommand } from './shore-bake-messages';
import { ShoreBakeWorkerCore } from './shore-bake-worker-core';
import { createOffscreenShoreCanvasFactory } from './shore-offscreen';

/** A zero-delay hop through the worker's message queue: a timer would be clamped, and timers are the clock's alone. */
const turns = new MessageChannel();
let resumeTurn: (() => void) | null = null;
turns.port1.onmessage = () => {
  const resume = resumeTurn;
  resumeTurn = null;
  resume?.();
};

const core = new ShoreBakeWorkerCore({
  factory: createOffscreenShoreCanvasFactory(),
  post: (report, transfer) => self.postMessage(report, { transfer }),
  yieldToMessages: (resume) => {
    resumeTurn = resume;
    turns.port2.postMessage(null);
  },
  copyImage: (canvas) => createImageBitmap(canvas.image as OffscreenCanvas),
  takeImage: (image) => (image as OffscreenCanvas).transferToImageBitmap(),
});

self.onmessage = (event: MessageEvent<ShoreBakeCommand>) => core.handle(event.data);
