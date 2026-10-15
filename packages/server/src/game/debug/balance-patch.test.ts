import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, DISH_RADIUS, GAME_ERA, GAME_ERA_ORDER, type GameEra } from '@evolution/shared';
import { applyBalancePatch } from './balance-patch.js';
import { STAGE_SWITCH_LEAF } from '../replay/recorded-swallow-switch.js';
import { DebugRequestError } from './debug-request-error.js';
import type { BalancePatch } from './simulation-debug-handle.js';

/** A real balance path, named through a constant because the patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';
const CATALOG_LEAF = 'TRAIT_CATALOG';
/** The declared stage-id leaf (balance-leaf-kinds.ts), and an undeclared string leaf and id list beside it. */
const LATCH_LEAF = 'LATCH_FROM_STAGE';
const STARTING_STAGE_LEAF = 'STARTING_STAGE';
const DNA_TAGS_LEAF = 'DNA_TAGS';
/** The declared trait-id list leaf, the swallow switch (early-life.md §15.10). */
const SWALLOW_GATE_LEAF = 'SWALLOW_GATE_TRAITS';
/** The declared era-list leaf (phases.md §14.2.4). */
const ERAS_IN_PLAY_LEAF = 'ERAS_IN_PLAY';
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

describe('applyBalancePatch on the stage-id leaf (docs/game-design/early-life.md §15.10)', () => {
  const latchFrom = (value: unknown): BalancePatch => ({ earlyLife: { [LATCH_LEAF]: value as string } });

  it('moves the latch stage to a stage id and leaves the input untouched', () => {
    const result = applyBalancePatch(DEFAULT_BALANCE, latchFrom(CELL_STAGE.endosymbiosis));
    expect(result.writtenPaths).toEqual(['earlyLife.LATCH_FROM_STAGE']);
    expect(result.balance.earlyLife.LATCH_FROM_STAGE).toBe(CELL_STAGE.endosymbiosis);
    expect(DEFAULT_BALANCE.earlyLife.LATCH_FROM_STAGE).toBe(CELL_STAGE.prokaryote);
    expect(result.didChangeTraitTiers).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a form name that is no stage', 'amoeba'],
    ['a number', 3],
    ['a list of stages', [CELL_STAGE.eukaryote]],
    ['an empty string', ''],
  ])('refuses %s at a stage-id leaf, naming what it takes', (_label, value) => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, latchFrom(value))).toThrow(
      /"earlyLife\.LATCH_FROM_STAGE" takes a stage id \(protocell, prokaryote, endosymbiosis, eukaryote, specialised\)/,
    );
  });

  it('refuses a nested record at a stage-id leaf', () => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, latchFrom({ nested: 1 }))).toThrow(DebugRequestError);
  });

  it.each<[BalancePatch, string]>([
    [{ world: { [DISH_RADIUS_LEAF]: CELL_STAGE.eukaryote } }, 'world.DISH_RADIUS'],
    [{ world: { [DISH_RADIUS_LEAF]: [CELL_STAGE.eukaryote] } }, 'world.DISH_RADIUS'],
    [{ ladder: { [STARTING_STAGE_LEAF]: CELL_STAGE.eukaryote } }, 'ladder.STARTING_STAGE'],
    [{ progression: { [DNA_TAGS_LEAF]: ['motile'] } }, 'progression.DNA_TAGS'],
  ])('refuses a string or a list at a number leaf or an undeclared path, naming that path: %j', (patch, path) => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, patch)).toThrow(
      new DebugRequestError(`"${path}" is not a number leaf of the balance`),
    );
  });

  it('refuses a declared leaf the balance being patched does not have', () => {
    expect(() => applyBalancePatch({ earlyLife: {} }, latchFrom(CELL_STAGE.eukaryote))).toThrow(
      new DebugRequestError('"earlyLife.LATCH_FROM_STAGE" is not a leaf of the balance'),
    );
  });

  it('refuses the whole patch when a stage-id leaf beside a good number is refused', () => {
    const patch = { world: { [DISH_RADIUS_LEAF]: DISH_RADIUS + 1 }, earlyLife: { [LATCH_LEAF]: 'amoeba' } };
    expect(() => applyBalancePatch(DEFAULT_BALANCE, patch)).toThrow(DebugRequestError);
  });
});

