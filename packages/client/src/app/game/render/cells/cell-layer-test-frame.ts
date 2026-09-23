// The frame a CellLayer spec feeds the layer: a fixed camera extent and every field at rest unless a spec overrides
// it. Shared by cell-layer.spec.ts and cell-layer-cull.spec.ts.

import { createTestRenderFrame } from '../../../../testing/builders';
import type { CameraExtent } from '../camera';
import { NO_DEFORMATIONS } from './cell-deformation';
import type { CellLayerFrame } from './cell-layer-frame';
import { REST_OWN_CELL_RING } from './self-ring';

/** Half the side of the square the test camera sees, in world units. */
const TEST_LAYER_HALF_SIDE_WU = 100;

export const TEST_LAYER_EXTENT: CameraExtent = {
  minX: -TEST_LAYER_HALF_SIDE_WU,
  minY: -TEST_LAYER_HALF_SIDE_WU,
  maxX: TEST_LAYER_HALF_SIDE_WU,
  maxY: TEST_LAYER_HALF_SIDE_WU,
};

export function testLayerFrame(overrides: Partial<CellLayerFrame> = {}): CellLayerFrame {
  return {
    frame: createTestRenderFrame(),
    extent: TEST_LAYER_EXTENT,
    zoom: 1,
    nowMs: 0,
    ownCell: null,
    previewTraitId: null,
    deformations: NO_DEFORMATIONS,
    ownCellRing: REST_OWN_CELL_RING,
    ...overrides,
  };
}
