// Applies a `debug_set_balance` patch (docs/CODE-STANDARDS.md §2): number leaves, at paths that already exist, and the
// declared non-number leaves (`balance-leaf-kinds.ts`: a stage id, the era list), each value checked by its kind's validator. Tables
// and id arrays are structure, not tunables, so a patch that names one is refused as a whole; a live balance is
// never left half-patched. The one array a patch indexes is a trait's tier table under `traits.TRAIT_TIERS`
// (`traits.TRAIT_TIERS.cilia.0.speedMultiplier`, row 0 = tier I, #715). The input is never written: the patch lands
// on a clone, so `DEFAULT_BALANCE` (deep-frozen, shared by every room) can be patched directly and the caller keeps
// the copy it is handed back. A declared structure path is refused by name, saying where its numbers live (#150).

import { BALANCE_PATH_SEPARATOR, NON_NUMBER_BALANCE_LEAVES, type BalanceLeafKind } from './balance-leaf-kinds.js';
import { DebugRequestError } from './debug-request-error.js';
import type { BalancePatch, BalancePatchLeaf } from './simulation-debug-handle.js';

/**
 * Balance paths that hold structure a patch could mistake for tunables, each with where the simulation reads
 * the numbers from. `TRAIT_CATALOG[n].tiers` holds the tier numbers too, but only `TRAIT_TIERS` is read for them
 * (CODE-STANDARDS.md §2), so a write under the catalog would change nothing in play.
 */
const STRUCTURE_PATHS: readonly { readonly path: string; readonly whereTheNumbersLive: string }[] = [
  {
    path: 'traits.TRAIT_CATALOG',
    whereTheNumbersLive:
      'trait tier numbers live in "traits.TRAIT_TIERS", patched as "traits.TRAIT_TIERS.<trait id>.<row>.<field>" (row 0 is tier I)',
  },
];

/** The tier tables: the one place a patch indexes into an array, by row (#715). */
const TIER_TABLES_PATH: readonly string[] = ['traits', 'TRAIT_TIERS'];
/** The catalog rows, whose `tiers` is the same table as `TRAIT_TIERS[id]` in `DEFAULT_BALANCE`. */
const CATALOG_PATH: readonly string[] = ['traits', 'TRAIT_CATALOG'];
/** `<TIER_TABLES_PATH>.<trait id>`: the depth at which a tier table's rows are indexed. */
const TIER_TABLE_DEPTH = TIER_TABLES_PATH.length + 1;
const ROW_INDEX_PATTERN = /^(0|[1-9][0-9]*)$/;

/** Refuses `path` when it is a declared structure path; the walk reaches any path under one through it first. */
function refuseStructurePath(path: readonly string[]): void {
  const dottedPath = path.join(BALANCE_PATH_SEPARATOR);
  const structure = STRUCTURE_PATHS.find((entry) => dottedPath === entry.path);
  if (structure !== undefined) {
    throw new DebugRequestError(`"${structure.path}" is structure, not a tunable: ${structure.whereTheNumbersLive}`);
  }
}

/** A balance is a nested plain record whose leaves are numbers or structure (arrays, ids). */
export type MutableBalance = { [key: string]: unknown };

