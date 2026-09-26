// @vitest-environment node
// The legibility cues' ledger (docs/ui/hud.md §3.1.6, docs/CODE-STANDARDS.md §2): every row of the table is parsed
// from the doc and pinned by name and value against its home — `render/constants/legibility-cues.ts`, or
// `state/legibility-constants.ts` for the rows marked **state** — in both directions, so the table and the files
// cannot drift.

import { describe, expect, it } from 'vitest';
import { markdownSection, tableRows } from '@evolution/shared';
import { readRepoDocument } from '../../../testing/repo-document';
import * as renderConstants from './constants/legibility-cues';
import * as stateConstants from '../state/legibility-constants';

const HUD_DOCUMENT = readRepoDocument('docs/ui/hud.md');
const TABLE_HEADING = '#### 3.1.6 Legibility cue constants';
const STATE_MARK = '(**state**)';
const BACKTICKED_NAME = /`([A-Z][A-Z0-9_]*)`/;

interface LedgerRow {
  readonly name: string;
  readonly value: number;
  readonly isState: boolean;
}

/** §3.1.6's rows whose first cell names a constant. */
function ledgerRows(): LedgerRow[] {
  return tableRows(markdownSection(HUD_DOCUMENT, TABLE_HEADING))
    .filter(([nameCell = '']) => nameCell.startsWith('`'))
    .map(([nameCell = '', valueCell = '']) => ({
      name: BACKTICKED_NAME.exec(nameCell)?.[1] ?? '',
      value: Number(valueCell),
      isState: nameCell.includes(STATE_MARK),
    }));
}

const rows = ledgerRows();
const render = renderConstants as Readonly<Record<string, unknown>>;
const state = stateConstants as Readonly<Record<string, unknown>>;

describe('docs/ui/hud.md §3.1.6 legibility cue constants ledger', () => {
  it('finds the table', () => {
    expect(HUD_DOCUMENT.includes(TABLE_HEADING)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)('$name holds the value §3.1.6 gives it, in its home', ({ name, value, isState }) => {
    const home = isState ? state : render;
    expect(home, name).toHaveProperty(name);
    expect(home[name]).toBe(value);
  });

  it('declares nothing the table does not name, in either home', () => {
    const renderNames = rows.filter((row) => !row.isState).map((row) => row.name);
    const stateNames = rows.filter((row) => row.isState).map((row) => row.name);
    expect(Object.keys(render).sort()).toEqual([...renderNames].sort());
    expect(Object.keys(state).sort()).toEqual([...stateNames].sort());
  });
});
