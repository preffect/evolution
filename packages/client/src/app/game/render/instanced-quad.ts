// The unit quad every instanced mesh draws (docs/rendering/cells.md §2.3, docs/rendering/own-cell-indicators.md §10): four corners at ±1, two
// triangles, and a per-instance index attribute the vertex stage reads its row by, so one draw call
// covers every instance. The cell mesh and the arc mesh share it; the instance count starts at 0.

import { Geometry } from 'pixi.js';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from './constants';

export function createInstancedQuadGeometry(capacity: number): Geometry {
  const indices = Float32Array.from({ length: capacity }, (_unused, index) => index);
  return new Geometry({
    attributes: {
      aPosition: { buffer: new Float32Array(CELL_QUAD_POSITIONS), format: 'float32x2' },
      aInstanceIndex: { buffer: indices, format: 'float32', instance: true },
    },
    indexBuffer: new Uint16Array(CELL_QUAD_INDICES),
    instanceCount: 0,
  });
}
