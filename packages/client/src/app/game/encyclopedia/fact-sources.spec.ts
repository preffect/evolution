// @vitest-environment node
// docs/architecture/encyclopedia.md §12.6: every fact source reads the live balance. The formula and catalog rows run
// over a recording proxy of an unfrozen clone (a proxy over the frozen default would break its invariants) with every
// argument their types allow; each call reads a leaf, and at least one leaf a row reads moves its value when patched
// (× 2, or + 1 at 0; an array's `length` counts as a leaf, so a count over structure is pinned too).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';
import { readBalancePath } from './facts/balance-path';
import {
  CATALOG_QUANTITY,
  evaluateCatalogQuantity,
  type CatalogQuantityCall,
  type CatalogQuantityId,
} from './facts/catalog-quantities';
import { DERIVED_LINK, derivedLinkTargets, type DerivedLinkCall, type DerivedLinkId } from './facts/derived-links';
import {
  BALANCE_MASS,
  FACT_FORMULA,
  LEVEL_SELECTOR,
  ROUND_MOMENT,
  evaluateFormula,
  type FactFormulaCall,
  type FactFormulaId,
} from './facts/formula-table';
import { ABILITY } from './model/abilities';
import { FACT_SOURCE, type FactDefinition } from './model/fact';
import { ENCYCLOPEDIA_ENTRIES } from './registry';
import type { BacteriumVariant, SpawnedKind, ZoneId } from '@evolution/shared';

/** Leaves the simulation does not read (#367 removes the list). */
const UNREAD_LEAVES = ['ENGULF_COVER_SECONDS', 'ENGULF_WRAP_SECONDS', 'ENGULF_ABSORB_SECONDS'];
/** Domains no content reads yet: their facts land with #362 (controls). */
const DOMAINS_AWAITING_CONTENT: readonly (keyof BalanceConfig)[] = ['controls'];

type Path = readonly string[];

/** A proxy over `target` that records the path of every number it hands out, `length` included. */
function recording<Value extends object>(target: Value, reads: Path[], path: Path = []): Value {
  return new Proxy(target, {
    get(object, key, receiver) {
      const value: unknown = Reflect.get(object, key, receiver);
      if (typeof key !== 'string') return value;
      if (typeof value === 'number') reads.push([...path, key]);
      if (typeof value === 'object' && value !== null) return recording(value, reads, [...path, key]);
      return value;
    },
  });
}

function readsOf<Result>(evaluate: (balance: BalanceConfig) => Result): { result: Result; reads: Path[] } {
  const reads: Path[] = [];
  const result = evaluate(recording(structuredClone(DEFAULT_BALANCE) as BalanceConfig, reads));
  return { result, reads };
}

/** A clone with the number at `path` doubled, or set to one when it is zero. */
function patched(path: Path): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
  const parent = path
    .slice(0, -1)
    .reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, balance as never);
  const leaf = path[path.length - 1] ?? '';
  const value = parent[leaf] as number;
  parent[leaf] = value === 0 ? 1 : value * 2;
  return balance;
}

const traitIds = DEFAULT_BALANCE.traits.TRAIT_CATALOG.map((row) => row.id);

/** One call of a table row: its id and its argument. */
function callOf<Id extends string, Argument>(
  id: Id,
  argument: Argument,
): { readonly id: Id; readonly argument: Argument } {
  return { id, argument };
}

const FORMULA_CALLS: { readonly [Id in FactFormulaId]: readonly FactFormulaCall[] } = {
  [FACT_FORMULA.radiusAtMass]: Object.values(BALANCE_MASS).map((mass) => callOf(FACT_FORMULA.radiusAtMass, { mass })),
  [FACT_FORMULA.maxSpeedAtMass]: Object.values(BALANCE_MASS).map((mass) =>
    callOf(FACT_FORMULA.maxSpeedAtMass, { mass }),
  ),
  [FACT_FORMULA.levelUpCostAt]: Object.values(LEVEL_SELECTOR).map((level) =>
    callOf(FACT_FORMULA.levelUpCostAt, { level }),
  ),
  [FACT_FORMULA.gelSpeedFactorAt]: Object.values(BALANCE_MASS).map((mass) =>
    callOf(FACT_FORMULA.gelSpeedFactorAt, { mass }),
  ),
  [FACT_FORMULA.worldLevelAt]: Object.values(ROUND_MOMENT).map((moment) =>
    callOf(FACT_FORMULA.worldLevelAt, { moment }),
  ),
  [FACT_FORMULA.worldMassAt]: Object.values(ROUND_MOMENT).map((moment) => callOf(FACT_FORMULA.worldMassAt, { moment })),
};

