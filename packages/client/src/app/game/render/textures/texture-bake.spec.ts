import { describe, expect, it } from 'vitest';
import { FakeBakeContext, createFakeBakeCanvasFactory } from '../../../../testing/fake-bake-canvas';
import { WHITE } from '../constants';
import {
  createDomBakeCanvasFactory,
  fillDisc,
  fillEllipse,
  fillRadial,
  paintGlint,
  paintGlow,
  strokeEllipse,
} from './texture-bake';

describe('texture bake primitives', () => {
  it('fills a radial gradient with every stop as an rgba colour', () => {
    const context = new FakeBakeContext();
    fillRadial(context, { x: 10, y: 10, radius: 8 }, [
      { offset: 0, colour: '#ff5470', alpha: 0.5 },
      { offset: 1, colour: '#ff5470', alpha: 0 },
    ]);
    expect(context.gradients[0]!.stops).toEqual([
      { offset: 0, colour: 'rgba(255, 84, 112, 0.5)' },
      { offset: 1, colour: 'rgba(255, 84, 112, 0)' },
    ]);
    expect(context.ops).toEqual(['radialGradient', 'beginPath', 'arc', 'fill']);
  });

  it('paints a glow as a wide halo under a soft halo, then a glint ellipse', () => {
    const context = new FakeBakeContext();
    paintGlow(context, { x: 0, y: 0, radius: 10 }, '#8dff6a', { soft: 1.6, softAlpha: 0.3, wide: 3, wideAlpha: 0.22 });
    expect(context.paintCount).toBe(2);
    paintGlint(context, { x: 0, y: 0, radius: 10 }, { colour: WHITE, alpha: 0.5 });
    expect(context.ops.filter((operation) => operation === 'ellipse')).toHaveLength(1);
    expect(context.fillStyle).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('fills and strokes discs and ellipses', () => {
    const context = new FakeBakeContext();
    fillDisc(context, { x: 1, y: 1, radius: 2 }, { colour: '#000000', alpha: 1 });
    fillEllipse(context, { x: 0, y: 0, radiusX: 2, radiusY: 1, rotation: 0 }, { colour: '#000000', alpha: 1 });
    strokeEllipse(
      context,
      { x: 0, y: 0, radiusX: 2, radiusY: 1, rotation: 0 },
      { colour: '#ffffff', alpha: 1, width: 2 },
    );
    expect(context.paintCount).toBe(3);
    expect(context.lineWidth).toBe(2);
  });

  it('creates canvases through the DOM factory and refuses a canvas without 2D', () => {
    const elements: { width: number; height: number }[] = [];
    const documentWith2d = {
      createElement: () => {
        const element = { width: 0, height: 0, getContext: () => new FakeBakeContext() };
        elements.push(element);
        return element as unknown as HTMLCanvasElement;
      },
    } as unknown as Document;
    const canvas = createDomBakeCanvasFactory(documentWith2d).create(3.2, 2);
    expect([canvas.width, canvas.height]).toEqual([4, 2]);
    expect(canvas.element).toBe(elements[0]);
    const broken = {
      createElement: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    } as unknown as Document;
    expect(() => createDomBakeCanvasFactory(broken).create(1, 1)).toThrow(/Canvas 2D/);
    const fake = createFakeBakeCanvasFactory();
    fake.create(5, 5);
    expect(fake.canvases).toHaveLength(1);
  });
});
