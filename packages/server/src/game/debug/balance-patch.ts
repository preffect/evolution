// Applies a `debug_set_balance` patch (docs/CODE-STANDARDS.md §2): number leaves only, at paths
// that already exist. Tables and id arrays are structure, not tunables, so a patch that names
// one is refused as a whole; a live balance is never left half-patched. The input is never
// written: the patch lands on a clone, so `DEFAULT_BALANCE` (deep-frozen, shared by every room)
// can be patched directly and the caller keeps the copy it is handed back.

import { DebugRequestError } from './debug-request-error.js';
import type { BalancePatch } from './simulation-debug-handle.js';

const PATH_SEPARATOR = '.';

/** A balance is a nested plain record whose leaves are numbers or structure (arrays, ids). */
export type MutableBalance = { [key: string]: unknown };

function isPlainRecord(value: unknown): value is MutableBalance {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The dotted paths of every number leaf in `patch`; throws on a path that is not a number leaf of `target`. */
function collectLeafWrites(target: unknown, patch: BalancePatch, pathSoFar: string[]): [string[], number][] {
  const writes: [string[], number][] = [];
  for (const [key, value] of Object.entries(patch)) {
    const path = [...pathSoFar, key];
    const current = isPlainRecord(target) ? target[key] : undefined;
    if (typeof value === 'number') {
      if (typeof current !== 'number') {
        throw new DebugRequestError(`"${path.join(PATH_SEPARATOR)}" is not a number leaf of the balance`);
      }
      if (!Number.isFinite(value)) {
        throw new DebugRequestError(`"${path.join(PATH_SEPARATOR)}" must be a finite number`);
      }
      writes.push([path, value]);
    } else {
      writes.push(...collectLeafWrites(current, value, path));
    }
  }
  return writes;
}

function writeLeaf(target: MutableBalance, path: string[], value: number): void {
  let cursor: MutableBalance = target;
  for (const key of path.slice(0, -1)) {
    const next = cursor[key];
    if (!isPlainRecord(next)) throw new DebugRequestError(`"${path.join(PATH_SEPARATOR)}" vanished while patching`);
    cursor = next;
  }
  cursor[path[path.length - 1] as string] = value;
}

export interface BalancePatchResult<Balance> {
  /** A fresh copy of the input with every number leaf of the patch applied; the input is untouched. */
  readonly balance: Balance;
  /** The dotted paths written, in patch order. */
  readonly writtenPaths: readonly string[];
}

/**
 * Returns a clone of `balance` with every number leaf of `patch` applied and the dotted paths it
 * wrote. Validates the whole patch against the input before cloning, so a refused patch costs no copy.
 */
export function applyBalancePatch<Balance extends MutableBalance>(
  balance: Balance,
  patch: BalancePatch,
): BalancePatchResult<Balance> {
  const writes = collectLeafWrites(balance, patch, []);
  const patched = structuredClone(balance);
  for (const [path, value] of writes) writeLeaf(patched, path, value);
  return { balance: patched, writtenPaths: writes.map(([path]) => path.join(PATH_SEPARATOR)) };
}
