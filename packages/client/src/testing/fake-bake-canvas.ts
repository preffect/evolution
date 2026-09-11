// A recording Canvas 2D for the texture bakes (docs/TESTING.md §4): every call is logged so a test
// can count a bake's layers and check its gradients without a DOM canvas.

import type {
  BakeCanvas,
  BakeCanvasFactory,
  BakeContext2D,
  BakeGradient,
} from '../app/game/render/textures/texture-bake';

export interface RecordedGradient extends BakeGradient {
  readonly stops: { offset: number; colour: string }[];
}

export class FakeBakeContext implements BakeContext2D {
  readonly ops: string[] = [];
  readonly gradients: RecordedGradient[] = [];
  fillStyle: string | BakeGradient = '';
  strokeStyle: string | BakeGradient = '';
  lineWidth = 1;
  lineCap: 'butt' | 'round' | 'square' = 'butt';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';

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
  rotate(): void {
    this.log('rotate');
  }
  scale(): void {
    this.log('scale');
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
  clearRect(): void {
    this.log('clearRect');
  }
  fillRect(): void {
    this.log('fillRect');
  }
  createRadialGradient(): RecordedGradient {
    return this.gradient('radialGradient');
  }
  createLinearGradient(): RecordedGradient {
    return this.gradient('linearGradient');
  }

  private gradient(kind: string): RecordedGradient {
    this.log(kind);
    const gradient: RecordedGradient = {
      stops: [],
      addColorStop: (offset, colour) => gradient.stops.push({ offset, colour }),
    };
    this.gradients.push(gradient);
    return gradient;
  }

  /** How many shapes were painted: fills plus strokes. */
  get paintCount(): number {
    return this.ops.filter((operation) => operation === 'fill' || operation === 'stroke' || operation === 'fillRect')
      .length;
  }
}

export interface FakeBakeCanvas extends BakeCanvas {
  readonly context: FakeBakeContext;
}

export function createFakeBakeCanvasFactory(): BakeCanvasFactory & { readonly canvases: FakeBakeCanvas[] } {
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
