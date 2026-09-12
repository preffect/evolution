import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { PREY_UNDER_FILM_ALPHA } from '../constants';
import { GhostRegistry } from './ghost-cells';
import { ghostInstance } from './ghost-instance';

describe('ghostInstance', () => {
  it('draws the last view dissolving under the film with a dashed rim, at rest and without tells', () => {
    const registry = new GhostRegistry();
    const prey = createTestCellView({
      id: entityId('g'),
      radius: 30,
      avatarIndex: 2,
      traits: [{ traitId: 'cilia', tier: 1 }],
    });
    registry.add(prey, { id: entityId('p'), x: 40, y: 0 }, 0);
    const midway = registry.active(MOTION_CLIPS.absorbed.duration / 2)[0]!;
    const instance = ghostInstance(midway, 1);
    expect(instance).toMatchObject({
      radius: 30,
      paletteIndex: 2,
      isOwn: false,
      warningRingPx: 0,
      passBAlpha: PREY_UNDER_FILM_ALPHA,
      speedRatio: 0,
      pulse: 1,
      ciliaCount: 24,
    });
    expect(instance.alpha).toBeCloseTo(0.5, 6);
    expect(instance.rimDash).toBe(1);
    expect(instance.bumps.every((slot) => slot.amplitude === 0)).toBe(true);
  });
});
