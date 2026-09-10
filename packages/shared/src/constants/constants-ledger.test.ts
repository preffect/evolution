// The ledger (docs/CODE-STANDARDS.md §2): every constant a design table names exists, exported
// from the constants barrel, so the docs and the code cannot drift silently. The rows are parsed
// from the docs themselves rather than copied here, so a renamed constant fails on either side.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as constants from './index.js';

const DOCS_DIRECTORY = new URL('../../../../docs/', import.meta.url);

/** The constants-table section of each design doc, by heading (`## N. Constants table ...`). */
const CONSTANTS_TABLE_SOURCES = [
  { documentName: 'GAME-DESIGN.md', section: 12 },
  { documentName: 'ECOLOGY.md', section: 7 },
  { documentName: 'PROGRESSION.md', section: 6 },
  { documentName: 'TRAITS.md', section: 5 },
] as const;

const TABLE_ROW_PATTERN = /^\|\s*(`[^|]*)\|/;
/**
 * A backticked UPPER_SNAKE name. A family glob such as `MITOSIS_*` (ECOLOGY §7, reserved) never
 * matches because `*` is outside the class, so a cell that lists a glob beside a real name still
 * yields the real name.
 */
const BACKTICKED_NAME_PATTERN = /`([A-Z][A-Z0-9_]*)`/g;
const MINIMUM_NAMES_PER_DOC = 5;
/** The ECOLOGY §7 row `\`MITOSIS_*\`, \`EJECT_MASS\``: a glob beside a real name once dropped the whole row. */
const GLOB_ROW_SOURCE = { documentName: 'ECOLOGY.md', section: 7, globName: 'MITOSIS_*', realName: 'EJECT_MASS' };

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
  describe.each(CONSTANTS_TABLE_SOURCES)('$documentName §$section', ({ documentName, section }) => {
    const names = namesInConstantsTable(documentName, section);

    it('parses a table', () => {
      expect(names.length).toBeGreaterThanOrEqual(MINIMUM_NAMES_PER_DOC);
    });

    it.each(names)('%s', (name) => {
      expect(constants).toHaveProperty(name);
      expect((constants as Record<string, unknown>)[name]).not.toBeUndefined();
    });
  });
});
