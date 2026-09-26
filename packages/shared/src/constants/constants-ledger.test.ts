// The ledger (docs/CODE-STANDARDS.md §2): every constant a design table names exists, exported
// from the constants barrel, so the docs and the code cannot drift silently. The rows are parsed
// from the docs themselves rather than copied here, so a renamed constant fails on either side.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as constants from './index.js';
import { DERIVED_BALANCE_CONSTANTS } from './balance.js';
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
 * The constants-table section of each design doc, by heading (`## N. Constants table ...`), and the
 * number of distinct names its rows carry. The count is pinned so that a row added to or removed
 * from a doc (or a table the parser silently stopped seeing) is a deliberate edit on both sides.
 */
const CONSTANTS_TABLE_SOURCES = [
  { documentName: 'game-design/constants-and-acceptance.md', section: 12, expectedNames: 38 },
  { documentName: 'ecology/constants.md', section: 7, expectedNames: 101 },
  { documentName: 'PROGRESSION.md', section: 6, expectedNames: 16 },
  { documentName: 'traits/constants-and-acceptance.md', section: 5, expectedNames: 7 },
] as const;

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

/** A row whose value is computed from other constants says so in a later cell: `s (derived: …)`, `(derived from …)`. */
const DERIVED_ROW_PATTERN = /\(derived\b/;

/** Every row, or only the rows whose other cells pass `selectsRow`. */
const EVERY_ROW = (): boolean => true;
const DERIVED_ROW = (otherCells: readonly string[]): boolean =>
  otherCells.some((cell) => DERIVED_ROW_PATTERN.test(cell));

/** Every backticked UPPER_SNAKE name in the first cell of a table row of the section that `selectsRow` keeps. */
function namesInConstantsTable(
  documentName: string,
  section: number,
  selectsRow: (otherCells: readonly string[]) => boolean = EVERY_ROW,
): string[] {
  const markdown = readFileSync(new URL(documentName, DOCS_DIRECTORY), 'utf8');
  const names = new Set<string>();
  for (const [firstCell, ...otherCells] of tableRows(markdownSection(markdown, `## ${section}. Constants table`))) {
    if (!firstCell?.startsWith(NAME_CELL_START) || !selectsRow(otherCells)) continue;
    for (const match of firstCell.matchAll(BACKTICKED_NAME_PATTERN)) names.add(match[1]!);
  }
  return [...names];
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
