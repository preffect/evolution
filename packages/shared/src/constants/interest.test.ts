import { describe, expect, it } from 'vitest';
import { foldModifiers } from '../simulation/cell-modifiers.js';
import type { TraitTier } from '../types/game.js';
import { SPRINT_SPEED_MULTIPLIER } from './controls.js';
import { BACTERIUM_DRIFT_SPEED, DNA_FRAGMENT_DRIFT_SPEED, DNA_FRAGMENT_RADIUS } from './ecology.js';
import { CELL_BASE_SPEED } from './growth.js';
import {
  INTEREST_CAMERA_HISTORY_BROADCASTS,
  INTEREST_ENTITY_REACH_RADII,
  INTEREST_MARGIN_WU,
  INTEREST_MAX_CELL_SPEED,
  INTEREST_MAX_FOOD_SPEED,
} from './interest.js';
import { INTERPOLATION_DELAY_TICKS, MAX_EXTRAPOLATION_TICKS, SNAPSHOT_EVERY_TICKS } from './netcode.js';
import { TICK_INTERVAL_S } from './network.js';
import { TRAIT_CATALOG, TRAIT_TIERS, TRAIT_TIER_COUNT } from './traits.js';

describe('INTEREST_MAX_CELL_SPEED', () => {
  it('bounds a sprinting cell that owned every trait at its top tier, folded by the real rules', () => {
    const everyTraitAtTheTop = TRAIT_CATALOG.map((trait) => ({
      traitId: trait.id,
      tier: TRAIT_TIER_COUNT as TraitTier,
    }));
    const modifiers = foldModifiers(everyTraitAtTheTop, TRAIT_TIERS);
    const sprinting =
      CELL_BASE_SPEED * modifiers.speedMultiplier * (SPRINT_SPEED_MULTIPLIER + modifiers.sprintSpeedMultiplierBonus);
    expect(INTEREST_MAX_CELL_SPEED).toBeGreaterThanOrEqual(sprinting);
    expect(INTEREST_MAX_CELL_SPEED).toBeGreaterThanOrEqual(CELL_BASE_SPEED * SPRINT_SPEED_MULTIPLIER);
  });
});

describe('INTEREST_MAX_FOOD_SPEED', () => {
  it('bounds a bacterium’s walk, a fragment’s drift and every attract tier', () => {
    const attractSpeeds = Object.values(TRAIT_TIERS).flatMap((tiers) => tiers.map((tier) => tier.attractSpeed ?? 0));
    for (const speed of [BACTERIUM_DRIFT_SPEED, DNA_FRAGMENT_DRIFT_SPEED, ...attractSpeeds]) {
      expect(INTEREST_MAX_FOOD_SPEED).toBeGreaterThanOrEqual(speed);
    }
  });
});

describe('INTEREST_CAMERA_HISTORY_BROADCASTS', () => {
  it('reaches back past the client’s render delay by one broadcast interval', () => {
    const spannedTicks = (INTEREST_CAMERA_HISTORY_BROADCASTS - 1) * SNAPSHOT_EVERY_TICKS;
    expect(spannedTicks).toBeGreaterThanOrEqual(INTERPOLATION_DELAY_TICKS + SNAPSHOT_EVERY_TICKS);
  });
});

describe('INTEREST_MARGIN_WU', () => {
  it('covers the camera’s lead at full sprint, a mote’s lag and a fragment’s drawn reach', () => {
    const cameraLead = (MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS) * TICK_INTERVAL_S * INTEREST_MAX_CELL_SPEED;
    const foodLag =
      (INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS) *
      TICK_INTERVAL_S *
      INTEREST_MAX_FOOD_SPEED;
    const reach = INTEREST_ENTITY_REACH_RADII * DNA_FRAGMENT_RADIUS;
    expect(INTEREST_MARGIN_WU).toBeGreaterThanOrEqual(cameraLead + foodLag + reach);
    expect(Number.isInteger(INTEREST_MARGIN_WU)).toBe(true);
  });
});