const CATALOG_CALLS: { readonly [Id in CatalogQuantityId]: readonly CatalogQuantityCall[] } = {
  [CATALOG_QUANTITY.tierCount]: traitIds.map((traitId) => callOf(CATALOG_QUANTITY.tierCount, { traitId })),
  [CATALOG_QUANTITY.unlockCount]: traitIds.map((traitId) => callOf(CATALOG_QUANTITY.unlockCount, { traitId })),
  [CATALOG_QUANTITY.requiresCount]: traitIds.map((traitId) => callOf(CATALOG_QUANTITY.requiresCount, { traitId })),
  [CATALOG_QUANTITY.stageCount]: [{ id: CATALOG_QUANTITY.stageCount, argument: {} }],
};

const LINK_CALLS: { readonly [Id in DerivedLinkId]: readonly DerivedLinkCall[] } = {
  [DERIVED_LINK.traitStage]: traitIds.map((traitId) => callOf(DERIVED_LINK.traitStage, { traitId })),
  [DERIVED_LINK.traitRequires]: traitIds.map((traitId) => callOf(DERIVED_LINK.traitRequires, { traitId })),
  [DERIVED_LINK.traitUnlockVariant]: traitIds.map((traitId) => callOf(DERIVED_LINK.traitUnlockVariant, { traitId })),
  [DERIVED_LINK.stageGateTraits]: DEFAULT_BALANCE.ladder.STAGE_ORDER.map((stage) =>
    callOf(DERIVED_LINK.stageGateTraits, { stage }),
  ),
  [DERIVED_LINK.stageNext]: traitIds.map((traitId) => callOf(DERIVED_LINK.stageNext, { traitId })),
  [DERIVED_LINK.stageTraits]: DEFAULT_BALANCE.ladder.STAGE_ORDER.map((stage) =>
    callOf(DERIVED_LINK.stageTraits, { stage }),
  ),
  [DERIVED_LINK.foodZones]: (Object.keys(DEFAULT_BALANCE.ecology.FOOD_ZONE_WEIGHTS_BY_KIND) as SpawnedKind[]).map(
    (foodKind) => ({ id: DERIVED_LINK.foodZones, argument: { foodKind } }),
  ),
  [DERIVED_LINK.abilityTraits]: Object.values(ABILITY).map((abilityId) =>
    callOf(DERIVED_LINK.abilityTraits, { abilityId }),
  ),
  [DERIVED_LINK.tagTraits]: DEFAULT_BALANCE.progression.DNA_TAGS.map((tag) => callOf(DERIVED_LINK.tagTraits, { tag })),
  [DERIVED_LINK.variantUnlocks]: (DEFAULT_BALANCE.ecology.BACTERIUM_VARIANTS as readonly BacteriumVariant[]).map(
    (variant) => ({ id: DERIVED_LINK.variantUnlocks, argument: { variant } }),
  ),
  [DERIVED_LINK.zoneFragmentTags]: (
    Object.keys(DEFAULT_BALANCE.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE) as ZoneId[]
  ).map((zone) => callOf(DERIVED_LINK.zoneFragmentTags, { zone })),
  [DERIVED_LINK.fragmentTagZones]: DEFAULT_BALANCE.progression.DNA_TAGS.map((tag) =>
    callOf(DERIVED_LINK.fragmentTagZones, { tag }),
  ),
};

