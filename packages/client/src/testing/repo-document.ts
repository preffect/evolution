// The design docs as a spec reads them: the ledgers parse a doc's own tables rather than copying
// its numbers, so the doc and the code cannot drift silently (docs/CODE-STANDARDS.md §2). Node-only,
// for specs.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** A document by its repo-relative path; the runner's cwd is a package or the root, so walk up to it. */
export function readRepoDocument(relativePath: string): string {
  let directory = process.cwd();
  while (!existsSync(join(directory, relativePath))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`${relativePath} not found above ${process.cwd()}`);
    directory = parent;
  }
  return readFileSync(join(directory, relativePath), 'utf8');
}

/** The `## <heading>` section of a markdown document (its sub-headings included), up to the next `## `. */
export function markdownSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}`);
  if (start < 0) throw new Error(`## ${heading} not found`);
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf('\n## ');
  return end < 0 ? rest : rest.slice(0, end);
}

/** The cells of a markdown table row, trimmed, without the empty edges outside the outer pipes. */
export function tableCells(row: string): string[] {
  return row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}
