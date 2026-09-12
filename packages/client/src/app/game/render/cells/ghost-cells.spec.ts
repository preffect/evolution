// docs/RENDERING.md §9: the ghost appears on `cell_absorbed` and leaves at 600 ms; its clip drives the predator seal.

import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { GhostRegistry } from './ghost-cells';

const predator = { id: entityId('predator'), x: 0, y: 0 };

describe('GhostRegistry', () => {
  it('keeps a ghost for the absorbed clip and drops it at 600 ms', () => {
    const registry = new GhostRegistry();
    registry.add(createTestCellView({ id: entityId('prey'), x: 0, y: 10 }), predator, 1000);
    const early = registry.active(1000);
    expect(early).toHaveLength(1);
    expect(early[0]!.view.engulfedByCellId).toBe('predator');
    expect(early[0]!.angleFromPredator).toBeCloseTo(Math.PI / 2, 9);
    expect(early[0]!.tracks['cytoplasmAlpha']).toBe(1);
    expect(registry.active(1200)[0]!.tracks['cytoplasmAlpha']).toBeCloseTo(0.5, 9);
    expect(registry.active(1000 + MOTION_CLIPS.absorbed.duration)).toEqual([]);
    expect(registry.size).toBe(0);
  });

  it('drives the predator seal from the ghost: 0.60 at the seal, relaxing to 0 at done, the largest winning', () => {
    const registry = new GhostRegistry();
    registry.add(createTestCellView({ id: entityId('a'), x: 10 }), predator, 0);
    registry.add(createTestCellView({ id: entityId('b'), y: -10 }), predator, 300);
    expect(GhostRegistry.sealByPredator(registry.active(0)).get(predator.id)?.seal).toBeCloseTo(0.6, 9);
    const later = GhostRegistry.sealByPredator(registry.active(400)).get(predator.id)!;
    expect(registry.active(400).map((ghost) => ghost.tracks['seal'])).toEqual([0.22, 0.51]);
    expect(later.seal).toBeCloseTo(0.51, 6);
    expect(later.angle).toBeCloseTo(-Math.PI / 2, 9);
    registry.clear();
    expect(registry.active(400)).toEqual([]);
  });
});