describe('applyBalancePatch on the trait-id list leaf (docs/game-design/early-life.md §15.10, EL23)', () => {
  const swallowGate = (value: unknown): BalancePatch => ({ absorption: { [SWALLOW_GATE_LEAF]: value as string[] } });

  it('sets the swallow gate to a list of catalog ids and leaves the input untouched', () => {
    const result = applyBalancePatch(DEFAULT_BALANCE, swallowGate(['cytoskeleton']));
    expect(result.writtenPaths).toEqual(['absorption.SWALLOW_GATE_TRAITS']);
    expect(result.balance.absorption.SWALLOW_GATE_TRAITS).toEqual(['cytoskeleton']);
    expect(DEFAULT_BALANCE.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
    expect(result.didChangeTraitTiers).toBe(false);
  });

  it('takes the empty list, the switch off, and writes a copy of the list it was given', () => {
    const switchOn = applyBalancePatch(DEFAULT_BALANCE, swallowGate(['cytoskeleton'])).balance;
    const gate = ['cytoskeleton', 'food_vacuole'];
    const twoTraits = applyBalancePatch(DEFAULT_BALANCE, swallowGate(gate)).balance;
    expect(twoTraits.absorption.SWALLOW_GATE_TRAITS).toEqual(gate);
    expect(twoTraits.absorption.SWALLOW_GATE_TRAITS).not.toBe(gate);
    expect(applyBalancePatch(switchOn, swallowGate([])).balance.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['an id that is not a trait', ['amoeba']],
    ['a catalog id beside one that is not a trait', ['cytoskeleton', 'amoeba']],
    ['an id twice', ['cytoskeleton', 'cytoskeleton']],
    ['an id that is not a list', 'cytoskeleton'],
    ['a stage id', [CELL_STAGE.eukaryote]],
    ['a number', 3],
  ])('refuses %s, naming what the leaf takes (EL23)', (_label, value) => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, swallowGate(value))).toThrow(
      /"absorption\.SWALLOW_GATE_TRAITS" takes a list of distinct trait ids \(nucleoid, .*\), the empty list allowed/,
    );
  });

  it('refuses the old stage switch by name: it is no leaf of the balance any more', () => {
    expect(() =>
      applyBalancePatch(DEFAULT_BALANCE, { absorption: { [STAGE_SWITCH_LEAF]: CELL_STAGE.protocell } }),
    ).toThrow(new DebugRequestError('"absorption.SWALLOW_FROM_STAGE" is not a number leaf of the balance'));
  });
});

describe('applyBalancePatch on the era-list leaf (docs/game-design/phases.md §14.2.4)', () => {
  const erasInPlay = (value: unknown): BalancePatch => ({ eras: { [ERAS_IN_PLAY_LEAF]: value as string[] } });
  const poolOn = [GAME_ERA.dish, GAME_ERA.pool];

  it.each([[poolOn], [GAME_ERA_ORDER], [[GAME_ERA.dish]]])('writes the prefix %j', (prefix) => {
    const result = applyBalancePatch(DEFAULT_BALANCE, erasInPlay(prefix));
    expect(result.writtenPaths).toEqual(['eras.ERAS_IN_PLAY']);
    expect(result.balance.eras.ERAS_IN_PLAY).toEqual(prefix);
    expect(DEFAULT_BALANCE.eras.ERAS_IN_PLAY).toEqual([GAME_ERA.dish]);
  });

  it('writes a copy: the balance never aliases the list the patch came in', () => {
    const patchList: GameEra[] = [...poolOn];
    const result = applyBalancePatch(DEFAULT_BALANCE, erasInPlay(patchList));
    expect(result.balance.eras.ERAS_IN_PLAY).not.toBe(patchList);
    patchList.push(GAME_ERA.colonies);
    expect(result.balance.eras.ERAS_IN_PLAY).toEqual(poolOn);
  });

  it.each<[string, unknown]>([
    ['a list that skips the pool', [GAME_ERA.dish, GAME_ERA.colonies]],
    ['a list without the dish', [GAME_ERA.pool]],
    ['the empty list', []],
    ['an era that is not a list', GAME_ERA.dish],
    ['a list of numbers', [1, 2]],
    ['a number', 1],
  ])('refuses %s, naming the path and what it takes', (_label, value) => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, erasInPlay(value))).toThrow(
      new DebugRequestError(
        `"eras.ERAS_IN_PLAY" takes a prefix of the eras (dish, pool, colonies), the dish first, not ${JSON.stringify(value)}`,
      ),
    );
  });

  it('refuses a record at the era-list leaf', () => {
    expect(() => applyBalancePatch(DEFAULT_BALANCE, { eras: { [ERAS_IN_PLAY_LEAF]: { 0: GAME_ERA.dish } } })).toThrow(
      /"eras\.ERAS_IN_PLAY" takes a prefix of the eras/,
    );
  });
});
