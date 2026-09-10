// Architecture guard (docs/ENGINEERING.md §2.3, docs/CODE-STANDARDS.md §8): no wall clock and
// no Math.random in packages/shared outside the modules allowed to hold them. Lint (#69) will
// enforce the same ban across the game paths; this test keeps shared honest until then.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..');
const MINIMUM_FILES_SCANNED = 10;
const BANNED_PATTERNS = [/Math\.random/, /Date\.now/, /performance\.now/, /\bsetTimeout\(/, /\bsetInterval\(/];
const EXEMPT_DIRECTORIES = ['random', 'time'];
const TEST_FILE_PATTERN = /\.(test|spec)\.ts$/;
const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PATTERN = /\/\/.*$/gm;

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (path.endsWith('.ts') && !TEST_FILE_PATTERN.test(path)) {
      files.push(path);
    }
  }
  return files;
}

/** Comments may name the banned calls to explain the ban; only code counts. */
function readCodeWithoutComments(path: string): string {
  return readFileSync(path, 'utf8').replace(BLOCK_COMMENT_PATTERN, '').replace(LINE_COMMENT_PATTERN, '');
}

function isExempt(path: string): boolean {
  const topLevelDirectory = relative(SOURCE_ROOT, path).split(sep)[0] ?? '';
  return EXEMPT_DIRECTORIES.includes(topLevelDirectory);
}

describe('determinism guard', () => {
  const files = listSourceFiles(SOURCE_ROOT);

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(MINIMUM_FILES_SCANNED);
  });

  it('finds no wall clock or Math.random outside random/ and time/', () => {
    const offenders = files
      .filter((path) => !isExempt(path))
      .filter((path) => BANNED_PATTERNS.some((pattern) => pattern.test(readCodeWithoutComments(path))))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(offenders).toEqual([]);
  });

  it('finds no Math.random even inside random/', () => {
    const offenders = files
      .filter((path) => isExempt(path))
      .filter((path) => /Math\.random/.test(readCodeWithoutComments(path)))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(offenders).toEqual([]);
  });
});
