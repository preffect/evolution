// The design docs as a spec reads them: the ledgers parse a doc's own tables rather than copying
// its numbers, so the doc and the code cannot drift silently (docs/CODE-STANDARDS.md §2). Node-only,
// for specs. The section and table reader is `@evolution/shared`'s `markdownSection` / `tableRows` (#414).

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
