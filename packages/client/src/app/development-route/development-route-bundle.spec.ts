// @vitest-environment node
// The production bundle carries no dev-only page (#423). The gate never runs a production build (a heavy phase on a
// four-core box), so this pins the two facts that keep the pages out of it, on the sources alone:
// 1. no page is reachable from `main.ts` through a static import: esbuild only bundles what an import chain reaches;
// 2. the loader's dynamic imports of them all sit inside its `ngDevMode` branch, which the production build defines
//    away, so not even a lazy chunk is emitted.
// The pages are read from the loader's own dynamic imports, and pinned by name so the walk can never check nothing.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT_SOURCE = 'packages/client/src';
const ENTRY = 'main.ts';
const LOADER = 'app/development-route/development-route-loader.ts';
const DEV_MODE_GUARD = "if (typeof ngDevMode === 'undefined' || ngDevMode) {";
const OUTSIDE_THE_GUARD = 'return null;';

/** Module specifiers a file imports for their values: `import … from`, bare `import '…'` and `export … from`. */
const STATIC_IMPORT = /^(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?'([^']+)'/gm;
const DYNAMIC_IMPORT = /import\(\s*'([^']+)'\s*\)/g;

function clientSourceRoot(): string {
  let directory = process.cwd();
  while (!existsSync(join(directory, CLIENT_SOURCE))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`${CLIENT_SOURCE} not found above ${process.cwd()}`);
    directory = parent;
  }
  return join(directory, CLIENT_SOURCE);
}

/** A relative specifier as the source file it names; `null` for a package, which holds no page. */
function resolveSource(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidate = [`${base}.ts`, join(base, 'index.ts')].find((path) => existsSync(path));
  if (candidate === undefined) throw new Error(`${specifier} from ${fromFile} names no source file`);
  return candidate;
}

function specifiers(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

/** Every source file a static import chain from `entry` reaches. */
function staticallyReachable(entry: string): Set<string> {
  const reached = new Set<string>();
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (reached.has(file)) continue;
    reached.add(file);
    for (const specifier of specifiers(readFileSync(file, 'utf8'), STATIC_IMPORT)) {
      const target = resolveSource(file, specifier);
      if (target !== null) pending.push(target);
    }
  }
  return reached;
}

describe('the production bundle and the dev-only pages (#423)', () => {
  const root = clientSourceRoot();
  const loaderPath = join(root, LOADER);
  const loaderSource = readFileSync(loaderPath, 'utf8');
  const pages = specifiers(loaderSource, DYNAMIC_IMPORT)
    .map((specifier) => resolveSource(loaderPath, specifier))
    .filter((page): page is string => page !== null);

  it('reads every page from the loader', () => {
    expect(pages.map((page) => relative(root, page)).sort()).toEqual([
      'app/game/encyclopedia/preview-route.component.ts',
      'app/game/hud/card-sheet/card-sheet.component.ts',
      'app/game/render/bench/render-bench.component.ts',
      'app/ui-kit/kit-states/kit-states.component.ts',
    ]);
  });

  it('reaches no page from main.ts through a static import', () => {
    const reachable = staticallyReachable(join(root, ENTRY));
    expect(reachable.has(join(root, 'app/app.component.ts')), 'the walk follows the real graph').toBe(true);
    expect(reachable.has(loaderPath), 'the loader itself is in the bundle').toBe(true);
    const leaked = pages.filter((page) => reachable.has(page)).map((page) => relative(root, page));
    expect(leaked).toEqual([]);
  });

  it('imports every page inside the ngDevMode branch the production build removes', () => {
    const guardStart = loaderSource.indexOf(DEV_MODE_GUARD);
    const guardEnd = loaderSource.indexOf(OUTSIDE_THE_GUARD, guardStart);
    expect(guardStart).toBeGreaterThan(-1);
    const importOffsets = [...loaderSource.matchAll(DYNAMIC_IMPORT)].map((match) => match.index);
    expect(importOffsets).toHaveLength(pages.length);
    for (const offset of importOffsets) {
      expect(offset > guardStart && offset < guardEnd, `the import at offset ${offset} is guarded`).toBe(true);
    }
  });
});
