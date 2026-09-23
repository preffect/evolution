import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// The Angular unit-test builder asks for non-isolated tests, but vitest takes pool isolation from the
// root config, which defaults to a fresh process per spec file: jsdom, the TestBed setup and every import
// paid 268 times (ticket #540). Plain specs share reused worker threads; a spec that uses the TestBed keeps
// its own process, because the Angular platform binds the first file's jsdom document for good.
const SOURCE_ROOT = join(import.meta.dirname, 'src');
const TESTBED_PATTERN = /\bTestBed\b/;
const SPEC_SUFFIX = '.spec.ts';

function specsUsingTestBed(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(SPEC_SUFFIX) && TESTBED_PATTERN.test(readFileSync(join(SOURCE_ROOT, path), 'utf8')))
    .map((path) => join(SOURCE_ROOT, path)); // absolute: a `**` glob skips the dot directory .worktrees
}

export default defineConfig({
  test: {
    pool: 'threads',
    poolMatchGlobs: specsUsingTestBed().map((specPath): [string, 'forks'] => [specPath, 'forks']),
    poolOptions: { threads: { isolate: false }, forks: { isolate: true } },
  },
});
