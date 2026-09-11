import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { GhostRegistry } from './ghost-cells';

describe('GhostRegistry', () => {
  it('keeps a ghost for the absorbed clip and drops it at 600 ms', () => {
    const registry = new GhostRegistry();
    registry.add(createTestCellView({ id: entityId('prey') }), entityId('predator'), 1000);
    const early = registry.active(1000);
    expect(early).toHaveLength(1);
    expect(early[0]!.view.engulfedByCellId).toBe('predator');
    expect(early[0]!.tracks['cytoplasmAlpha']).toBe(1);
    expect(registry.active(1200)[0]!.tracks['cytoplasmAlpha']).toBeCloseTo(0.5, 9);
    expect(registry.active(1000 + MOTION_CLIPS.absorbed.duration)).toEqual([]);
    expect(registry.size).toBe(0);
  });

  it('drives the predator seal from the ghost: 0.60 at the seal, relaxing to 0 at done', () => {
    const registry = new GhostRegistry();
    registry.add(createTestCellView({ id: entityId('a') }), entityId('p'), 0);
    registry.add(createTestCellView({ id: entityId('b') }), entityId('p'), 300);
    expect(registry.sealByPredator(registry.active(0)).get(entityId('p'))).toBeCloseTo(0.6, 9);
    expect(registry.sealByPredator(registry.active(400)).get(entityId('p'))).toBeCloseTo(0.42, 6);
    registry.clear();
    expect(registry.active(400)).toEqual([]);
  });
});