function isPlainRecord(value: unknown): value is MutableBalance {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function startsWith(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((key, index) => path[index] === key);
}

/** True for a path that names a tier table, a row of one or a number in a row. */
function isTraitTierPath(path: readonly string[]): boolean {
  return path.length > TIER_TABLES_PATH.length && startsWith(path, TIER_TABLES_PATH);
}

/** A tier table is the one array a patch may index: `containerPath` is the table's own path. */
function isIndexableTierTable(container: unknown, containerPath: readonly string[]): container is unknown[] {
  return (
    Array.isArray(container) && containerPath.length === TIER_TABLE_DEPTH && startsWith(containerPath, TIER_TABLES_PATH)
  );
}

/** `container[key]` where a patch may walk: a plain record's key, or a row of a tier table; otherwise undefined. */
function childOf(container: unknown, key: string, containerPath: readonly string[]): unknown {
  if (isPlainRecord(container)) return container[key];
  if (isIndexableTierTable(container, containerPath) && ROW_INDEX_PATTERN.test(key)) return container[Number(key)];
  return undefined;
}

/** One leaf write: the path and the value, checked against the balance before anything is cloned. */
type LeafWrite = [path: string[], value: BalancePatchLeaf];

/** `value` when it passes its declared kind's validator, at a leaf the balance has; otherwise a refusal naming the kind. */
function declaredLeafValue(
  kind: BalanceLeafKind,
  current: unknown,
  value: unknown,
  path: readonly string[],
): BalancePatchLeaf {
  const dottedPath = path.join(BALANCE_PATH_SEPARATOR);
  if (current === undefined) throw new DebugRequestError(`"${dottedPath}" is not a leaf of the balance`);
  if (!kind.accepts(value)) {
    throw new DebugRequestError(`"${dottedPath}" takes ${kind.expected}, not ${JSON.stringify(value)}`);
  }
  return value as BalancePatchLeaf;
}

function isPatchRecord(value: BalancePatchLeaf | BalancePatch): value is BalancePatch {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * The path and value of every leaf in `patch`; throws on a path that is neither a number leaf of `target` given a finite
 * number nor a declared non-number leaf given a value its kind accepts.
 */
function collectLeafWrites(target: unknown, patch: BalancePatch, pathSoFar: string[]): LeafWrite[] {
  const writes: LeafWrite[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const path = [...pathSoFar, key];
    refuseStructurePath(path);
    const current = childOf(target, key, pathSoFar);
    const declaredKind = NON_NUMBER_BALANCE_LEAVES.get(path.join(BALANCE_PATH_SEPARATOR));
    if (declaredKind !== undefined) {
      writes.push([path, declaredLeafValue(declaredKind, current, value, path)]);
    } else if (typeof value === 'number') {
      if (typeof current !== 'number') {
        throw new DebugRequestError(`"${path.join(BALANCE_PATH_SEPARATOR)}" is not a number leaf of the balance`);
      }
      if (!Number.isFinite(value)) {
        throw new DebugRequestError(`"${path.join(BALANCE_PATH_SEPARATOR)}" must be a finite number`);
      }
      writes.push([path, value]);
    } else if (isPatchRecord(value)) {
      writes.push(...collectLeafWrites(current, value, path));
    } else {
      throw new DebugRequestError(`"${path.join(BALANCE_PATH_SEPARATOR)}" is not a number leaf of the balance`);
    }
  }
  return writes;
}

/** Writes `value` at `path`; a list is copied, so the balance never aliases the patch it came in. */
function writeLeaf(target: MutableBalance, path: string[], value: BalancePatchLeaf): void {
  let cursor: unknown = target;
  for (const [depth, key] of path.slice(0, -1).entries()) cursor = childOf(cursor, key, path.slice(0, depth));
  if (!isPlainRecord(cursor))
    throw new DebugRequestError(`"${path.join(BALANCE_PATH_SEPARATOR)}" vanished while patching`);
  cursor[path[path.length - 1] as string] = Array.isArray(value) ? [...value] : value;
}

/**
 * Points every catalog row's `tiers` at the patched `TRAIT_TIERS` table of its id, as `DEFAULT_BALANCE` has them, so
 * the catalog copy moves with a tier patch even on a balance whose aliasing a JSON round trip dropped (a replay file).
 */
function realiasCatalogTiers(balance: MutableBalance): void {
  const tierTables = valueAt(balance, TIER_TABLES_PATH);
  const catalog = valueAt(balance, CATALOG_PATH);
  if (!isPlainRecord(tierTables) || !Array.isArray(catalog)) return;
  for (const row of catalog) {
    if (isPlainRecord(row) && typeof row['id'] === 'string' && Array.isArray(tierTables[row['id']])) {
      row['tiers'] = tierTables[row['id']];
    }
  }
}

/** The value at a path of plain records, or undefined when the walk leaves them. */
function valueAt(balance: MutableBalance, path: readonly string[]): unknown {
  let cursor: unknown = balance;
  for (const key of path) cursor = isPlainRecord(cursor) ? cursor[key] : undefined;
  return cursor;
}

export interface BalancePatchResult<Balance> {
  /** A fresh copy of the input with every leaf of the patch applied; the input is untouched. */
  readonly balance: Balance;
  /** The dotted paths written, in patch order. */
  readonly writtenPaths: readonly string[];
  /** True when a number under `traits.TRAIT_TIERS` was written: every cell's folded modifiers are stale (#715). */
  readonly didChangeTraitTiers: boolean;
}

/**
 * Returns a clone of `balance` with every leaf of `patch` applied and the dotted paths it
 * wrote. Validates the whole patch against the input before cloning, so a refused patch costs no copy.
 */
export function applyBalancePatch<Balance extends MutableBalance>(
  balance: Balance,
  patch: BalancePatch,
): BalancePatchResult<Balance> {
  const writes = collectLeafWrites(balance, patch, []);
  const patched = structuredClone(balance);
  for (const [path, value] of writes) writeLeaf(patched, path, value);
  const didChangeTraitTiers = writes.some(([path]) => isTraitTierPath(path));
  if (didChangeTraitTiers) realiasCatalogTiers(patched);
  return {
    balance: patched,
    writtenPaths: writes.map(([path]) => path.join(BALANCE_PATH_SEPARATOR)),
    didChangeTraitTiers,
  };
}
