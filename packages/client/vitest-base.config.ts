import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The Angular unit-test builder asks for non-isolated tests, but vitest takes pool isolation from the
// root config, which defaults to a fresh process per spec file: jsdom, the TestBed setup and every import
// paid 268 times (ticket #540). Plain specs share reused worker threads; a spec that uses the TestBed keeps
// its own process, because the Angular platform binds the first file's jsdom document for good.
// "Uses the TestBed" means the spec names `TestBed`, or imports (relatively) a non-spec module under src
// that does, such as a src/testing helper wrapping TestBed.configureTestingModule. Deeper indirection is
// not followed: a helper that reaches TestBed through another helper names `TestBed` in a comment.
const SOURCE_ROOT = join(import.meta.dirname, 'src');
const TESTBED_PATTERN = /\bTestBed\b/;
const RELATIVE_IMPORT_PATTERN = /from\s+'(\.{1,2}\/[^']+)'/g;
const SPEC_SUFFIX = '.spec.ts';
const TYPESCRIPT_SUFFIX = '.ts';

function sourceFiles(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(TYPESCRIPT_SUFFIX))
    .map((path) => join(SOURCE_ROOT, path));
}

function usesTestBed(specPath: string, source: string, testBedHelpers: Set<string>): boolean {
  if (TESTBED_PATTERN.test(source)) return true;
  return [...source.matchAll(RELATIVE_IMPORT_PATTERN)].some(([, specifier]) =>
    testBedHelpers.has(resolve(dirname(specPath), specifier ?? '') + TYPESCRIPT_SUFFIX),
  );
}

function specsUsingTestBed(): string[] {
  const sources = new Map(sourceFiles().map((path) => [path, readFileSync(path, 'utf8')]));
  const testBedHelpers = new Set(
    [...sources]
      .filter(([path, source]) => !path.endsWith(SPEC_SUFFIX) && TESTBED_PATTERN.test(source))
      .map(([path]) => path),
  );
  return [...sources]
    .filter(([path, source]) => path.endsWith(SPEC_SUFFIX) && usesTestBed(path, source, testBedHelpers))
    .map(([path]) => path); // absolute: a `**` glob skips the dot directory .worktrees
}

export default defineConfig({
  test: {
    pool: 'threads',
    // Deprecated in vitest 3.2 for `test.projects`, which is no drop-in: the Angular builder builds its own
    // project and drops a configured `projects` list.
    poolMatchGlobs: specsUsingTestBed().map((specPath): [string, 'forks'] => [specPath, 'forks']),
    poolOptions: { threads: { isolate: false }, forks: { isolate: true } },
  },
});
