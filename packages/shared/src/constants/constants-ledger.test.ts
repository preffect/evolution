// The ledger (docs/CODE-STANDARDS.md §2): every constant a design table names exists, exported
// from the constants barrel, so the docs and the code cannot drift silently. The rows are parsed
// from the docs themselves rather than copied here, so a renamed constant fails on either side.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as constants from './index.js';
import * as absorptionDerived from './absorption-derived.js';
import * as absorption from './absorption.js';
import { DEFAULT_BALANCE, DERIVED_BALANCE_CONSTANTS } from './balance.js';
import * as camera from './camera.js';
import * as controls from './controls.js';
import * as earlyLife from './early-life.js';
import * as ecology from './ecology.js';
import * as eras from './eras.js';
import * as erasDerived from './eras-derived.js';
import * as giants from './giants.js';
import * as growth from './growth.js';
import * as ladder from './ladder.js';
import * as pool from './pool.js';
import * as poolCreatures from './pool-creatures.js';
import * as progression from './progression.js';
import * as session from './session.js';
import * as traits from './traits.js';
import * as wildCells from './wild-cells.js';
import * as world from './world.js';
import * as worldClock from './world-clock.js';
import { markdownSection, tableRows } from '../testing/markdown-document.js';

const DOCS_DIRECTORY = new URL('../../../../docs/', import.meta.url);

/**
 * The constants-table section of each design doc, by its heading line at any level (`## 12. Constants table`, or a
 * `####` table inside a larger section), the number of distinct names its rows carry, and the domain files it owns
 * (CODE-STANDARDS.md §2). The section runs to the next heading of the same or a higher level, so a later table of the
 * same doc is never read. The count is pinned so that a row added to or removed from a doc (or a table the parser
 * silently stopped seeing) is a deliberate edit on both sides; the domain files are what the reverse ledger reads (#150).
 */
const CONSTANTS_TABLE_SOURCES = [
  {
    documentName: 'game-design/constants-and-acceptance.md',
    heading: '## 12. Constants table',
    expectedNames: 38,
    domainModules: { world, session, controls, ladder, camera, worldClock },
  },
  {
    documentName: 'ecology/constants.md',
    heading: '## 7. Constants table',
    expectedNames: 130,
    domainModules: { ecology, growth, absorption, wildCells, giants, absorptionDerived },
  },
  {
    documentName: 'PROGRESSION.md',
    heading: '## 6. Constants table',
    expectedNames: 16,
    domainModules: { progression },
  },
  {
    documentName: 'traits/constants-and-acceptance.md',
    heading: '## 5. Constants table',
    expectedNames: 7,
    domainModules: { traits },
  },
  {
    documentName: 'game-design/early-life.md',
    heading: '#### 15.12.1 Early-life constants table',
    expectedNames: 4,
    domainModules: { earlyLife },
  },
  {
    documentName: 'game-design/phases.md',
    heading: '#### 14.14.1 Stage 1 constants table',
    expectedNames: 59,
    domainModules: { eras, erasDerived, pool, poolCreatures },
  },
] as const;

/**
 * Domain-file exports that are not a tunable row of their doc's table, one reason each. The reverse ledger
 * skips them, and a test fails the day an entry gets a row or stops being exported, so the list cannot rot.
 */
const EXPORTS_WITHOUT_A_ROW = [
  {
    name: 'STARTING_STAGE',
    reason: 'an alias of `STAGE_ORDER[0]`, which has the row; derived, never tuned (CODE-STANDARDS.md §2)',
  },
] as const;
const NAMES_WITHOUT_A_ROW: readonly string[] = EXPORTS_WITHOUT_A_ROW.map(({ name }) => name);

/** A constants row's first cell opens with its backticked name; the header's `Constant` does not. */
const NAME_CELL_START = '`';
/**
 * A backticked UPPER_SNAKE name. A family glob such as `MITOSIS_*` (ecology/constants.md §7, reserved) never
 * matches because `*` is outside the class, so a cell that lists a glob beside a real name still
 * yields the real name.
 */
