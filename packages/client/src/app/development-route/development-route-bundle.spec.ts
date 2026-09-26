// @vitest-environment node
// The production bundle carries no dev-only page (#423). The gate never runs a production build (a heavy phase on a
// four-core box), so this pins the two facts that keep the pages out of it, on the sources alone:
// 1. no file of a page's own territory is reachable from `main.ts` through a static import (esbuild only bundles
//    what an import chain reaches), except the named files production shares with it: its small gate and, for the
//    bench, the frame instrumentation the game's own loop wraps around every frame;
// 2. the loader's dynamic imports of the pages all sit inside its `ngDevMode` block, which the production build
//    defines away, so not even a lazy chunk is emitted.
// A new file in a territory is covered without touching this spec; sharing one more with production is a decision
// that has to be written down here.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DYNAMIC_IMPORT, STATIC_IMPORT, importGraph, resolveSource, specifiers } from '../../testing/import-graph';
import { repoPath } from '../../testing/repo-document';

const CLIENT_SOURCE = 'packages/client/src';
const ENTRY = 'main.ts';
const LOADER = 'app/development-route/development-route-loader.ts';
const DEV_MODE_GUARD = "if (typeof ngDevMode === 'undefined' || ngDevMode) {";
const BLOCK_OPEN = '{';
const BLOCK_CLOSE = '}';

interface PageTerritory {
  /** Path prefixes under `src/` of everything the page owns. */
  readonly ownedPrefixes: readonly string[];
  /** Owned files production may import: the gate the shell reads, and whatever the game itself also runs. */
  readonly sharedWithProduction: readonly string[];
}

const BENCH = 'app/game/render/bench/';
const PAGE_TERRITORIES: Readonly<Record<string, PageTerritory>> = {
  bench: {
    ownedPrefixes: [BENCH],
    sharedWithProduction: [
      `${BENCH}bench-route.ts`,
      // The frame instrumentation both sessions wrap around a frame (rendering/files-and-tests.md).
      `${BENCH}frame-instrumentation.ts`,
      `${BENCH}render-stage-timer.ts`,
      `${BENCH}timer-resolution.ts`,
      `${BENCH}draw-call-counter.ts`,
      `${BENCH}gpu-timer.ts`,
      `${BENCH}render-benchmark.ts`,
    ],
  },
  preview: {
    ownedPrefixes: ['app/game/encyclopedia/preview-route', 'app/game/encyclopedia/preview-report-log'],
    sharedWithProduction: ['app/game/encyclopedia/preview-route-gate.ts'],
  },
  uiKitStates: {
    ownedPrefixes: ['app/ui-kit/kit-states/'],
    sharedWithProduction: ['app/ui-kit/kit-states/kit-states-route.ts'],
  },
  cardSheet: {
    ownedPrefixes: ['app/game/hud/card-sheet/'],
    sharedWithProduction: [
      'app/game/hud/card-sheet/card-sheet-route.ts',
      'app/game/hud/card-sheet/card-sheet-query.ts',
    ],
  },
};

/** Every source file a static import chain from `entry` reaches. */
function staticallyReachable(entry: string): ReadonlySet<string> {
  return importGraph(entry, { patterns: [STATIC_IMPORT] }).files;
}

/** The offset just past the brace that closes the block opened at `openBrace`. */
function blockEnd(source: string, openBrace: number): number {
  let depth = 0;
  for (let offset = openBrace; offset < source.length; offset += 1) {
    if (source[offset] === BLOCK_OPEN) depth += 1;
    if (source[offset] === BLOCK_CLOSE) depth -= 1;
    if (depth === 0) return offset + 1;
  }
  throw new Error(`the block at ${openBrace} never closes`);
}

function ownerOf(relativePath: string): string | null {
  const owner = Object.entries(PAGE_TERRITORIES).find(([, territory]) =>
    territory.ownedPrefixes.some((prefix) => relativePath.startsWith(prefix)),
  );
  return owner?.[0] ?? null;
}

describe('the production bundle and the dev-only pages (#423)', () => {
  const root = repoPath(CLIENT_SOURCE);
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

  it('reaches no page-only file from main.ts through a static import', () => {
    const reachable = staticallyReachable(join(root, ENTRY));
    expect(reachable.has(join(root, 'app/app.component.ts')), 'the walk follows the real graph').toBe(true);
    expect(reachable.has(loaderPath), 'the loader itself is in the bundle').toBe(true);
    const shared = new Set(Object.values(PAGE_TERRITORIES).flatMap((territory) => territory.sharedWithProduction));
    const leaked = [...reachable]
      .map((file) => relative(root, file))
      .filter((file) => ownerOf(file) !== null && !shared.has(file))
      .sort();
    expect(leaked).toEqual([]);
  });

  it('puts every page inside a territory, and names only files that exist as shared', () => {
    for (const page of pages) expect(ownerOf(relative(root, page)), relative(root, page)).not.toBeNull();
    for (const territory of Object.values(PAGE_TERRITORIES)) {
      for (const file of territory.sharedWithProduction) expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('imports every page inside the ngDevMode block the production build removes', () => {
    const guardStart = loaderSource.indexOf(DEV_MODE_GUARD);
    expect(guardStart).toBeGreaterThan(-1);
    const guardEnd = blockEnd(loaderSource, guardStart + DEV_MODE_GUARD.length - BLOCK_OPEN.length);
    const importOffsets = [...loaderSource.matchAll(DYNAMIC_IMPORT)].map((match) => match.index);
    expect(importOffsets).toHaveLength(pages.length);
    for (const offset of importOffsets) {
      expect(offset > guardStart && offset < guardEnd, `the import at offset ${offset} is guarded`).toBe(true);
    }
  });
});
