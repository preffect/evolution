// The shore's canvases and images off the page (docs/rendering/opening-dive.md §4, ticket #809): the bake worker's
// `OffscreenCanvas` factory, whether this platform can bake offscreen at all, and the bitmaps a worker sends. Apart
// from `shore-canvas.ts` because these read the platform's globals, which a node spec's import graph must not.

import type { ShoreCanvasFactory, ShoreContext2D, ShoreImage } from './shore-canvas';

/** The worker's factory (`shore-bake.worker.ts`): an `OffscreenCanvas` per bake, made for pixel reads like the page's. */
export function createOffscreenShoreCanvasFactory(): ShoreCanvasFactory {
  return {
    create(width, height) {
      const canvas = new OffscreenCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) throw new Error('OffscreenCanvas 2D is unavailable: the shore bakes on the page.');
      return { width: canvas.width, height: canvas.height, context: context as ShoreContext2D, image: canvas };
    },
  };
}

/** Whether a worker can bake the shore here: workers and `OffscreenCanvas` with a 2D context. */
export function canBakeShoreOffscreen(scope: Partial<Pick<typeof globalThis, 'Worker' | 'OffscreenCanvas'>>): boolean {
  if (scope.Worker === undefined || scope.OffscreenCanvas === undefined) return false;
  try {
    return new scope.OffscreenCanvas(1, 1).getContext('2d') !== null;
  } catch {
    return false;
  }
}

/** Whether the image is a bitmap a worker sent (none exists where the platform has no `ImageBitmap`). */
export function isShoreBitmap(image: ShoreImage): image is ImageBitmap {
  return typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;
}

/** Gives an image's memory back now when it is a bitmap; a canvas's goes with its last reference. */
export function closeShoreImage(image: ShoreImage): void {
  if (isShoreBitmap(image)) image.close();
}
