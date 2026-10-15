// docs/game-design/phases.md §14.5.2: the light patch circles the pool once per `POOL_LIGHT_PATCH_PERIOD_SECONDS`, its
// centre a pure function of the tick and the layout's orbit.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { secondsToTicks } from '../time/units.js';
import type { LightPatchOrbitView } from '../types/pool.js';
import { isOnPoolBank, lightPatchCentreAt, poolBankInnerRadius, poolThreadEnds } from './pool-layout.js';

/** An orbit drawn at a rematch on tick 1 200, starting due east. */
const ORBIT: LightPatchOrbitView = { orbitRadius: 1_500, startAngleRadians: 0, startTick: 1_200 };
const PERIOD_TICKS = secondsToTicks(DEFAULT_BALANCE.pool.POOL_LIGHT_PATCH_PERIOD_SECONDS);
const CLOSE_DIGITS = 9;
const THREAD_LENGTH = DEFAULT_BALANCE.pool.POOL_THREAD_LENGTH;

function expectCentre(tick: number, x: number, y: number, orbit = ORBIT): void {
  const centre = lightPatchCentreAt(orbit, tick, DEFAULT_BALANCE);
  expect(centre.x).toBeCloseTo(x, CLOSE_DIGITS);
  expect(centre.y).toBeCloseTo(y, CLOSE_DIGITS);
}

describe('lightPatchCentreAt', () => {
  it('lies at the orbit’s start angle on its start tick, and back there one period later', () => {
    expectCentre(ORBIT.startTick, ORBIT.orbitRadius, 0);
    expectCentre(ORBIT.startTick + PERIOD_TICKS, ORBIT.orbitRadius, 0);
  });

  it('turns counter-clockwise: a quarter period later it lies due north (+y), half a period due west', () => {
    expectCentre(ORBIT.startTick + PERIOD_TICKS / 4, 0, ORBIT.orbitRadius);
    expectCentre(ORBIT.startTick + PERIOD_TICKS / 2, -ORBIT.orbitRadius, 0);
  });

  it('counts from the orbit’s start tick, not from tick 0, and from its start angle', () => {
    expectCentre(ORBIT.startTick + PERIOD_TICKS / 4, -ORBIT.orbitRadius, 0, {
      ...ORBIT,
      startAngleRadians: Math.PI / 2,
    });
  });

  it('reads the live period: a patched one moves the patch faster', () => {
    const halfPeriod = structuredClone(DEFAULT_BALANCE);
    halfPeriod.pool.POOL_LIGHT_PATCH_PERIOD_SECONDS /= 2;
    const centre = lightPatchCentreAt(ORBIT, ORBIT.startTick + PERIOD_TICKS / 4, halfPeriod);
    expect(centre.x).toBeCloseTo(-ORBIT.orbitRadius, CLOSE_DIGITS);
    expect(centre.y).toBeCloseTo(0, CLOSE_DIGITS);
  });

  it('takes a fractional render tick', () => {
    const between = lightPatchCentreAt(ORBIT, ORBIT.startTick + 0.5, DEFAULT_BALANCE);
    expect(between.y).toBeGreaterThan(0);
    expect(between.y).toBeLessThan(lightPatchCentreAt(ORBIT, ORBIT.startTick + 1, DEFAULT_BALANCE).y);
  });
});

describe('poolThreadEnds', () => {
  it('lays the thread’s live length along its angle, its centre midway', () => {
    const [start, end] = poolThreadEnds({ x: 100, y: -200, angleRadians: Math.PI / 2 }, DEFAULT_BALANCE);
    expect(start.x).toBeCloseTo(100, CLOSE_DIGITS);
    expect(end.x).toBeCloseTo(100, CLOSE_DIGITS);
    expect(start.y).toBeCloseTo(-200 - THREAD_LENGTH / 2, CLOSE_DIGITS);
    expect(end.y).toBeCloseTo(-200 + THREAD_LENGTH / 2, CLOSE_DIGITS);
  });

  it('reads the length from the balance, never from the view: a patched length moves the ends', () => {
    const longer = structuredClone(DEFAULT_BALANCE);
    longer.pool.POOL_THREAD_LENGTH *= 2;
    const [start, end] = poolThreadEnds({ x: 0, y: 0, angleRadians: 0 }, longer);
    expect(end.x - start.x).toBeCloseTo(2 * THREAD_LENGTH, CLOSE_DIGITS);
    expect(start.y).toBeCloseTo(0, CLOSE_DIGITS);
  });
});

describe('the bank', () => {
  const bankInner = DEFAULT_BALANCE.world.DISH_RADIUS - DEFAULT_BALANCE.pool.POOL_BANK_WIDTH;

  it('is the band POOL_BANK_WIDTH wide inside the wall, its inner edge included', () => {
    expect(poolBankInnerRadius(DEFAULT_BALANCE)).toBe(bankInner);
    expect(isOnPoolBank({ x: 0, y: bankInner }, DEFAULT_BALANCE)).toBe(true);
    expect(isOnPoolBank({ x: 0, y: bankInner - 0.01 }, DEFAULT_BALANCE)).toBe(false);
  });

  it('reads the live width', () => {
    const wider = structuredClone(DEFAULT_BALANCE);
    wider.pool.POOL_BANK_WIDTH *= 2;
    expect(isOnPoolBank({ x: -(bankInner - 1), y: 0 }, wider)).toBe(true);
  });
});
