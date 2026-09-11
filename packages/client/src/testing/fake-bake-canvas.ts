// A recording Canvas 2D for the texture bakes (docs/TESTING.md §4): every call is logged so a test
// can count a bake's layers and check its gradients without a DOM canvas.

import type {
  BakeCanvas,
  BakeCanvasFactory,
  BakeContext2D,
  BakeGradient,
} from '../app/game/render/textures/texture-bake';

export interface RecordedGradient extends BakeGradient {
  readonly kind: 'radial' | 'linear';
  readonly stops: { offset: number; colour: string }[];
}

const PAINT_OPERATIONS = new Set(['fill', 'stroke', 'fillRect']);

export class FakeBakeContext implements BakeContext2D {
  readonly ops: string[] = [];
  readonly gradients: RecordedGradient[] = [];
  fillStyle: string | BakeGradient | CanvasPattern = '';
  strokeStyle: string | BakeGradient | CanvasPattern = '';
  lineWidth = 1;
  lineCap: 'butt' | 'round' | 'square' = 'butt';
  globalAlpha = 1;

  private log(name: string): void {
    this.ops.push(name);
  }

  save(): void {
    this.log('save');
  }
  restore(): void {
    this.log('restore');
  }
  translate(): void {
    this.log('translate');
  }
  scale(): void {
    this.log('scale');
  }
  rotate(): void {
    this.log('rotate');
  }
  beginPath(): void {
    this.log('beginPath');
  }
  closePath(): void {
    this.log('closePath');
  }
  moveTo(): void {
    this.log('moveTo');
  }
  lineTo(): void {
    this.log('lineTo');
  }
  quadraticCurveTo(): void {
    this.log('quadraticCurveTo');
  }
  bezierCurveTo(): void {
    this.log('bezierCurveTo');
  }
  arc(): void {
    this.log('arc');
  }
  ellipse(): void {
    this.log('ellipse');
  }
  rect(): void {
    this.log('rect');
  }
  fill(): void {
    this.log('fill');
  }
  stroke(): void {
    this.log('stroke');
  }
  fillRect(): void {
    this.log('fillRect');
  }
  createRadialGradient(): RecordedGradient {
    return this.gradient('radial');
  }
  createLinearGradient(): RecordedGradient {
    return this.gradient('linear');
  }

  private gradient(kind: RecordedGradient['kind']): RecordedGradient {
    this.log(`${kind}Gradient`);
    const gradient: RecordedGradient = {
      kind,
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
