// docs/architecture/debug-mcp.md §8: every declared non-number leaf exists in the default balance with a value its own
// kind accepts, and its kind refuses what no leaf could hold, so a kind or a path declared later is covered as it lands.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { BALANCE_PATH_SEPARATOR, NON_NUMBER_BALANCE_LEAVES } from './balance-leaf-kinds.js';

/** Values no declared kind may take: a number, nothing, a record, an empty id. */
const NO_KIND_ACCEPTS: readonly unknown[] = [3, null, undefined, {}, ''];

function defaultAt(dottedPath: string): unknown {
  let cursor: unknown = DEFAULT_BALANCE;
  for (const key of dottedPath.split(BALANCE_PATH_SEPARATOR)) cursor = (cursor as Record<string, unknown>)[key];
  return cursor;
}

describe('the declared non-number balance leaves', () => {
  it('declares at least the two stage-id leaves of the swallow switch and the latch', () => {
    expect([...NON_NUMBER_BALANCE_LEAVES.keys()]).toEqual(
      expect.arrayContaining(['absorption.SWALLOW_FROM_STAGE', 'earlyLife.LATCH_FROM_STAGE']),
    );
  });

  it.each([...NON_NUMBER_BALANCE_LEAVES])('%s ships a default its own kind accepts', (path, kind) => {
    const shipped = defaultAt(path);
    expect(shipped).not.toBeUndefined();
    expect(kind.accepts(shipped)).toBe(true);
  });

  it.each([...NON_NUMBER_BALANCE_LEAVES])('%s refuses what no leaf could hold', (_path, kind) => {
    for (const value of NO_KIND_ACCEPTS) expect(kind.accepts(value), JSON.stringify(value)).toBe(false);
  });
});