const BACKTICKED_NAME_PATTERN = /`([A-Z][A-Z0-9_]*)`/g;
/** The ecology/constants.md §7 row `\`MITOSIS_*\`, \`EJECT_MASS\``: a glob beside a real name once dropped the whole row. */
const GLOB_ROW_SOURCE = {
  documentName: 'ecology/constants.md',
  heading: '## 7. Constants table',
  globName: 'MITOSIS_*',
  realName: 'EJECT_MASS',
};

/** A table under a `####` heading (early-life.md §15.12.1), and a row of the next `####` section's table. */
const EARLY_LIFE_TABLE = {
  documentName: 'game-design/early-life.md',
  heading: '#### 15.12.1 Early-life constants table',
  ownRow: 'LATCH_BOND_SECONDS',
  laterTableRow: 'SWALLOW_GATE_TRAITS',
};

/** A backticked family glob such as `MITOSIS_*`: the row names every export that starts with its prefix. */
const BACKTICKED_GLOB_PATTERN = /`([A-Z][A-Z0-9_]*_)\*`/g;
/** An export name the reverse ledger reads: the same UPPER_SNAKE shape the table rows name. */
const UPPER_SNAKE_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** A row whose value is computed from other constants says so in a later cell: `s (derived: …)`, `(derived from …)`. */
const DERIVED_ROW_PATTERN = /\(derived\b/;

/** Every row, or only the rows whose other cells pass `selectsRow`. */
const EVERY_ROW = (): boolean => true;
const DERIVED_ROW = (otherCells: readonly string[]): boolean =>
  otherCells.some((cell) => DERIVED_ROW_PATTERN.test(cell));

/** The cells of every table row in the doc's section under `heading`, at whatever level the heading is. */
function constantsTableRows(documentName: string, heading: string): string[][] {
  const markdown = readFileSync(new URL(documentName, DOCS_DIRECTORY), 'utf8');
  return tableRows(markdownSection(markdown, heading));
}

/** Every backticked UPPER_SNAKE name in the first cell of a table row of the section that `selectsRow` keeps. */
function namesInConstantsTable(
  documentName: string,
  heading: string,
  selectsRow: (otherCells: readonly string[]) => boolean = EVERY_ROW,
): string[] {
  const names = new Set<string>();
  for (const [firstCell, ...otherCells] of constantsTableRows(documentName, heading)) {
    if (!firstCell?.startsWith(NAME_CELL_START) || !selectsRow(otherCells)) continue;
    for (const match of firstCell.matchAll(BACKTICKED_NAME_PATTERN)) names.add(match[1]!);
  }
  return [...names];
}

/** The prefix of every family glob (`MITOSIS_*` as `MITOSIS_`) in the first cell of a table row of the section. */
function globPrefixesInConstantsTable(documentName: string, heading: string): string[] {
  return constantsTableRows(documentName, heading).flatMap(([firstCell]) =>
    [...(firstCell ?? '').matchAll(BACKTICKED_GLOB_PATTERN)].map((match) => match[1]!),
  );
}

/** Every UPPER_SNAKE export of the domain files, re-exports included: the names a doc row must carry. */
function upperSnakeExports(domainModules: Readonly<Record<string, object>>): string[] {
  const names = Object.values(domainModules).flatMap((domainModule) => Object.keys(domainModule));
  return [...new Set(names)].filter((name) => UPPER_SNAKE_NAME_PATTERN.test(name));
}

/** The exports of the domain files that neither a row of the doc's table nor one of its family globs names. */
function exportsWithoutARow({ documentName, heading, domainModules }: (typeof CONSTANTS_TABLE_SOURCES)[number]) {
  const rowNames = new Set(namesInConstantsTable(documentName, heading));
  const globPrefixes = globPrefixesInConstantsTable(documentName, heading);
  return upperSnakeExports(domainModules).filter(
    (name) => !rowNames.has(name) && !globPrefixes.some((prefix) => name.startsWith(prefix)),
  );
}

describe('constants ledger: the table parser', () => {
  it('keeps the real name of a row that also lists a family glob, and never the glob itself', () => {
    const names = namesInConstantsTable(GLOB_ROW_SOURCE.documentName, GLOB_ROW_SOURCE.heading);
    expect(names).toContain(GLOB_ROW_SOURCE.realName);
    expect(names).not.toContain(GLOB_ROW_SOURCE.globName);
  });

  it('reads a table under a deeper heading up to the next heading of its level, never a later table of the doc', () => {
    // early-life.md §15.12.1 is a `####` table; §15.12.2, the next `####`, lists rows other tables own.
    const names = namesInConstantsTable(EARLY_LIFE_TABLE.documentName, EARLY_LIFE_TABLE.heading);
    expect(names).toContain(EARLY_LIFE_TABLE.ownRow);
    expect(names).not.toContain(EARLY_LIFE_TABLE.laterTableRow);
  });
});

describe('constants ledger: every design-table constant is exported', () => {
  describe.each(CONSTANTS_TABLE_SOURCES)('$documentName $heading', ({ documentName, heading, expectedNames }) => {
    const names = namesInConstantsTable(documentName, heading);

    it(`parses exactly ${expectedNames} names (a doc row added or removed updates this pin)`, () => {
      expect(names).toHaveLength(expectedNames);
    });

    it.each(names)('%s', (name) => {
      expect(constants).toHaveProperty(name);
      expect((constants as Record<string, unknown>)[name]).not.toBeUndefined();
    });
  });
});

describe('constants ledger: every domain-file export has a design-table row (#150)', () => {
  describe.each(CONSTANTS_TABLE_SOURCES)('$documentName $heading', (source) => {
    it('reads the exports of its domain files', () => {
      // An empty module map, or a namespace that stopped carrying names, would pass the case below vacuously.
      for (const domainModule of Object.values(source.domainModules)) {
        expect(upperSnakeExports({ domainModule })).not.toEqual([]);
      }
    });

    it('names every UPPER_SNAKE export in a row or a family glob, or allow-lists it with a reason', () => {
      expect(exportsWithoutARow(source).filter((name) => !NAMES_WITHOUT_A_ROW.includes(name))).toEqual([]);
    });
  });

  it('reads every domain the balance carries, so a new domain file cannot skip the reverse ledger', () => {
    const readNames = new Set(CONSTANTS_TABLE_SOURCES.flatMap(({ domainModules }) => upperSnakeExports(domainModules)));
    const balanceNames = Object.values(DEFAULT_BALANCE).flatMap((domain) => Object.keys(domain));
    expect(balanceNames.filter((name) => !readNames.has(name))).toEqual([]);
  });

  it('keeps no allow-list entry that a row names or no domain file exports', () => {
    const stillWithoutARow = CONSTANTS_TABLE_SOURCES.flatMap(exportsWithoutARow);
    expect(NAMES_WITHOUT_A_ROW.filter((name) => !stillWithoutARow.includes(name))).toEqual([]);
  });
});

describe('constants ledger: derived constants stay out of the balance (#367)', () => {
  it('lists exactly the derived rows of the design tables in DERIVED_BALANCE_CONSTANTS', () => {
    // Both ways: a new derived row cannot reach the balance untagged, and a listed name the docs no longer mark
    // derived (or a parser that stopped seeing the rows, which would pass the first direction vacuously) fails too.
    const derivedRows = CONSTANTS_TABLE_SOURCES.flatMap(({ documentName, heading }) =>
      namesInConstantsTable(documentName, heading, DERIVED_ROW),
    );
    expect(derivedRows.sort()).toEqual([...DERIVED_BALANCE_CONSTANTS].sort());
  });
});
