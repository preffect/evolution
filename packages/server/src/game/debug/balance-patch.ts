// Applies a `debug_set_balance` patch (docs/CODE-STANDARDS.md §2): number leaves only, at paths
// that already exist. Tables and id arrays are structure, not tunables, so a patch that names
// one is refused as a whole; a live balance is never left half-patched.

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

/**
 * Mutates `balance` in place with every number leaf of `patch` and returns the dotted paths it
 * wrote. Validates the whole patch before writing anything.
 */
export function applyBalancePatch(balance: MutableBalance, patch: BalancePatch): string[] {
  const writes = collectLeafWrites(balance, patch, []);
  for (const [path, value] of writes) writeLeaf(balance, path, value);
  return writes.map(([path]) => path.join(PATH_SEPARATOR));
}
