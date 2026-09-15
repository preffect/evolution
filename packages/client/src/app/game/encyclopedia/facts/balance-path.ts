// Typed paths to balance leaves (docs/architecture/encyclopedia.md §12.3). The domain and the constant's name are
// checked by the compiler, so a renamed constant fails `typecheck` at the fact; deeper keys (a table's row) are
// checked by the fact-sources spec, which resolves every path in `DEFAULT_BALANCE` to a finite number.

import type { BalanceConfig } from '@evolution/shared';

export type BalanceDomain = keyof BalanceConfig;
export type BalanceConstantName<Domain extends BalanceDomain> = Extract<keyof BalanceConfig[Domain], string>;

/** A path to a number leaf: `['ecology', 'ALGAE_MASS']`, `['progression', 'RARITY_WEIGHT', 'rare']`. */
export type BalancePath = readonly [domain: BalanceDomain, name: string, ...keys: string[]];

export function balancePath<Domain extends BalanceDomain>(
  domain: Domain,
  name: BalanceConstantName<Domain>,
  ...keys: string[]
): BalancePath {
  return [domain, name, ...keys];
}

/** The number at `path` in `balance`; a path that does not end on a finite number is a broken fact, refused loudly. */
export function readBalancePath(balance: BalanceConfig, path: BalancePath): number {
  let value: unknown = balance;
  for (const key of path) {
    value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The balance path ${path.join('.')} is not a finite number`);
  }
  return value;
}
