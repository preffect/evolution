// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, secondsToTicks, worldReference } from '@evolution/shared';
import { hexToRgb } from '../colour';
import { STARVING_ORGANELLE_SALLOW_SHARE, STARVING_SALLOW, STARVING_WITHER_ONSET, WHITE } from '../constants';
import { NOT_WITHERED, starvedOutMassAt, witherOf, witheredTint } from './starving-wither';

const STARVED_OUT_MASS = 10;

describe('witherOf', () => {
  it('leaves a cell that is not starving unwithered, however small', () => {
    expect(witherOf({ isStarving: false, mass: 5 }, STARVED_OUT_MASS)).toBe(NOT_WITHERED);
  });

  it('starts a giant at the onset and climbs as it shrinks, fully withered at the burst and past it', () => {
    const giant = witherOf({ isStarving: true, mass: 1e9 }, STARVED_OUT_MASS);
    expect(giant).toBeCloseTo(STARVING_WITHER_ONSET, 6);
    const masses = [80, 40, 20, 12];
    const withers = masses.map((mass) => witherOf({ isStarving: true, mass }, STARVED_OUT_MASS));
    for (let index = 1; index < withers.length; index += 1) expect(withers[index]).toBeGreaterThan(withers[index - 1]!);
    expect(withers[0]).toBeGreaterThan(giant);
    expect(witherOf({ isStarving: true, mass: STARVED_OUT_MASS }, STARVED_OUT_MASS)).toBe(1);
    expect(witherOf({ isStarving: true, mass: STARVED_OUT_MASS / 2 }, STARVED_OUT_MASS)).toBe(1);
    expect(witherOf({ isStarving: true, mass: 0 }, STARVED_OUT_MASS)).toBe(1);
  });

  it('is halfway from the onset to 1 when the cell is twice its burst mass', () => {
    const wither = witherOf({ isStarving: true, mass: 2 * STARVED_OUT_MASS }, STARVED_OUT_MASS);
    expect(wither).toBeCloseTo(STARVING_WITHER_ONSET + (1 - STARVING_WITHER_ONSET) / 2, 12);
  });
});

describe('starvedOutMassAt', () => {
  const sizeFactorMin = DEFAULT_BALANCE.wildCells.WILD_CELL_SIZE_FACTOR_MIN;

  it('is the smallest newborn of the world clock at the render tick, counted from the round start', () => {
    const roundStartTick = 600;
    const renderTick = roundStartTick + secondsToTicks(90);
    const expected = sizeFactorMin * worldReference(90, DEFAULT_BALANCE).worldMass;
    expect(starvedOutMassAt(renderTick, roundStartTick, DEFAULT_BALANCE)).toBeCloseTo(expected, 9);
    expect(starvedOutMassAt(renderTick, roundStartTick, DEFAULT_BALANCE)).toBeGreaterThan(
      starvedOutMassAt(roundStartTick, roundStartTick, DEFAULT_BALANCE),
    );
  });

  it('reads the round start as 0 s for a render tick still before it (a rematch’s first frames)', () => {
    const atStart = sizeFactorMin * worldReference(0, DEFAULT_BALANCE).worldMass;
    expect(starvedOutMassAt(100, 160, DEFAULT_BALANCE)).toBe(atStart);
  });
});

describe('witheredTint', () => {
  it('keeps the tint of an unwithered cell', () => {
    expect(witheredTint(WHITE, NOT_WITHERED)).toBe(WHITE);
    expect(witheredTint('#4fb1c4', NOT_WITHERED)).toBe('#4fb1c4');
  });

  it('multiplies a fully withered tint toward the sallow by its share, channel by channel', () => {
    const sallow = hexToRgb(STARVING_SALLOW);
    const withered = hexToRgb(witheredTint(WHITE, 1));
    withered.forEach((channel, index) => {
      expect(channel).toBeCloseTo(1 + (sallow[index]! - 1) * STARVING_ORGANELLE_SALLOW_SHARE, 2);
    });
    const half = hexToRgb(witheredTint(WHITE, 0.5));
    half.forEach((channel, index) => expect(channel).toBeGreaterThan(withered[index]! - 1e-9));
  });
});
