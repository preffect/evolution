// A module's import graph read off the sources, for the specs that pin a fact about what a file reaches: the
// production bundle's reach from `main.ts` (#423) and a spec's reach into the DOM (#489). Node-only, for specs.
// It reads specifiers with a pattern, not a parser: an import sits at the start of its line, and a type-only
// import (`import type …`) loads nothing at run time, so it is not an edge.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Module specifiers a file imports for their values: `import … from`, bare `import '…'` and `export … from`. */
export const STATIC_IMPORT = /^(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?'([^']+)'/gm;
export const DYNAMIC_IMPORT = /import\(\s*'([^']+)'\s*\)/g;

const TYPESCRIPT_EXTENSION = '.ts';
const COMPILED_EXTENSION = '.js';
const JSON_EXTENSION = '.json';
const INDEX_FILE = 'index.ts';

export function specifiers(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

/**
 * A relative specifier as the source file it names (`./x`, `./x.js` compiled from `./x.ts`, `./dir` for its
 * `index.ts`, or a `.json` file); `null` for a package specifier.
 */
export function resolveSource(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  const withoutCompiledExtension = base.endsWith(COMPILED_EXTENSION) ? base.slice(0, -COMPILED_EXTENSION.length) : base;
  const candidates = [
    `${withoutCompiledExtension}${TYPESCRIPT_EXTENSION}`,
    join(base, INDEX_FILE),
    ...(base.endsWith(JSON_EXTENSION) ? [base] : []),
  ];
  const candidate = candidates.find((path) => existsSync(path));
  if (candidate === undefined) throw new Error(`${specifier} from ${fromFile} names no source file`);
  return candidate;
}

export interface ImportWalk {
  /** The patterns whose first group is a specifier the walk follows: `STATIC_IMPORT`, and `DYNAMIC_IMPORT` too. */
  readonly patterns: readonly RegExp[];
  /** Packages the walk enters, by the source file their specifier names (a workspace package's `src/index.ts`). */
  readonly packageEntries?: Readonly<Record<string, string>>;
  /** How a file's source is read; a walk from many entries passes a cached reader. */
  readonly readSource?: (file: string) => string;
}

export interface ImportGraph {
  /** Every source file the walk reached, the entry included. */
  readonly files: ReadonlySet<string>;
  /** The package specifiers it met and did not enter. */
  readonly packages: ReadonlySet<string>;
}

function readUtf8(file: string): string {
  return readFileSync(file, 'utf8');
}

/** Everything reachable from `entry` along the walk's imports. A `.json` file is reached but imports nothing. */
export function importGraph(entry: string, walk: ImportWalk): ImportGraph {
  const files = new Set<string>();
  const packages = new Set<string>();
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    if (!file.endsWith(TYPESCRIPT_EXTENSION)) continue;
    const source = (walk.readSource ?? readUtf8)(file);
    for (const specifier of walk.patterns.flatMap((pattern) => specifiers(source, pattern))) {
      const target = resolveSource(file, specifier) ?? walk.packageEntries?.[specifier] ?? null;
      if (target !== null) pending.push(target);
      else packages.add(specifier);
    }
  }
  return { files, packages };
}
