import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { INTEREST_ENTITY_REACH_RADII } from '../constants/interest.js';
import { INTERPOLATION_DELAY_TICKS, MAX_EXTRAPOLATION_TICKS, SNAPSHOT_EVERY_TICKS } from '../constants/netcode.js';
import { TICK_INTERVAL_S } from '../constants/network.js';
import { TRAIT_CATALOG, TRAIT_TIER_COUNT } from '../constants/traits.js';
import { foldModifiers } from '../simulation/cell-modifiers.js';
import type { TraitTier } from '../types/game.js';
import { interestMarginFor, interestMaxCellSpeedFor, interestMaxFoodSpeedFor } from './interest-margin.js';

/** The margin at `DEFAULT_BALANCE`, as wire-contract.md §4.2 lever 1 states it. */
const DEFAULT_MARGIN_WU = 161;
const SPEED_RAISE = 3;

describe('interestMaxCellSpeedFor', () => {
  it('bounds a sprinting cell that owned every trait at its top tier, folded by the real rules', () => {
    const everyTraitAtTheTop = TRAIT_CATALOG.map((trait) => ({
      traitId: trait.id,
      tier: TRAIT_TIER_COUNT as TraitTier,
    }));
    const modifiers = foldModifiers(everyTraitAtTheTop, DEFAULT_BALANCE.traits.TRAIT_TIERS);
    const sprinting =
      DEFAULT_BALANCE.growth.CELL_BASE_SPEED *
      modifiers.speedMultiplier *
      (DEFAULT_BALANCE.controls.SPRINT_SPEED_MULTIPLIER + modifiers.sprintSpeedMultiplierBonus);
    expect(interestMaxCellSpeedFor(DEFAULT_BALANCE)).toBeGreaterThanOrEqual(sprinting);
  });
});

describe('interestMaxFoodSpeedFor', () => {
  it('bounds a bacterium’s walk, a fragment’s drift and every attract tier', () => {
    const { traits, ecology } = DEFAULT_BALANCE;
    const attractSpeeds = Object.values(traits.TRAIT_TIERS).flatMap((tiers) =>
      tiers.map((tier) => tier.attractSpeed ?? 0),
    );
    for (const speed of [ecology.BACTERIUM_DRIFT_SPEED, ecology.DNA_FRAGMENT_DRIFT_SPEED, ...attractSpeeds]) {
      expect(interestMaxFoodSpeedFor(DEFAULT_BALANCE)).toBeGreaterThanOrEqual(speed);
    }
  });
});

describe('interestMarginFor', () => {
  it('covers the camera’s lead at full sprint, a mote’s lag and a fragment’s drawn reach', () => {
    const cameraLead =
      (MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS) * TICK_INTERVAL_S * interestMaxCellSpeedFor(DEFAULT_BALANCE);
    const foodLag =
      (INTERPOLATION_DELAY_TICKS + MAX_EXTRAPOLATION_TICKS + SNAPSHOT_EVERY_TICKS) *
      TICK_INTERVAL_S *
      interestMaxFoodSpeedFor(DEFAULT_BALANCE);
    const reach = INTEREST_ENTITY_REACH_RADII * DEFAULT_BALANCE.ecology.DNA_FRAGMENT_RADIUS;
    expect(interestMarginFor(DEFAULT_BALANCE)).toBeGreaterThanOrEqual(cameraLead + foodLag + reach);
    expect(interestMarginFor(DEFAULT_BALANCE)).toBe(DEFAULT_MARGIN_WU);
  });

  it('follows the live balance: a room whose speeds a debug patch raised gets a wider margin', () => {
    const patched = structuredClone(DEFAULT_BALANCE);
    patched.growth.CELL_BASE_SPEED *= SPEED_RAISE;
    patched.ecology.BACTERIUM_DRIFT_SPEED *= SPEED_RAISE * SPEED_RAISE;
    expect(interestMaxCellSpeedFor(patched)).toBeCloseTo(interestMaxCellSpeedFor(DEFAULT_BALANCE) * SPEED_RAISE, 6);
    expect(interestMarginFor(patched)).toBeGreaterThan(interestMarginFor(DEFAULT_BALANCE));
  });
});
