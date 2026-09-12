// A recording Canvas 2D for the texture bakes (docs/TESTING.md §4): every call is logged with its
// numeric arguments so a test can count a bake's layers, read where its curves go and check its
// gradients without a DOM canvas.

import type {
  BakeCanvas,
  BakeCanvasFactory,
  BakeContext2D,
  BakeGradient,
} from '../app/game/render/textures/texture-bake';

export interface RecordedGradient extends BakeGradient {
  readonly kind: 'radial' | 'linear';
  /** The `create…Gradient` arguments: `x0, y0, r0, x1, y1, r1` for a radial, `x0, y0, x1, y1` for a linear. */
  readonly geometry: readonly number[];
  readonly stops: { offset: number; colour: string }[];
}

/** One logged call: its name and the numbers it was given (a `stroke` records the line width in force). */
export interface RecordedCall {
  readonly name: string;
  readonly args: readonly number[];
}

const PAINT_OPERATIONS = new Set(['fill', 'stroke', 'fillRect']);

export class FakeBakeContext implements BakeContext2D {
  /** Every call by name, in order; `calls` carries the same sequence with its arguments. */
  readonly ops: string[] = [];
  readonly calls: RecordedCall[] = [];
  readonly gradients: RecordedGradient[] = [];
  fillStyle: string | BakeGradient | CanvasPattern = '';
  strokeStyle: string | BakeGradient | CanvasPattern = '';
  lineWidth = 1;
  lineCap: 'butt' | 'round' | 'square' = 'butt';
  globalAlpha = 1;

  private log(name: string, args: readonly number[] = []): void {
    this.ops.push(name);
    this.calls.push({ name, args });
  }

  save(): void {
    this.log('save');
  }
  restore(): void {
    this.log('restore');
  }
  translate(...args: number[]): void {
    this.log('translate', args);
  }
  scale(...args: number[]): void {
    this.log('scale', args);
  }
  rotate(...args: number[]): void {
    this.log('rotate', args);
  }
  beginPath(): void {
    this.log('beginPath');
  }
  closePath(): void {
    this.log('closePath');
  }
  moveTo(...args: number[]): void {
    this.log('moveTo', args);
  }
  lineTo(...args: number[]): void {
    this.log('lineTo', args);
  }
  quadraticCurveTo(...args: number[]): void {
    this.log('quadraticCurveTo', args);
  }
  bezierCurveTo(...args: number[]): void {
    this.log('bezierCurveTo', args);
  }
  arc(...args: (number | boolean | undefined)[]): void {
    this.log(
      'arc',
      args.map((argument) => Number(argument)),
    );
  }
  ellipse(...args: number[]): void {
    this.log('ellipse', args);
  }
  rect(...args: number[]): void {
    this.log('rect', args);
  }
  fill(): void {
    this.log('fill');
  }
  stroke(): void {
    this.log('stroke', [this.lineWidth]);
  }
  fillRect(...args: number[]): void {
    this.log('fillRect', args);
  }
  createRadialGradient(...args: number[]): RecordedGradient {
    return this.gradient('radial', args);
  }
  createLinearGradient(...args: number[]): RecordedGradient {
    return this.gradient('linear', args);
  }

  private gradient(kind: RecordedGradient['kind'], geometry: readonly number[]): RecordedGradient {
    this.log(`${kind}Gradient`, geometry);
    const gradient: RecordedGradient = {
      kind,
      geometry,
      stops: [],
      addColorStop: (offset, colour) => gradient.stops.push({ offset, colour }),
    };
    this.gradients.push(gradient);
    return gradient;
  }

  /** How many shapes were painted: fills plus strokes. */
  get paintCount(): number {
    return this.ops.filter((operation) => PAINT_OPERATIONS.has(operation)).length;
  }

  /** How many times an operation was logged. */
  count(operation: string): number {
    return this.ops.filter((candidate) => candidate === operation).length;
  }

  /** The arguments of every call of `operation`, in order. */
  argumentsOf(operation: string): (readonly number[])[] {
    return this.calls.filter((call) => call.name === operation).map((call) => call.args);
  }
}

export interface FakeBakeCanvas extends BakeCanvas {
  readonly context: FakeBakeContext;
}

export interface FakeBakeCanvasFactory extends BakeCanvasFactory {
  readonly canvases: FakeBakeCanvas[];
}

export function createFakeBakeCanvasFactory(): FakeBakeCanvasFactory {
  const canvases: FakeBakeCanvas[] = [];
  return {
    canvases,
    create(width, height) {
      const canvas: FakeBakeCanvas = { width, height, context: new FakeBakeContext(), element: null };
      canvases.push(canvas);
      return canvas;
    },
  };
}

/** The recording context behind a bake a test received through the `BakeCanvas` type. */
export function fakeContextOf(canvas: BakeCanvas): FakeBakeContext {
  return (canvas as FakeBakeCanvas).context;
}
