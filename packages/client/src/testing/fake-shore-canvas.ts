// A recording Canvas 2D for the dive's shore (docs/rendering/opening-dive.md §4, ticket #801): the texture bakes'
// recording context (`fake-bake-canvas.ts`) with the calls the shore adds — clips, transforms, patterns, pixel buffers
// and image draws — so a spec counts a snapshot's layers and reads where its shapes go without a DOM canvas.

import type {
  ShoreCanvas,
  ShoreCanvasFactory,
  ShoreContext2D,
  ShoreImage,
  ShorePattern,
  ShorePixels,
} from '../app/game/render/dive/shore/shore-canvas';
import { FakeBakeContext } from './fake-bake-canvas';

const RGBA = 4;

/** A pattern that records every placement it was given. */
export class FakeShorePattern implements ShorePattern {
  readonly transforms: DOMMatrix2DInit[] = [];

  constructor(readonly image: ShoreImage) {}

  setTransform(transform: DOMMatrix2DInit): void {
    this.transforms.push(transform);
  }
}

/** One recorded image draw: the image and its numbers. */
export interface RecordedImageDraw {
  readonly image: ShoreImage;
  readonly args: readonly number[];
  readonly alpha: number;
  readonly operation: GlobalCompositeOperation;
}

export class FakeShoreContext extends FakeBakeContext implements ShoreContext2D {
  lineJoin: CanvasLineJoin = 'miter';
  lineDashOffset = 0;
  imageSmoothingQuality: ImageSmoothingQuality = 'low';
  readonly patterns: FakeShorePattern[] = [];
  readonly imageDraws: RecordedImageDraw[] = [];
  readonly puts: ShorePixels[] = [];
  /** The rules every `fill` and `clip` was given, in order (`undefined` for none). */
  readonly fillRules: (CanvasFillRule | undefined)[] = [];
  readonly clipRules: (CanvasFillRule | undefined)[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    super();
  }

  override fill(fillRule?: CanvasFillRule): void {
    this.fillRules.push(fillRule);
    super.fill();
  }

  clip(fillRule?: CanvasFillRule): void {
    this.clipRules.push(fillRule);
    this.ops.push('clip');
    this.calls.push({ name: 'clip', args: [] });
  }

  setTransform(...args: number[]): void {
    this.ops.push('setTransform');
    this.calls.push({ name: 'setTransform', args });
  }

  clearRect(...args: number[]): void {
    this.ops.push('clearRect');
    this.calls.push({ name: 'clearRect', args });
  }

  roundRect(...args: number[]): void {
    this.ops.push('roundRect');
    this.calls.push({ name: 'roundRect', args });
  }

  drawImage(image: ShoreImage, ...args: number[]): void {
    this.ops.push('drawImage');
    this.calls.push({ name: 'drawImage', args });
    this.imageDraws.push({ image, args, alpha: this.globalAlpha, operation: this.globalCompositeOperation });
  }

  createPattern(image: ShoreImage): ShorePattern {
    const pattern = new FakeShorePattern(image);
    this.patterns.push(pattern);
    return pattern;
  }

  createImageData(width: number, height: number): ShorePixels {
    return { width, height, data: new Uint8ClampedArray(width * height * RGBA) };
  }

  getImageData(_left: number, _top: number, width: number, height: number): ShorePixels {
    this.ops.push('getImageData');
    return this.createImageData(width, height);
  }

  putImageData(pixels: ShorePixels): void {
    this.ops.push('putImageData');
    this.puts.push(pixels);
  }
}

export interface FakeShoreCanvas extends ShoreCanvas {
  readonly context: FakeShoreContext;
}

export interface FakeShoreCanvasFactory extends ShoreCanvasFactory {
  readonly canvases: FakeShoreCanvas[];
  create(width: number, height: number): FakeShoreCanvas;
}

export function createFakeShoreCanvasFactory(): FakeShoreCanvasFactory {
  const canvases: FakeShoreCanvas[] = [];
  return {
    canvases,
    create(width, height) {
      const size = { width: Math.max(1, Math.ceil(width)), height: Math.max(1, Math.ceil(height)) };
      const canvas: FakeShoreCanvas = { ...size, context: new FakeShoreContext(size.width, size.height), image: size };
      canvases.push(canvas);
      return canvas;
    },
  };
}
