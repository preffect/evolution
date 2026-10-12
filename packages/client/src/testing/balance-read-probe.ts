// The probe the fact-source spec judges a row by (docs/architecture/encyclopedia.md §12.6): which balance leaves a
// computation reads, through a recording proxy of an unfrozen clone (a proxy over the frozen default would break its
// invariants), and what it computes with one of those leaves patched (× 2, or + 1 at 0; an array's `length` counts as a
// leaf, so a count over structure is pinned too).

import { DEFAULT_BALANCE, giantBalanceProblems, type BalanceConfig } from '@evolution/shared';

export type Path = readonly string[];

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

export function readsOf<Result>(evaluate: (balance: BalanceConfig) => Result): { result: Result; reads: Path[] } {
  const reads: Path[] = [];
  const result = evaluate(recording(structuredClone(DEFAULT_BALANCE) as BalanceConfig, reads));
  return { result, reads };
}

/**
 * A clone with the number at `path` doubled, or set to one when it is zero. An array's `length` is doubled by repeating
 * its entries, so the clone stays a balance with no holes in it.
 */
function patched(path: Path): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE) as BalanceConfig;
  const parent = path
    .slice(0, -1)
    .reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, balance as never);
  const leaf = path[path.length - 1] ?? '';
  if (Array.isArray(parent) && leaf === 'length') {
    parent.push(...(parent as unknown[]));
    return balance;
  }
  const value = parent[leaf] as number;
  parent[leaf] = value === 0 ? 1 : value * 2;
  return balance;
}

/**
 * The row's value with `path` patched, or `null` where the patch breaks a giant rule (a giant's build doubled in length
 * lists each trait twice): `debug_set_balance` refuses such a patch (`giantBalanceProblems`), so it moves nothing. Any
 * throw is the row's own bug, left to fail the spec.
 */
export function valueUnderPatch<Call>(
  evaluate: (balance: BalanceConfig, call: Call) => unknown,
  call: Call,
  path: Path,
): string | null {
  const balance = patched(path);
  if (giantBalanceProblems(balance).length > 0) return null;
  return JSON.stringify(evaluate(balance, call));
}