/** Every call reads a leaf, and for the row as a whole at least one leaf read moves some call's value. */
function expectRowReadsTheBalance<Call>(
  calls: readonly Call[],
  evaluate: (balance: BalanceConfig, call: Call) => unknown,
): void {
  expect(calls.length).toBeGreaterThan(0);
  const isMovedByAPatch = calls.some((call) => {
    const { result, reads } = readsOf((balance) => evaluate(balance, call));
    expect(reads.length, JSON.stringify(call)).toBeGreaterThan(0);
    return reads.some((path) => JSON.stringify(evaluate(patched(path), call)) !== JSON.stringify(result));
  });
  expect(isMovedByAPatch).toBe(true);
}

/** The catalog row of `traitId` in a mutable clone. */
function catalogRow(balance: BalanceConfig, traitId: string): Record<string, unknown> {
  const rows = balance.traits.TRAIT_CATALOG as unknown as Record<string, unknown>[];
  const row = rows.find((candidate) => candidate['id'] === traitId);
  if (row === undefined) throw new Error(`no catalog row ${traitId}`);
  return row;
}

function stageGates(balance: BalanceConfig): Record<string, string[]> {
  return balance.ladder.STAGE_GATE_TRAITS as unknown as Record<string, string[]>;
}

/** One zone's row of the fragment tag table in a mutable clone. */
function fragmentTagRow(balance: BalanceConfig, zone: string): Record<string, number> {
  const table = balance.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE as unknown as Record<string, Record<string, number>>;
  return table[zone] as Record<string, number>;
}

/** One call per link row and one change to the structure it reads that must move its targets. */
const LINK_MOVES: {
  readonly [Id in DerivedLinkId]: { readonly call: DerivedLinkCall; readonly patch: (balance: BalanceConfig) => void };
} = {
  [DERIVED_LINK.traitStage]: {
    call: { id: DERIVED_LINK.traitStage, argument: { traitId: 'nucleoid' } },
    patch: (balance) => (catalogRow(balance, 'nucleoid')['stage'] = 'eukaryote'),
  },
  [DERIVED_LINK.traitRequires]: {
    call: { id: DERIVED_LINK.traitRequires, argument: { traitId: 'nuclear_envelope' } },
    patch: (balance) => (catalogRow(balance, 'nuclear_envelope')['requires'] = ['cilia']),
  },
  [DERIVED_LINK.traitUnlockVariant]: {
    call: { id: DERIVED_LINK.traitUnlockVariant, argument: { traitId: 'mitochondrion' } },
    patch: (balance) => (catalogRow(balance, 'mitochondrion')['unlockedBy'] = { bacteriumVariant: 'plain', count: 1 }),
  },
  [DERIVED_LINK.stageGateTraits]: {
    call: { id: DERIVED_LINK.stageGateTraits, argument: { stage: 'prokaryote' } },
    patch: (balance) => (stageGates(balance)['prokaryote'] = ['cilia']),
  },
  [DERIVED_LINK.stageNext]: {
    call: { id: DERIVED_LINK.stageNext, argument: { traitId: 'nucleoid' } },
    patch: (balance) => (stageGates(balance)['prokaryote'] = []),
  },
  [DERIVED_LINK.stageTraits]: {
    call: { id: DERIVED_LINK.stageTraits, argument: { stage: 'protocell' } },
    patch: (balance) => (catalogRow(balance, 'nucleoid')['stage'] = 'eukaryote'),
  },
  [DERIVED_LINK.foodZones]: {
    call: { id: DERIVED_LINK.foodZones, argument: { foodKind: 'algae' } },
    patch: (balance) => {
      const weights = balance.ecology.FOOD_ZONE_WEIGHTS_BY_KIND as unknown as Record<string, Record<string, number>>;
      (weights['algae'] as Record<string, number>)['warm_vent'] = 0;
    },
  },
  [DERIVED_LINK.abilityTraits]: {
    call: { id: DERIVED_LINK.abilityTraits, argument: { abilityId: ABILITY.photosynthesis } },
    patch: (balance) => {
      const tiers = balance.traits.TRAIT_TIERS as unknown as Record<string, Record<string, number>[]>;
      tiers['chloroplast'] = [{ decayMultiplier: 0.9 }, { decayMultiplier: 0.8 }, { decayMultiplier: 0.7 }];
    },
  },
  [DERIVED_LINK.tagTraits]: {
    call: { id: DERIVED_LINK.tagTraits, argument: { tag: 'sensory' } },
    patch: (balance) => (catalogRow(balance, 'euglena_eyespot')['tags'] = ['photic']),
  },
  [DERIVED_LINK.variantUnlocks]: {
    call: { id: DERIVED_LINK.variantUnlocks, argument: { variant: 'plain' } },
    patch: (balance) => (catalogRow(balance, 'mitochondrion')['unlockedBy'] = { bacteriumVariant: 'plain', count: 1 }),
  },
  [DERIVED_LINK.zoneFragmentTags]: {
    call: { id: DERIVED_LINK.zoneFragmentTags, argument: { zone: 'warm_vent' } },
    patch: (balance) => (fragmentTagRow(balance, 'warm_vent')['toxic'] = 0),
  },
  [DERIVED_LINK.fragmentTagZones]: {
    call: { id: DERIVED_LINK.fragmentTagZones, argument: { tag: 'photic' } },
    patch: (balance) => (fragmentTagRow(balance, 'open_broth')['photic'] = 1),
  },
};

