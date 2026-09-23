// CellLayer's cull (cell-cull.ts, #529): a cell is dropped only when nothing it draws can reach the screen.

import { describe, expect, it } from 'vitest';
import { entityId, type CellView } from '@evolution/shared';
import { createTestCellView, createTestRenderFrame } from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import {
  CELL_QUAD_EXTENT_RADII,
  ENGULF_WARNING_RING_MIN_PX,
  FLAGELLUM_OUTER_PX,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { HALF } from '../geometry';
import { cullReachRadii } from './cell-cull';
import { CellLayer } from './cell-layer';
import { TEST_LAYER_EXTENT as EXTENT, testLayerFrame as input } from './cell-layer-test-frame';
import { summariseCellTraits } from './cell-traits';

const textures = createTestRenderTextures({ seed: 3 });

describe('CellLayer cull', () => {
  it('culls at the quad reach, not the radius, so a halo at the edge still draws', () => {
    const subject = new CellLayer(textures);
    const nearEdge = createTestCellView({ x: EXTENT.maxX + 10, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [nearEdge] }) })).visibleCells).toBe(1);
    const past = createTestCellView({ x: EXTENT.maxX + 100, y: 0, radius: 6 });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [past] }) })).visibleCells).toBe(0);
    subject.destroy();
  });

  it('draws a tiny predator whose warning ring still reaches on screen, past the old 6 r cull (#529)', () => {
    const subject = new CellLayer(textures);
    const own = createTestCellView({ id: entityId('own'), mass: 1, radius: 1, x: 0, y: 0 });
    const radius = 3;
    const ringReachPx = ENGULF_WARNING_RING_MIN_PX + WARNING_RING_STROKE_PX;
    expect(ringReachPx).toBeGreaterThan(6 * radius);
    const predator = (id: string, x: number) => createTestCellView({ id: entityId(id), mass: 50, radius, x });
    const ringIn = input({
      ownCell: own,
      frame: createTestRenderFrame({ cells: [own, predator('ring-in', EXTENT.maxX + ringReachPx - 1)] }),
    });
    const ringOut = input({
      ownCell: own,
      frame: createTestRenderFrame({ cells: [own, predator('ring-out', EXTENT.maxX + ringReachPx + 1)] }),
    });
    expect(subject.update(ringIn).visibleCells).toBe(2);
    expect(subject.update(ringOut).visibleCells).toBe(1);
    subject.destroy();
  });

  it('draws a tier-III flagellate whose tail tip can reach on screen, and not one whose whole drawing is off (#529)', () => {
    const subject = new CellLayer(textures);
    const traits: CellView['traits'] = [{ traitId: 'simple_flagellum', tier: 3 }];
    const radius = 10;
    const centrelinePx = cullReachRadii(summariseCellTraits(createTestCellView({ radius, traits }), null)) * radius;
    // The tail reaches past the quad's 3 r, so a cull by the quad alone would cut it.
    expect(centrelinePx).toBeGreaterThan(CELL_QUAD_EXTENT_RADII * radius);
    // Its outer stroke reaches half its width past the centreline: a tip whose centreline is just off still draws.
    const strokeEdgePx = centrelinePx + FLAGELLUM_OUTER_PX * HALF;
    const reaching = createTestCellView({ id: entityId('tail-in'), x: EXTENT.maxX + strokeEdgePx - 1, radius, traits });
    const beyond = createTestCellView({ id: entityId('all-out'), x: EXTENT.maxX + strokeEdgePx + 1, radius, traits });
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [reaching] }) })).visibleCells).toBe(1);
    expect(subject.update(input({ frame: createTestRenderFrame({ cells: [beyond] }) })).visibleCells).toBe(0);
    subject.destroy();
  });
});
