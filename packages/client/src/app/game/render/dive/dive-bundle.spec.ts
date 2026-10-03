// @vitest-environment node
// The dive's upper bands load with the dive, never with the game (docs/rendering/opening-dive.md §4): the mockup's
// module, the planet's coastline bakes and `d3-geo` are lazy chunks of their own, and so are the shore band (`shore/`,
// ticket #801) and the kelp band (`kelp/`, ticket #802). A production build is not part of the gate, so this pins the
// fact on the sources, the way `development-route-bundle.spec.ts` pins the dev pages: no static import chain from
// `main.ts` reaches any of them or names `d3-geo`, and each is reached by a dynamic `import()` only.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_IMPORT, STATIC_IMPORT, importGraph, specifiers } from '../../../../testing/import-graph';
import { repoPath } from '../../../../testing/repo-document';

const CLIENT_SOURCE = repoPath('packages/client/src');
const MOCKUP_MODULE = join(CLIENT_SOURCE, 'app/game/render/dive/mockup/dive-mockup-bands.js');
const MACRO_BAND = join(CLIENT_SOURCE, 'app/game/render/dive/dive-macro-band.ts');
const MOCKUP_SPECIFIER = './mockup/dive-mockup-bands.js';
const PLANET_BAKES_MODULE = join(CLIENT_SOURCE, 'app/game/render/dive/planet/dive-planet-bakes.ts');
const PLANET_BAKES_SPECIFIER = './planet/dive-planet-bakes';
const D3_GEO = 'd3-geo';
const SHORE_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/shore/');
const SHORE_SPECIFIER = './shore/shore-module';
const KELP_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/kelp/');
const KELP_SPECIFIER = './kelp/kelp-module';

describe('the dive’s lazy chunk', () => {
  const graph = importGraph(join(CLIENT_SOURCE, 'main.ts'), { patterns: [STATIC_IMPORT] });

  it('keeps the mockup’s module and the planet’s bakes out of every static import chain from main.ts', () => {
    expect(graph.files.has(MACRO_BAND)).toBe(true);
    expect(graph.files.has(MOCKUP_MODULE)).toBe(false);
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

  it('reaches every module through a dynamic import, which the build splits into a chunk', () => {
    const source = readFileSync(MACRO_BAND, 'utf8');
    for (const specifier of [MOCKUP_SPECIFIER, PLANET_BAKES_SPECIFIER, SHORE_SPECIFIER, KELP_SPECIFIER]) {
      expect(specifiers(source, DYNAMIC_IMPORT)).toContain(specifier);
      expect(specifiers(source, STATIC_IMPORT)).not.toContain(specifier);
    }
  });
});
