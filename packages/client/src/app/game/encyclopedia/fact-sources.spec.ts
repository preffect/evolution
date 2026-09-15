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
  evaluateFormula,
  type FactFormulaCall,
  type FactFormulaId,
} from './facts/formula-table';
import { ABILITY } from './model/abilities';
import { FACT_SOURCE, type FactDefinition } from './model/fact';
import { ENCYCLOPEDIA_ENTRIES } from './registry';
import type { SpawnedKind } from '@evolution/shared';

/** Leaves the simulation does not read (#367 removes the list). */
const UNREAD_LEAVES = ['ENGULF_COVER_SECONDS', 'ENGULF_WRAP_SECONDS', 'ENGULF_ABSORB_SECONDS'];
/** Domains no content reads yet: their facts land with #361 (world, session, clock, ecology, wild cells) and #362. */
const DOMAINS_AWAITING_CONTENT: readonly (keyof BalanceConfig)[] = [
  'world',
  'session',
  'worldClock',
  'controls',
  'ecology',
  'growth',
  'wildCells',
  'absorption',
];

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

const FORMULA_CALLS: { readonly [Id in FactFormulaId]: readonly FactFormulaCall[] } = {
  [FACT_FORMULA.radiusAtMass]: Object.values(BALANCE_MASS).map((mass) => ({
    id: FACT_FORMULA.radiusAtMass,
    argument: { mass },
  })),
  [FACT_FORMULA.maxSpeedAtMass]: Object.values(BALANCE_MASS).map((mass) => ({
    id: FACT_FORMULA.maxSpeedAtMass,
    argument: { mass },
  })),
  [FACT_FORMULA.levelUpCostAt]: Object.values(LEVEL_SELECTOR).map((level) => ({
    id: FACT_FORMULA.levelUpCostAt,
    argument: { level },
  })),
};

const CATALOG_CALLS: { readonly [Id in CatalogQuantityId]: readonly CatalogQuantityCall[] } = {
  [CATALOG_QUANTITY.tierCount]: traitIds.map((traitId) => ({ id: CATALOG_QUANTITY.tierCount, argument: { traitId } })),
  [CATALOG_QUANTITY.unlockCount]: traitIds.map((traitId) => ({
    id: CATALOG_QUANTITY.unlockCount,
    argument: { traitId },
  })),
  [CATALOG_QUANTITY.requiresCount]: traitIds.map((traitId) => ({
    id: CATALOG_QUANTITY.requiresCount,
    argument: { traitId },
  })),
  [CATALOG_QUANTITY.stageCount]: [{ id: CATALOG_QUANTITY.stageCount, argument: {} }],
};

const LINK_CALLS: { readonly [Id in DerivedLinkId]: readonly DerivedLinkCall[] } = {
  [DERIVED_LINK.traitStage]: traitIds.map((traitId) => ({ id: DERIVED_LINK.traitStage, argument: { traitId } })),
  [DERIVED_LINK.traitRequires]: traitIds.map((traitId) => ({ id: DERIVED_LINK.traitRequires, argument: { traitId } })),
  [DERIVED_LINK.traitUnlockVariant]: traitIds.map((traitId) => ({
    id: DERIVED_LINK.traitUnlockVariant,
    argument: { traitId },
  })),
  [DERIVED_LINK.stageGateTraits]: DEFAULT_BALANCE.ladder.STAGE_ORDER.map((stage) => ({
    id: DERIVED_LINK.stageGateTraits,
    argument: { stage },
  })),
  [DERIVED_LINK.stageNext]: traitIds.map((traitId) => ({ id: DERIVED_LINK.stageNext, argument: { traitId } })),
  [DERIVED_LINK.foodZones]: (Object.keys(DEFAULT_BALANCE.ecology.FOOD_ZONE_WEIGHTS_BY_KIND) as SpawnedKind[]).map(
    (foodKind) => ({ id: DERIVED_LINK.foodZones, argument: { foodKind } }),
  ),
  [DERIVED_LINK.abilityTraits]: Object.values(ABILITY).map((abilityId) => ({
    id: DERIVED_LINK.abilityTraits,
    argument: { abilityId },
  })),
  [DERIVED_LINK.tagTraits]: DEFAULT_BALANCE.progression.DNA_TAGS.map((tag) => ({
    id: DERIVED_LINK.tagTraits,
    argument: { tag },
  })),
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
