// Onboarding queue samples for the specs (docs/testing/tiers-and-builders.md): one alive snapshot at a tick with nothing
// going on unless named, and a fold from a fresh session.

import { entityId, type EntityId } from '@evolution/shared';
import { STEER_HINT_DISTANCE_WU } from '../app/game/hud/hud-constants';
import type { OnboardingObservation } from '../app/game/hud/format/onboarding-beats';
import {
  INITIAL_ONBOARDING_MEMORY,
  onboardingStepFor,
  type OnboardingMemory,
  type OnboardingSample,
} from '../app/game/hud/format/onboarding-queue';

export const TEST_ONBOARDING_OWN_CELL_ID = entityId('own');
export const TEST_ONBOARDING_RESPAWNED_CELL_ID = entityId('own-respawned');

export interface OnboardingSampleOptions extends Partial<OnboardingObservation> {
  readonly x?: number;
  readonly cellId?: EntityId;
  readonly hasOwnEat?: boolean;
  readonly isSprinting?: boolean;
  readonly isAlive?: boolean;
}

/** An alive snapshot at `tick`, the own cell at (`x`, 0), with nothing else going on unless named. */
export function createTestOnboardingSample(tick: number, options: OnboardingSampleOptions = {}): OnboardingSample {
  const {
    x = 0,
    cellId = TEST_ONBOARDING_OWN_CELL_ID,
    hasOwnEat = false,
    isSprinting = false,
    isAlive = true,
    ...facts
  } = options;
  const observation: OnboardingObservation = {
    tick,
    roundElapsedSeconds: 0,
    dnaCumulative: 0,
    hasOffer: false,
    isProkaryote: false,
    hasThreat: false,
    zone: null,
    isShrinkingFromDecay: false,
    isBloom: false,
    isToxinReaching: false,
    ...facts,
  };
  return {
    tick,
    observation: isAlive ? observation : null,
    ownCell: isAlive ? { id: cellId, x, y: 0 } : null,
    hasOwnEat,
    isSprinting,
  };
}

/** Folds the samples in order onto `from` (a fresh session by default). */
export function foldOnboardingSamples(
  samples: readonly OnboardingSample[],
  from: OnboardingMemory = INITIAL_ONBOARDING_MEMORY,
): OnboardingMemory {
  return samples.reduce((memory, next) => onboardingStepFor(memory, next), from);
}

/** A session past the steer and eat beats: the cell has moved away and eaten. */
export function onboardingPastOpening(): OnboardingMemory {
  return foldOnboardingSamples([
    createTestOnboardingSample(1),
    createTestOnboardingSample(2, { x: STEER_HINT_DISTANCE_WU }),
    createTestOnboardingSample(3, { x: STEER_HINT_DISTANCE_WU, hasOwnEat: true }),
  ]);
}
