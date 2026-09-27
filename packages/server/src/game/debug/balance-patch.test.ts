import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, DISH_RADIUS } from '@evolution/shared';
import { applyBalancePatch } from './balance-patch.js';
import { DebugRequestError } from './debug-request-error.js';
import type { BalancePatch } from './simulation-debug-handle.js';

/** A real balance path, named through a constant because the patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';
const CATALOG_LEAF = 'TRAIT_CATALOG';
const TIER_TABLES_LEAF = 'TRAIT_TIERS';
const CILIA = 'cilia';
const TIER_I_ROW = 0;
const PATCHED_SPEED = 2;
/** Cilia tier I's speed: the tier number a live tune reaches for first (#715). */
const CILIA_SPEED_PATCH = {
  traits: { [TIER_TABLES_LEAF]: { [CILIA]: { [TIER_I_ROW]: { speedMultiplier: PATCHED_SPEED } } } },
};
/** A tier number reached through the catalog: the path CODE-STANDARDS.md §2 calls structure (#150). */
const CATALOG_TIER_PATCH = { traits: { [CATALOG_LEAF]: { 0: { tiers: { 0: { dnaGainMultiplier: 2 } } } } } };

function liveBalance() {
  return {
    ecology: {
      foodCapBase: 800,
      foodKinds: ['mote', 'fragment'],
      zones: { gelPatchCount: 3, ringRadii: [10, 20] },
      zoneRadii: [10, 20],
    },
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

  it('refuses a structure path by name and names the path its numbers are read from', () => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, CATALOG_TIER_PATCH)).toThrow(
      new DebugRequestError(
        '"traits.TRAIT_CATALOG" is structure, not a tunable: trait tier numbers live in "traits.TRAIT_TIERS", patched as "traits.TRAIT_TIERS.<trait id>.<row>.<field>" (row 0 is tier I)',
      ),
    );
    expect(() => applyBalancePatch(DEFAULT_BALANCE, { traits: { [CATALOG_LEAF]: 1 } })).toThrow(
      /traits\.TRAIT_TIERS\.<trait id>/,
    );
  });

  it('refuses a non-finite value', () => {
    expect(() => applyBalancePatch(liveBalance(), { world: { dishRadius: Number.NaN } })).toThrow(/finite/);
  });

  it('refuses the whole patch when any leaf is refused', () => {
    expect(() => applyBalancePatch(liveBalance(), { world: { dishRadius: 5 }, ecology: { bogus: 1 } })).toThrow();
  });
});

describe('applyBalancePatch on the trait tier tables (#715)', () => {
  const ciliaRowOf = (balance: typeof DEFAULT_BALANCE) =>
    balance.traits.TRAIT_CATALOG.find((row) => row.id === CILIA)!.tiers[TIER_I_ROW]!;

  it('patches a number in a tier row, moves the catalog copy with it and leaves the input untouched', () => {
    const result = applyBalancePatch(DEFAULT_BALANCE, CILIA_SPEED_PATCH);
    expect(result.writtenPaths).toEqual(['traits.TRAIT_TIERS.cilia.0.speedMultiplier']);
    expect(result.didChangeTraitTiers).toBe(true);
    expect(result.balance.traits.TRAIT_TIERS.cilia[TIER_I_ROW]!.speedMultiplier).toBe(PATCHED_SPEED);
    expect(ciliaRowOf(result.balance).speedMultiplier).toBe(PATCHED_SPEED);
    expect(DEFAULT_BALANCE.traits.TRAIT_TIERS.cilia[TIER_I_ROW]!.speedMultiplier).not.toBe(PATCHED_SPEED);
  });

  it('moves the catalog copy on a balance whose aliasing a JSON round trip dropped', () => {
    const roundTripped = JSON.parse(JSON.stringify(DEFAULT_BALANCE)) as typeof DEFAULT_BALANCE;
    expect(ciliaRowOf(roundTripped)).not.toBe(roundTripped.traits.TRAIT_TIERS.cilia[TIER_I_ROW]);
    const result = applyBalancePatch(roundTripped, CILIA_SPEED_PATCH);
    expect(ciliaRowOf(result.balance).speedMultiplier).toBe(PATCHED_SPEED);
  });

  it('says no tier changed for a patch outside the tier tables', () => {
    expect(
      applyBalancePatch(DEFAULT_BALANCE, { world: { [DISH_RADIUS_LEAF]: DISH_RADIUS + 1 } }).didChangeTraitTiers,
    ).toBe(false);
  });

  it('refuses a row that is not a whole index of the table, and a field the row does not have', () => {
    const patchCilia = (rows: BalancePatch): BalancePatch => ({ traits: { [TIER_TABLES_LEAF]: { [CILIA]: rows } } });
    const refused: BalancePatch[] = [
      { length: 1 },
      { '01': { speedMultiplier: 1 } },
      { 3: { speedMultiplier: 1 } },
      { [TIER_I_ROW]: 1 },
      { [TIER_I_ROW]: { absorbDurationMultiplierAsPredator: 1 } },
    ];
    for (const rows of refused) {
      expect(() => applyBalancePatch(DEFAULT_BALANCE, patchCilia(rows))).toThrow(/not a number leaf/);
    }
  });

  it('keeps every other array structure: an index into it is refused', () => {
    expect(() => applyBalancePatch(liveBalance(), { ecology: { zoneRadii: { 0: 5 } } })).toThrow(/not a number leaf/);
    // A table at the tier tables' depth but outside `traits.TRAIT_TIERS`: only the path check refuses it.
    expect(() => applyBalancePatch(liveBalance(), { ecology: { zones: { ringRadii: { 0: 5 } } } })).toThrow(
      /not a number leaf/,
    );
  });
});
