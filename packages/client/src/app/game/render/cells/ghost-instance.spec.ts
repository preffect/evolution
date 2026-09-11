import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { PREY_UNDER_FILM_ALPHA } from '../constants';
import { GhostRegistry } from './ghost-cells';
import { ghostInstance } from './ghost-instance';

describe('ghostInstance', () => {
  it('draws the last view dissolving under the film with a dashed rim and no tells', () => {
    const registry = new GhostRegistry();
    registry.add(createTestCellView({ id: entityId('g'), radius: 30, avatarIndex: 2 }), entityId('p'), 0);
    const midway = registry.active(MOTION_CLIPS.absorbed.duration / 2)[0]!;
    const instance = ghostInstance(midway, 1);
    expect(instance).toMatchObject({
      radius: 30,
      paletteIndex: 2,
      isOwn: false,
      warningRingPx: 0,
      passBAlpha: PREY_UNDER_FILM_ALPHA,
    });
    expect(instance.alpha).toBeCloseTo(0.5, 6);
    expect(instance.rimDash).toBe(1);
    expect(instance.bumps).toEqual([]);
  });
});
