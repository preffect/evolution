// @vitest-environment node
// The dive's upper bands load with the dive, never with the game (docs/rendering/opening-dive.md §4): the planet's
// coastline bakes and `d3-geo` are lazy chunks of their own, and so are the shore band (`shore/`, ticket #801), the kelp
// band (`kelp/`, ticket #802) and the slime band (`slime/`, ticket #803). A production build is not part of the gate, so this pins the
// fact on the sources, the way `development-route-bundle.spec.ts` pins the dev pages: no static import chain from
// `main.ts` reaches any of them or names `d3-geo`, and each is reached by a dynamic `import()` only. The shore's bake
// worker (ticket #809) is a file of that chunk too, started in the one form the builder bundles as a worker, and
// draws without Pixi or Angular.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_IMPORT, STATIC_IMPORT, importGraph, specifiers } from '../../../../testing/import-graph';
import { repoPath } from '../../../../testing/repo-document';

const CLIENT_SOURCE = repoPath('packages/client/src');
const BAND_LOADER = join(CLIENT_SOURCE, 'app/game/render/dive/dive-band-loader.ts');
const PLANET_BAKES_MODULE = join(CLIENT_SOURCE, 'app/game/render/dive/planet/dive-planet-bakes.ts');
const PLANET_BAKES_SPECIFIER = './planet/dive-planet-bakes';
const D3_GEO = 'd3-geo';
const SHORE_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/shore/');
const SHORE_SPECIFIER = './shore/shore-module';
const KELP_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/kelp/');
const KELP_SPECIFIER = './kelp/kelp-module';
const SLIME_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/slime/');
const SLIME_SPECIFIER = './slime/slime-module';
const SHORE_BAKE_THREAD = join(SHORE_DIRECTORY, 'shore-bake-thread.ts');
const SHORE_BAKE_WORKER = join(SHORE_DIRECTORY, 'shore-bake.worker.ts');
/** The form the Angular builder bundles into a worker file of its own (`new Worker(new URL(…, import.meta.url))`). */
const BUNDLED_WORKER = /new Worker\(new URL\('\.\/shore-bake\.worker', import\.meta\.url\), \{ type: 'module' \}\)/;
const PACKAGES_NOT_IN_THE_WORKER = ['pixi.js', '@angular/core'];

describe('the dive’s lazy chunk', () => {
  const graph = importGraph(join(CLIENT_SOURCE, 'main.ts'), { patterns: [STATIC_IMPORT] });

  it('keeps the planet’s bakes out of every static import chain from main.ts', () => {
    expect(graph.files.has(BAND_LOADER)).toBe(true);
    expect(graph.files.has(PLANET_BAKES_MODULE)).toBe(false);
  });

  it('keeps d3-geo out of them too', () => {
    expect(graph.packages.has(D3_GEO)).toBe(false);
  });

  it('keeps every file of the shore band out of them, and its shore constants with it', () => {
    const shoreFiles = [...graph.files].filter(
      (file) => file.startsWith(SHORE_DIRECTORY) || /constants\/dive-shore/.test(file),
    );
    expect(shoreFiles).toEqual([]);
  });

  it('keeps every file of the kelp band out of them, and its kelp constants with it', () => {
    const kelpFiles = [...graph.files].filter(
      (file) => file.startsWith(KELP_DIRECTORY) || /constants\/dive-kelp/.test(file),
    );
    expect(kelpFiles).toEqual([]);
  });

  it('keeps every file of the slime band out of them, and its slime constants with it', () => {
    const slimeFiles = [...graph.files].filter(
      (file) => file.startsWith(SLIME_DIRECTORY) || /constants\/dive-slime/.test(file),
    );
    expect(slimeFiles).toEqual([]);
  });

  it('reaches every module through a dynamic import, which the build splits into a chunk', () => {
    const source = readFileSync(BAND_LOADER, 'utf8');
    for (const specifier of [PLANET_BAKES_SPECIFIER, SHORE_SPECIFIER, KELP_SPECIFIER, SLIME_SPECIFIER]) {
      expect(specifiers(source, DYNAMIC_IMPORT)).toContain(specifier);
      expect(specifiers(source, STATIC_IMPORT)).not.toContain(specifier);
    }
  });

  it('starts the shore’s bake worker in the bundled form, from the shore’s chunk, and keeps Pixi and Angular out of it', () => {
    expect(readFileSync(SHORE_BAKE_THREAD, 'utf8')).toMatch(BUNDLED_WORKER);
    expect(graph.files.has(SHORE_BAKE_THREAD)).toBe(false);
    // nothing imports the worker statically: its top level would run on the page (`self.onmessage` is the window's)
    const shoreChunk = importGraph(join(SHORE_DIRECTORY, 'shore-module.ts'), { patterns: [STATIC_IMPORT] });
    expect(shoreChunk.files.has(SHORE_BAKE_THREAD)).toBe(true);
    expect(shoreChunk.files.has(SHORE_BAKE_WORKER)).toBe(false);
    const worker = importGraph(SHORE_BAKE_WORKER, { patterns: [STATIC_IMPORT] });
    expect(worker.files.has(join(SHORE_DIRECTORY, 'shore-snapshot.ts'))).toBe(true);
    for (const name of PACKAGES_NOT_IN_THE_WORKER) expect(worker.packages.has(name)).toBe(false);
  });
});
