// `LadderCounter` fixtures (docs/ui/hud.md §3.1.4) for the specs that lay out the ladder orbit: each
// endosymbiosis counter on its own §9 angle with nothing eaten, overridable field by field.

import { BACTERIUM_VARIANT, ENDOSYMBIOSIS_BACTERIA_REQUIRED } from '@evolution/shared';
import { LADDER_ORBIT_ANGLES_PAIR_DEG } from '../app/game/render/constants';
import type { LadderCounter } from '../app/game/state/own-cell-indicators';

/** The aerobic counter, which unlocks the mitochondrion. */
export function createTestAerobicCounter(overrides: Partial<LadderCounter> = {}): LadderCounter {
  return {
    traitId: 'mitochondrion',
    variant: BACTERIUM_VARIANT.aerobic,
    eaten: 0,
    required: ENDOSYMBIOSIS_BACTERIA_REQUIRED,
    angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic,
    isGhostHidden: false,
    isUnlocked: false,
    ...overrides,
  };
}

/** The photosynthetic counter, which unlocks the chloroplast. */
export function createTestPhotosyntheticCounter(overrides: Partial<LadderCounter> = {}): LadderCounter {
  return createTestAerobicCounter({
    traitId: 'chloroplast',
    variant: BACTERIUM_VARIANT.photosynthetic,
    angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic,
    ...overrides,
  });
}
