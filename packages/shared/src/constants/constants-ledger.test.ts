// The ledger (docs/CODE-STANDARDS.md §2): every constant a design table names exists, exported
// from the constants barrel, so the docs and the code cannot drift silently. The rows are parsed
// from the docs themselves rather than copied here, so a renamed constant fails on either side.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as constants from './index.js';
import * as absorptionDerived from './absorption-derived.js';
import * as absorption from './absorption.js';
import { DEFAULT_BALANCE, DERIVED_BALANCE_CONSTANTS } from './balance.js';
import * as camera from './camera.js';
import * as controls from './controls.js';
import * as ecology from './ecology.js';
import * as growth from './growth.js';
import * as ladder from './ladder.js';
import * as progression from './progression.js';
import * as session from './session.js';
import * as traits from './traits.js';
import * as wildCells from './wild-cells.js';
import * as world from './world.js';
import * as worldClock from './world-clock.js';
import { markdownSection, tableRows } from '../testing/markdown-document.js';

const DOCS_DIRECTORY = new URL('../../../../docs/', import.meta.url);
const PACKAGES_DIRECTORY = new URL('../../../../packages/', import.meta.url);

/**
 * Constants that describe a consequence of other constants rather than driving anything, and whose
 * doc block says so. The claim is load-bearing: it is the only reason `world-store.spec.ts` and
 * `netcode.test.ts` deliberately repeat the literal instead of importing the name, and it goes
 * quietly false the day someone gives one a consumer (#283 item 18).
 */
const DESCRIBES_BUT_DOES_NOT_DRIVE = ['EFFECT_DRAW_WINDOW_TICKS'] as const;

/**
 * `constants/derive-netcode.ts` is the algebra behind the netcode constants and is deliberately out of
 * the barrel: the public surface is the named constants `netcode.ts` exports, not the function behind
 * them, and a second caller would pick levers of its own and re-open the drift #287 closes. Its own
 * header says so, which is the shape of prose #287 exists to turn into a case.
 */
const DERIVATION_MODULE = 'derive-netcode.js';
const DERIVATION_SOLE_IMPORTER = 'shared/src/constants/netcode.ts';

/** Every shipping TypeScript file under each package's `src`: not tests, not the doubles they use. */
function shippingSourceFiles(): URL[] {
  const files: URL[] = [];
  for (const packageName of readdirSync(PACKAGES_DIRECTORY)) {
    const source = new URL(`${packageName}/src/`, PACKAGES_DIRECTORY);
    let entries: string[];
    try {
      entries = readdirSync(source, { recursive: true }) as string[];
    } catch {
      continue; // a package without a src/ directory
    }
    for (const entry of entries) {
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      if (/\.(test|spec)\.ts$/.test(entry) || entry.includes('testing')) continue;
      files.push(new URL(entry, source));
    }
  }
  return files;
}

/** `…/packages/shared/src/constants/netcode.ts` as `shared/src/constants/netcode.ts`, for a readable failure. */
function pathWithinPackages(file: URL): string | undefined {
  return file.pathname.split('/packages/')[1];
}

/**
 * The constants-table section of each design doc, by heading (`## N. Constants table ...`), the
 * number of distinct names its rows carry, and the domain files it owns (CODE-STANDARDS.md §2). The count is
 * pinned so that a row added to or removed from a doc (or a table the parser silently stopped seeing) is a
 * deliberate edit on both sides; the domain files are what the reverse ledger reads (#150).
 */
