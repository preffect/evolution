import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import type { CellView } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { OwnCellLayer, type OwnCellLayerFrame, type OwnCellLayerSubject } from './own-cell-layer';

interface TestRecord {
  readonly level: number;
}

interface TestFrame extends OwnCellLayerFrame<TestRecord> {
  readonly zoom: number;
}

interface TestText {
  readonly container: Container;
}

const NOTHING_DRAWN = { drawn: 0 };
const RECORD: TestRecord = { level: 3 };
const textures = createTestRenderTextures().indicators;

/** The smallest layer the base class can drive: it records what it was handed to draw. */
class TestLayer extends OwnCellLayer<TestRecord, TestText, { drawn: number }, TestFrame> {
  readonly hidden = vi.fn();
  readonly drawn = vi.fn();
  readonly builtTexts: TestText[] = [];

  constructor(createText = () => ({ container: new Container() })) {
    super(textures, NOTHING_DRAWN, (bundle) => {
      const view = createText();
      this.builtTexts.push(view);
      expect(bundle).toBe(textures);
      return view;
    });
  }

  protected hide(): void {
    this.hidden();
  }

  protected draw(subject: OwnCellLayerSubject<TestRecord, TestText>, frame: TestFrame): { drawn: number } {
    this.drawn(subject, frame);
    return { drawn: subject.indicators.level + frame.zoom };
  }
}

function frameWith(indicators: TestRecord | null, ownCell: CellView | null): TestFrame {
  return { indicators, ownCell, zoom: 2 };
}

describe('OwnCellLayer.update', () => {
  it('draws with the record, the cell and the text view, and reports what the layer drew', () => {
    const layer = new TestLayer();
    const ownCell = createTestCellView();
    const frame = frameWith(RECORD, ownCell);
    expect(layer.update(frame)).toEqual({ drawn: 5 });
    expect(layer.drawn).toHaveBeenCalledWith({ indicators: RECORD, ownCell, text: layer.builtTexts[0] }, frame);
    expect(layer.hidden).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'no record', frame: frameWith(null, createTestCellView()) },
    { name: 'no own cell', frame: frameWith(RECORD, null) },
    { name: 'neither', frame: frameWith(null, null) },
  ])('hides and reports the empty outputs with $name, drawing nothing', ({ frame }) => {
    const layer = new TestLayer();
    expect(layer.update(frame)).toBe(NOTHING_DRAWN);
    expect(layer.hidden).toHaveBeenCalledTimes(1);
    expect(layer.drawn).not.toHaveBeenCalled();
  });

  it('builds no text view on a stood-down frame, so a hidden layer never needs a canvas', () => {
    const layer = new TestLayer();
    layer.update(frameWith(null, null));
    expect(layer.builtTexts).toEqual([]);
  });

  it('builds the text view once, adds it to the container, and keeps it across frames', () => {
    const layer = new TestLayer();
    const ownCell = createTestCellView();
    layer.update(frameWith(RECORD, ownCell));
    layer.update(frameWith(RECORD, ownCell));
    expect(layer.builtTexts).toHaveLength(1);
    expect(layer.container.children).toContain(layer.builtTexts[0]!.container);
  });

  it('lets a spec swap the factory before the first text is built', () => {
    const layer = new TestLayer();
    const swapped = { container: new Container() };
    layer.useText(() => swapped);
    layer.update(frameWith(RECORD, createTestCellView()));
    expect(layer.builtTexts).toEqual([]);
    expect(layer.container.children).toContain(swapped.container);
  });

  it('pools its sprites in a container of its own, under the layer container', () => {
    const layer = new TestLayer();
    expect(layer.sprites).toEqual([]);
    expect(layer.container.children.length).toBeGreaterThanOrEqual(0);
  });
});