function registryFacts(): readonly FactDefinition[] {
  return ENCYCLOPEDIA_ENTRIES.flatMap((entry) => [
    ...entry.facts,
    ...entry.sections.flatMap((section) => section.facts),
  ]);
}

describe('the fact sources', () => {
  it('resolve every balance path to a finite number, and never to a leaf the simulation does not read', () => {
    for (const fact of registryFacts()) {
      if (fact.source.kind !== FACT_SOURCE.balance) continue;
      expect(Number.isFinite(readBalancePath(DEFAULT_BALANCE, fact.source.path))).toBe(true);
      for (const leaf of UNREAD_LEAVES) expect(fact.source.path).not.toContain(leaf);
    }
  });

  it.each(Object.values(FACT_FORMULA))('reads and follows the balance in the %s formula', (id) => {
    expectRowReadsTheBalance(FORMULA_CALLS[id], evaluateFormula);
  });

  it.each(Object.values(CATALOG_QUANTITY))('reads and follows the balance in the %s catalog quantity', (id) => {
    expectRowReadsTheBalance(CATALOG_CALLS[id], evaluateCatalogQuantity);
  });

  it.each(Object.values(DERIVED_LINK))('reads the balance’s structure in the %s link, for every argument', (id) => {
    for (const call of LINK_CALLS[id]) {
      const { reads } = readsOf((balance) => derivedLinkTargets(balance, call));
      expect(reads.length, JSON.stringify(call)).toBeGreaterThan(0);
    }
  });

  it.each(Object.values(DERIVED_LINK))('moves the %s targets when the structure the row reads changes', (id) => {
    const { call, patch } = LINK_MOVES[id];
    const before = derivedLinkTargets(DEFAULT_BALANCE, call);
    const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
    patch(balance);
    expect(derivedLinkTargets(balance, call)).not.toEqual(before);
  });

  it('reads every balance domain from some fact, but the domains whose content has not landed', () => {
    const domains = new Set<string>();
    for (const fact of registryFacts()) {
      const { reads } = readsOf((balance) => {
        switch (fact.source.kind) {
          case FACT_SOURCE.balance:
            return readBalancePath(balance, fact.source.path);
          case FACT_SOURCE.formula:
            return evaluateFormula(balance, fact.source.formula);
          case FACT_SOURCE.catalog:
            return evaluateCatalogQuantity(balance, fact.source.quantity);
          case FACT_SOURCE.link:
            return derivedLinkTargets(balance, fact.source.link);
        }
      });
      for (const [domain] of reads) if (domain !== undefined) domains.add(domain);
    }
    for (const domain of Object.keys(DEFAULT_BALANCE)) {
      expect(domains.has(domain), domain).toBe(!DOMAINS_AWAITING_CONTENT.includes(domain as keyof BalanceConfig));
    }
  });
});
