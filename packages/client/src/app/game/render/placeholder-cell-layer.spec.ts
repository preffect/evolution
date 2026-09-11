import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { TEST_OTHER_CELL_ID, createTestCellView, createTestRenderFrame } from '../../../testing/builders';
import type { CameraExtent } from './camera';
import { PlaceholderCellLayer, type CellLayerFrame } from './placeholder-cell-layer';

const EXTENT: CameraExtent = { minX: -100, minY: -100, maxX: 100, maxY: 100 };

function input(overrides: Partial<CellLayerFrame> = {}): CellLayerFrame {
  return {
    frame: createTestRenderFrame(),
    extent: EXTENT,
    zoom: 1,
    nowMs: 0,
    ownCell: null,
    previewTraitId: null,
    ...overrides,
  };
}

describe('PlaceholderCellLayer', () => {
  it('draws one disc per cell at its position and radius, and counts the visible ones', () => {
    const layer = new PlaceholderCellLayer();
    const cells = [
      createTestCellView({ x: 10, y: -20, radius: 6 }),
      createTestCellView({ id: TEST_OTHER_CELL_ID, x: 500, y: 0 }),
    ];
    const outputs = layer.update(input({ frame: createTestRenderFrame({ cells }) }));
    expect(outputs.visibleCells).toBe(1);
    expect(layer.container.children).toHaveLength(2);
    const [near, far] = layer.container.children;
    expect(near?.position.x).toBe(10);
    expect(near?.position.y).toBe(-20);
    expect(near?.scale.x).toBe(6);
    expect(near?.visible).toBe(true);
    expect(far?.visible).toBe(false);
  });

  it('keeps a disc across frames and removes it when its id leaves the frame', () => {
    const layer = new PlaceholderCellLayer();
    layer.update(input());
    const [first] = layer.container.children;
    layer.update(input({ frame: createTestRenderFrame({ cells: [createTestCellView({ x: 3 })] }) }));
    expect(layer.container.children[0]).toBe(first);
    layer.update(input({ frame: createTestRenderFrame({ cells: [createTestCellView({ id: entityId('c-9') })] }) }));
    expect(layer.container.children).toHaveLength(1);
    expect(layer.container.children[0]).not.toBe(first);
    expect(first?.destroyed).toBe(true);
  });

  it('shows the self ring on the own cell only', () => {
    const layer = new PlaceholderCellLayer();
    const own = createTestCellView();
    const other = createTestCellView({ id: TEST_OTHER_CELL_ID, x: 20 });
    layer.update(input({ frame: createTestRenderFrame({ cells: [own, other] }), ownCell: own }));
    const [ownDisc, otherDisc] = layer.container.children;
    expect(ownDisc?.children[0]?.visible).toBe(true);
    expect(otherDisc?.children[0]?.visible).toBe(false);
    layer.update(input({ frame: createTestRenderFrame({ cells: [own, other] }), ownCell: null }));
    expect(ownDisc?.children[0]?.visible).toBe(false);
  });

  it('destroys every disc with the layer', () => {
    const layer = new PlaceholderCellLayer();
    layer.update(input());
    const [disc] = layer.container.children;
    layer.destroy();
    expect(disc?.destroyed).toBe(true);
    expect(layer.container.destroyed).toBe(true);
  });
});
