import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, DISH_RADIUS } from '@evolution/shared';
import { applyBalancePatch } from './balance-patch.js';
import { DebugRequestError } from './debug-request-error.js';

/** A real balance path, named through a constant because the patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';

function liveBalance() {
  return {
    ecology: { foodCapBase: 800, foodKinds: ['mote', 'fragment'], zones: { gelPatchCount: 3 } },
    world: { dishRadius: 1000 },
  };
}

describe('applyBalancePatch', () => {
  it('returns a copy with every number leaf of a nested patch applied and their dotted paths', () => {
    const result = applyBalancePatch(liveBalance(), { ecology: { foodCapBase: 900, zones: { gelPatchCount: 5 } } });
    expect(result.writtenPaths).toEqual(['ecology.foodCapBase', 'ecology.zones.gelPatchCount']);
    expect(result.balance.ecology.foodCapBase).toBe(900);
    expect(result.balance.ecology.zones.gelPatchCount).toBe(5);
    expect(result.balance.world.dishRadius).toBe(1000);
  });

  it('never writes the input: the caller keeps the copy it is handed back', () => {
    const input = liveBalance();
    const result = applyBalancePatch(input, { world: { dishRadius: 5 } });
    expect(input.world.dishRadius).toBe(1000);
    expect(result.balance).not.toBe(input);
    expect(result.balance.ecology.foodKinds).not.toBe(input.ecology.foodKinds);
  });

  it('patches the deep-frozen DEFAULT_BALANCE directly and returns a writable copy', () => {
    const result = applyBalancePatch(DEFAULT_BALANCE, { world: { [DISH_RADIUS_LEAF]: DISH_RADIUS + 1 } });
    expect(result.balance.world.DISH_RADIUS).toBe(DISH_RADIUS + 1);
    expect(DEFAULT_BALANCE.world.DISH_RADIUS).toBe(DISH_RADIUS);
    expect(Object.isFrozen(result.balance)).toBe(false);
  });

  it('refuses a path that does not exist', () => {
    expect(() => applyBalancePatch(liveBalance(), { ecology: { notATunable: 1 } })).toThrow(DebugRequestError);
  });

  it('refuses a path that is structure rather than a number leaf', () => {
    const balance = liveBalance();
    expect(() => applyBalancePatch(balance, { ecology: { foodKinds: 1 } })).toThrow(/not a number leaf/);
    expect(() => applyBalancePatch(balance, { ecology: { zones: 1 } })).toThrow(/not a number leaf/);
    expect(() => applyBalancePatch(balance, { ecology: { foodCapBase: { nested: 1 } } })).toThrow(DebugRequestError);
  });

  it('refuses a non-finite value', () => {
    expect(() => applyBalancePatch(liveBalance(), { world: { dishRadius: Number.NaN } })).toThrow(/finite/);
  });

  it('refuses the whole patch when any leaf is refused', () => {
    expect(() => applyBalancePatch(liveBalance(), { world: { dishRadius: 5 }, ecology: { bogus: 1 } })).toThrow();
  });
});