const CONSTANTS_TABLE_SOURCES = [
  {
    documentName: 'game-design/constants-and-acceptance.md',
    section: 12,
    expectedNames: 38,
    domainModules: { world, session, controls, ladder, camera, worldClock },
  },
  {
    documentName: 'ecology/constants.md',
    section: 7,
    expectedNames: 101,
    domainModules: { ecology, growth, absorption, wildCells, absorptionDerived },
  },
  { documentName: 'PROGRESSION.md', section: 6, expectedNames: 16, domainModules: { progression } },
  { documentName: 'traits/constants-and-acceptance.md', section: 5, expectedNames: 7, domainModules: { traits } },
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
  section: 7,
  globName: 'MITOSIS_*',
  realName: 'EJECT_MASS',
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

/** The cells of every table row in the doc's `## N. Constants table` section. */
function constantsTableRows(documentName: string, section: number): string[][] {
  const markdown = readFileSync(new URL(documentName, DOCS_DIRECTORY), 'utf8');
  return tableRows(markdownSection(markdown, `## ${section}. Constants table`));
}

/** Every backticked UPPER_SNAKE name in the first cell of a table row of the section that `selectsRow` keeps. */
function namesInConstantsTable(
  documentName: string,
  section: number,
  selectsRow: (otherCells: readonly string[]) => boolean = EVERY_ROW,
): string[] {
  const names = new Set<string>();
  for (const [firstCell, ...otherCells] of constantsTableRows(documentName, section)) {
    if (!firstCell?.startsWith(NAME_CELL_START) || !selectsRow(otherCells)) continue;
    for (const match of firstCell.matchAll(BACKTICKED_NAME_PATTERN)) names.add(match[1]!);
  }
  return [...names];
}

/** The prefix of every family glob (`MITOSIS_*` as `MITOSIS_`) in the first cell of a table row of the section. */
function globPrefixesInConstantsTable(documentName: string, section: number): string[] {
  return constantsTableRows(documentName, section).flatMap(([firstCell]) =>
    [...(firstCell ?? '').matchAll(BACKTICKED_GLOB_PATTERN)].map((match) => match[1]!),
  );
}

/** Every UPPER_SNAKE export of the domain files, re-exports included: the names a doc row must carry. */
function upperSnakeExports(domainModules: Readonly<Record<string, object>>): string[] {
  const names = Object.values(domainModules).flatMap((domainModule) => Object.keys(domainModule));
  return [...new Set(names)].filter((name) => UPPER_SNAKE_NAME_PATTERN.test(name));
}

/** The exports of the domain files that neither a row of the doc's table nor one of its family globs names. */
function exportsWithoutARow({ documentName, section, domainModules }: (typeof CONSTANTS_TABLE_SOURCES)[number]) {
  const rowNames = new Set(namesInConstantsTable(documentName, section));
  const globPrefixes = globPrefixesInConstantsTable(documentName, section);
  return upperSnakeExports(domainModules).filter(
    (name) => !rowNames.has(name) && !globPrefixes.some((prefix) => name.startsWith(prefix)),
  );
}

describe('constants ledger: the table parser', () => {
  it('keeps the real name of a row that also lists a family glob, and never the glob itself', () => {
    const names = namesInConstantsTable(GLOB_ROW_SOURCE.documentName, GLOB_ROW_SOURCE.section);
    expect(names).toContain(GLOB_ROW_SOURCE.realName);
    expect(names).not.toContain(GLOB_ROW_SOURCE.globName);
  });
});

describe('constants ledger: every design-table constant is exported', () => {
  describe.each(CONSTANTS_TABLE_SOURCES)('$documentName §$section', ({ documentName, section, expectedNames }) => {
    const names = namesInConstantsTable(documentName, section);

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
  describe.each(CONSTANTS_TABLE_SOURCES)('$documentName §$section', (source) => {
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
    const derivedRows = CONSTANTS_TABLE_SOURCES.flatMap(({ documentName, section }) =>
      namesInConstantsTable(documentName, section, DERIVED_ROW),
    );
    expect(derivedRows.sort()).toEqual([...DERIVED_BALANCE_CONSTANTS].sort());
  });
});

describe('constants ledger: constants that describe rather than drive', () => {
  const sources = shippingSourceFiles();

  it('finds the shipping sources to scan', () => {
    // A scan that matched nothing would pass the cases below without reading a line of code.
    expect(sources.length).toBeGreaterThan(100);
  });

  it.each(DESCRIBES_BUT_DOES_NOT_DRIVE)('%s has no runtime consumer, so its doc block holds', (name) => {
    const consumers = sources.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // The file that exports it is its home, not a consumer.
      return source.includes(name) && !source.includes(`export const ${name}`);
    });
    // Aimed at the condition, not at today's behaviour: this goes red on exactly the day the comment
    // needs rewriting, and hands whoever adds the consumer the paragraph to update.
    expect(consumers.map(pathWithinPackages)).toEqual([]);
  });

  it('imports the netcode derivation from nothing but the file that names its result', () => {
    // The same shape for `derive-netcode.ts`'s own header claim (#287): the specifier is matched
    // without its leading `./` so an import from another directory counts too.
    const importers = sources.filter((file) => readFileSync(file, 'utf8').includes(DERIVATION_MODULE));
    expect(importers.map(pathWithinPackages)).toEqual([DERIVATION_SOLE_IMPORTER]);
  });
});
