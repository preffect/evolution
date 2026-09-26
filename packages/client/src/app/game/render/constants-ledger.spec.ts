// @vitest-environment node
// The own-cell indicators' ledger (docs/ui/components-and-constants.md §9, docs/CODE-STANDARDS.md §2): every row of the
// table is parsed from the doc and pinned against `render/constants.ts` by name **and value**, the
// way the shared `constants-ledger.test.ts` pins the four design tables by name. Values too, because
// §3.1.3's geometry table and its inequalities are derived from these numbers, and that derivation is
// only true of the values the doc shows.

import { describe, expect, it } from 'vitest';
import { markdownSection, tableRows } from '@evolution/shared';
import { readRepoDocument } from '../../../testing/repo-document';
import * as constants from './constants';
import * as ownCellConstants from './constants/own-cell';

const UI_DOCUMENT = readRepoDocument('docs/ui/components-and-constants.md');
const HUD_DOCUMENT = readRepoDocument('docs/ui/hud.md');
const CONSTANTS_SECTION = markdownSection(UI_DOCUMENT, '## 9. Constants table');
/** The distinct names §9's rows carry: a row added or removed is a deliberate edit on both sides. */
const EXPECTED_NAMES = 36;

const BACKTICKED_NAME = /`([A-Z][A-Z0-9_]*)`/g;
const DOC_NUMBER = /\d+(?:\.\d+)?/g;

interface LedgerRow {
  readonly names: readonly string[];
  readonly values: readonly number[];
}

/** Each row whose first cell names a constant: its names and the numbers of its value cell, in order. */
function ledgerRows(): LedgerRow[] {
  return tableRows(CONSTANTS_SECTION)
    .filter(([nameCell = '']) => nameCell.startsWith('`'))
    .map(([nameCell = '', valueCell = '']) => ({
      names: [...nameCell.matchAll(BACKTICKED_NAME)].map((match) => match[1] ?? ''),
      values: [...valueCell.matchAll(DOC_NUMBER)].map((match) => Number(match[0])),
    }));
}

/** A constant's numbers in declaration order: a record of values (the orbit angle pair) flattens. */
function numbersOf(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numbersOf);
  return [];
}

const exported = constants as Readonly<Record<string, unknown>>;
const rows = ledgerRows();

describe('docs/ui/components-and-constants.md §9 constants ledger', () => {
  it(`parses exactly ${EXPECTED_NAMES} names (a doc row added or removed updates this pin)`, () => {
    expect(rows.flatMap((row) => row.names)).toHaveLength(EXPECTED_NAMES);
  });

  it.each(rows)('$names holds the value §9 gives it', ({ names, values }) => {
    const actual = names.flatMap((name) => {
      expect(exported, name).toHaveProperty(name);
      return numbersOf(exported[name]);
    });
    expect(actual).toEqual(values);
  });

  it('names every export of constants/own-cell.ts in a §9 row, so a new floor cannot land undocumented', () => {
    // The rows above are checked against the code; this is the other direction. A subset, not an
    // equality: §9 also carries `DNA_RING_KEEP_OUT_FRACTION`, whose page is `organelles.ts`.
    const documented = new Set(rows.flatMap((row) => row.names));
    expect(Object.keys(ownCellConstants).filter((name) => !documented.has(name))).toEqual([]);
  });

  it('keys the angle pair by the variant §3.1.2 puts at each angle, not just in the right order', () => {
    // The ledger compares the pair by declaration order, which a swap of the two keys would pass.
    const aerobic = /aerobic (\d+), photosynthetic (\d+)/.exec(markdownSection(HUD_DOCUMENT, '## 3. '));
    expect(constants.LADDER_ORBIT_ANGLES_PAIR_DEG).toEqual({
      aerobic: Number(aerobic?.[1]),
      photosynthetic: Number(aerobic?.[2]),
    });
  });
});
