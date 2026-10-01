// The shore's canvases (docs/rendering/opening-dive.md §4, ticket #801): the tiles and the level-of-detail snapshots
// are drawn through `ShoreContext2D`, the slice of Canvas 2D they use, so a unit test records them on a fake and the
// browser gets a real canvas. Every shore canvas is made for pixel reads (`willReadFrequently`): it rasterises on the
// CPU, in this thread, so a bake never waits on the GPU process. The mockup drew its zone layers on GPU canvases and
// read pixels back between them, and a frame then cost seconds on a box without a GPU (PR #799's evidence).

import type { BakeContext2D } from '../../textures/texture-bake';

/** The pixels a bake writes and puts: an `ImageData`'s shape. */
export interface ShorePixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** A pattern's placement: `setTransform` takes the 2D matrix the pattern's tile is laid down by. */
export interface ShorePattern {
  setTransform(transform: DOMMatrix2DInit): void;
}

/** The Canvas 2D calls the shore makes on top of a texture bake's (`BakeContext2D`). */
export interface ShoreContext2D extends BakeContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern | ShorePattern | BakeContext2D['fillStyle'];
  strokeStyle: string | CanvasGradient | CanvasPattern | ShorePattern | BakeContext2D['strokeStyle'];
  lineJoin: CanvasLineJoin;
  lineDashOffset: number;
  imageSmoothingQuality: ImageSmoothingQuality;
  fill(fillRule?: CanvasFillRule): void;
  clip(fillRule?: CanvasFillRule): void;
  setTransform(
    scaleX: number,
    skewY: number,
    skewX: number,
    scaleY: number,
    translateX: number,
    translateY: number,
  ): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  roundRect(x: number, y: number, width: number, height: number, radius: number): void;
  drawImage(image: ShoreImage, x: number, y: number, width: number, height: number): void;
  /** The `sx, sy, sw, sh` part of `image` drawn into `dx, dy, dw, dh`. */
  drawImage(
    image: ShoreImage,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  createPattern(image: ShoreImage, repetition: 'repeat'): ShorePattern | null;
  createImageData(width: number, height: number): ShorePixels;
  getImageData(x: number, y: number, width: number, height: number): ShorePixels;
  putImageData(pixels: ShorePixels, x: number, y: number): void;
}

/** What a shore canvas is drawn from: another shore canvas's element (a real canvas, or a fake's stand-in). */
export type ShoreImage = HTMLCanvasElement | ShoreCanvasStandIn;

/** A fake canvas's element: only its size. */
export interface ShoreCanvasStandIn {
  readonly width: number;
  readonly height: number;
}

export interface ShoreCanvas {
  readonly width: number;
  readonly height: number;
  readonly context: ShoreContext2D;
  /** What another canvas draws this one from, and what a texture is made of. */
  readonly image: ShoreImage;
}

export interface ShoreCanvasFactory {
  create(width: number, height: number): ShoreCanvas;
}

const MIN_CANVAS_PX = 1;

/** The browser factory: one detached `<canvas>` per bake, made for pixel reads so it rasterises on the CPU. */
export function createDomShoreCanvasFactory(documentReference: Document): ShoreCanvasFactory {
  return {
    create(width, height) {
      const element = documentReference.createElement('canvas');
      element.width = Math.max(MIN_CANVAS_PX, Math.ceil(width));
      element.height = Math.max(MIN_CANVAS_PX, Math.ceil(height));
      const context = element.getContext('2d', { willReadFrequently: true });
      if (context === null) throw new Error('Canvas 2D is unavailable: the shore cannot bake.');
      return { width: element.width, height: element.height, context: context as ShoreContext2D, image: element };
    },
  };
}

/**
 * Rasterises what has been drawn on the canvas so far. Canvas 2D records its calls and draws them later, when the
 * canvas is read or drawn from; reading one pixel makes that happen now, inside the bake's own step, rather than in
 * the frame that first uploads the level.
 */
export function rasterise(canvas: ShoreCanvas): void {
  canvas.context.getImageData(0, 0, 1, 1);
}
