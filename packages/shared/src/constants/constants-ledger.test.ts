// The ledger (docs/CODE-STANDARDS.md §2): every constant a design table names exists, exported
// from the constants barrel, so the docs and the code cannot drift silently. The rows are parsed
// from the docs themselves rather than copied here, so a renamed constant fails on either side.

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as constants from './index.js';

const DOCS_DIRECTORY = new URL('../../../../docs/', import.meta.url);
const PACKAGES_DIRECTORY = new URL('../../../../packages/', import.meta.url);

/**
 * Constants that describe a consequence of other constants rather than driving anything, and whose
 * doc block says so. The claim is load-bearing: it is the only reason `world-store.spec.ts` and
 * `netcode.test.ts` deliberately repeat the literal instead of importing the name, and it goes
 * quietly false the day someone gives one a consumer (#283 item 18).
 */
const DESCRIBES_BUT_DOES_NOT_DRIVE = ['EFFECT_DRAW_WINDOW_TICKS'] as const;

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

/**
 * The constants-table section of each design doc, by heading (`## N. Constants table ...`), and the
 * number of distinct names its rows carry. The count is pinned so that a row added to or removed
 * from a doc (or a table the parser silently stopped seeing) is a deliberate edit on both sides.
 */
const CONSTANTS_TABLE_SOURCES = [
  { documentName: 'game-design/constants-and-acceptance.md', section: 12, expectedNames: 38 },
  { documentName: 'ecology/constants.md', section: 7, expectedNames: 95 },
  { documentName: 'PROGRESSION.md', section: 6, expectedNames: 16 },
  { documentName: 'traits/constants-and-acceptance.md', section: 5, expectedNames: 7 },
] as const;

const TABLE_ROW_PATTERN = /^\|\s*(`[^|]*)\|/;
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

function sectionOf(markdown: string, section: number): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${section}. Constants table`));
  expect(start, `section ${section} heading`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** Every backticked UPPER_SNAKE name in the first cell of a table row of the section. */
function namesInConstantsTable(documentName: string, section: number): string[] {
  const markdown = readFileSync(new URL(documentName, DOCS_DIRECTORY), 'utf8');
  const names = new Set<string>();
  for (const line of sectionOf(markdown, section).split('\n')) {
    const firstCell = TABLE_ROW_PATTERN.exec(line)?.[1];
    if (!firstCell) continue;
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
    expect(consumers.map((file) => file.pathname.split('/packages/')[1])).toEqual([]);
  });
});
