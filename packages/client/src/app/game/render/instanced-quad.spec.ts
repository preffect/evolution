import { describe, expect, it } from 'vitest';
import { CELL_QUAD_INDICES, CELL_QUAD_POSITIONS } from './constants';
import { createInstancedQuadGeometry } from './instanced-quad';

describe('createInstancedQuadGeometry', () => {
  it('builds the unit quad with one instance index per row, drawing nothing until a count is set', () => {
    const geometry = createInstancedQuadGeometry(3);
    expect(Array.from(geometry.attributes['aPosition']!.buffer.data)).toEqual([...CELL_QUAD_POSITIONS]);
    expect(Array.from(geometry.indexBuffer.data)).toEqual([...CELL_QUAD_INDICES]);
    const instanceIndex = geometry.attributes['aInstanceIndex']!;
    expect(instanceIndex.instance).toBe(true);
    expect(Array.from(instanceIndex.buffer.data)).toEqual([0, 1, 2]);
    expect(geometry.instanceCount).toBe(0);
    geometry.destroy();
  });
});
