import { describe, expect, it } from 'vitest';
import { applyBalancePatch } from './balance-patch.js';
import { DebugRequestError } from './debug-request-error.js';

function liveBalance() {
  return {
    ecology: { foodCapBase: 800, foodKinds: ['mote', 'fragment'], zones: { gelPatchCount: 3 } },
    world: { dishRadius: 1000 },
  };
}

describe('applyBalancePatch', () => {
  it('writes every number leaf of a nested patch and returns their dotted paths', () => {
    const balance = liveBalance();
    const written = applyBalancePatch(balance, { ecology: { foodCapBase: 900, zones: { gelPatchCount: 5 } } });
    expect(written).toEqual(['ecology.foodCapBase', 'ecology.zones.gelPatchCount']);
    expect(balance.ecology.foodCapBase).toBe(900);
    expect(balance.ecology.zones.gelPatchCount).toBe(5);
    expect(balance.world.dishRadius).toBe(1000);
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

  it('writes nothing when any leaf of the patch is refused', () => {
    const balance = liveBalance();
    expect(() => applyBalancePatch(balance, { world: { dishRadius: 5 }, ecology: { bogus: 1 } })).toThrow();
    expect(balance.world.dishRadius).toBe(1000);
  });
});
