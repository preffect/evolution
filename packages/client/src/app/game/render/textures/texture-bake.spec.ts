import { describe, expect, it } from 'vitest';
import { FakeBakeContext, createFakeBakeCanvasFactory } from '../../../../testing/fake-bake-canvas';
import { WHITE } from '../constants';
import {
  createBodyCanvas,
  createDomBakeCanvasFactory,
  fillDisc,
  fillEllipse,
  fillHalo,
  fillRadial,
  fillSoftDisc,
  paintGlint,
  paintGlow,
  strokeDisc,
  strokeEllipse,
} from './texture-bake';

const RED = '#ff5470';
const DISC = { x: 10, y: 10, radius: 8 };
const ELLIPSE = { x: 0, y: 0, radiusX: 2, radiusY: 1, rotation: 0 };

describe('texture bake primitives', () => {
  it('fills a radial gradient with every stop as an rgba colour', () => {
    const context = new FakeBakeContext();
    fillRadial(context, DISC, [
      { offset: 0, colour: RED, alpha: 0.5 },
      { offset: 1, colour: RED, alpha: 0 },
    ]);
    expect(context.gradients[0]!.stops).toEqual([
      { offset: 0, colour: 'rgba(255, 84, 112, 0.5)' },
      { offset: 1, colour: 'rgba(255, 84, 112, 0)' },
    ]);
    expect(context.ops).toEqual(['radialGradient', 'beginPath', 'arc', 'fill']);
  });

  it('builds a halo as centre → clear and a soft disc as flat → feathered → clear', () => {
    const context = new FakeBakeContext();
    fillHalo(context, DISC, { colour: RED, alpha: 0.4 });
    fillSoftDisc(context, DISC, { colour: RED, alpha: 0.4, feather: 0.3 });
    expect(context.gradients[0]!.stops.map((stop) => stop.offset)).toEqual([0, 1]);
    expect(context.gradients[1]!.stops.map((stop) => stop.offset)).toEqual([0, 0.7, 1]);
    expect(context.gradients[1]!.stops.at(-1)!.colour).toBe('rgba(255, 84, 112, 0)');
  });

  it('paints a glow as a wide halo under a soft halo, then a glint ellipse toward the top-left', () => {
    const context = new FakeBakeContext();
    paintGlow(context, DISC, RED, { soft: 1.6, softAlpha: 0.3, wide: 3, wideAlpha: 0.22 });
    expect(context.paintCount).toBe(2);
    expect(context.gradients[0]!.stops[0]!.colour).toBe('rgba(255, 84, 112, 0.22)');
    expect(context.gradients[1]!.stops[0]!.colour).toBe('rgba(255, 84, 112, 0.3)');
    paintGlint(context, DISC, { colour: WHITE, alpha: 0.5 });
    expect(context.count('ellipse')).toBe(1);
    expect(context.fillStyle).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('fills and strokes discs and ellipses', () => {
    const context = new FakeBakeContext();
    fillDisc(context, DISC, { colour: '#000000', alpha: 1 });
    strokeDisc(context, DISC, { colour: WHITE, alpha: 1, width: 3 });
    fillEllipse(context, ELLIPSE, { colour: '#000000', alpha: 1 });
    strokeEllipse(context, ELLIPSE, { colour: WHITE, alpha: 1, width: 2 });
    expect(context.count('fill')).toBe(2);
    expect(context.count('stroke')).toBe(2);
    expect(context.lineWidth).toBe(2);
  });

  it('sizes a body canvas to the body and its reach, centred', () => {
    const factory = createFakeBakeCanvasFactory();
    const body = createBodyCanvas(factory, 10, 1.6);
    expect(body.canvas.width).toBe(32);
    expect(body.centre).toBe(16);
    expect(factory.canvases).toHaveLength(1);
  });

  it('creates canvases through the DOM factory, rounding up to whole pixels, and refuses a canvas without 2D', () => {
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
  });
});
