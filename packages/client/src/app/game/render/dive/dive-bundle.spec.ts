// @vitest-environment node
// The dive's upper bands load with the dive, never with the game (docs/rendering/opening-dive.md §4): the mockup's
// module and `d3-geo` are a lazy chunk of their own, and so is the shore band (`shore/`, ticket #801). A production build is not part of the gate, so this pins the
// fact on the sources, the way `development-route-bundle.spec.ts` pins the dev pages: no static import chain from
// `main.ts` reaches the module or names `d3-geo`, and the module is reached by a dynamic `import()` only.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DYNAMIC_IMPORT, STATIC_IMPORT, importGraph, specifiers } from '../../../../testing/import-graph';
import { repoPath } from '../../../../testing/repo-document';

const CLIENT_SOURCE = repoPath('packages/client/src');
const MOCKUP_MODULE = join(CLIENT_SOURCE, 'app/game/render/dive/mockup/dive-mockup-bands.js');
const MACRO_BAND = join(CLIENT_SOURCE, 'app/game/render/dive/dive-macro-band.ts');
const MOCKUP_SPECIFIER = './mockup/dive-mockup-bands.js';
const D3_GEO = 'd3-geo';
const SHORE_DIRECTORY = join(CLIENT_SOURCE, 'app/game/render/dive/shore/');
const SHORE_SPECIFIER = './shore/shore-module';

describe('the dive’s lazy chunk', () => {
  const graph = importGraph(join(CLIENT_SOURCE, 'main.ts'), { patterns: [STATIC_IMPORT] });

  it('keeps the mockup’s module out of every static import chain from main.ts', () => {
    expect(graph.files.has(MACRO_BAND)).toBe(true);
    expect(graph.files.has(MOCKUP_MODULE)).toBe(false);
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

  it('reaches the modules through dynamic imports, which the build splits into chunks', () => {
    const source = readFileSync(MACRO_BAND, 'utf8');
    expect(specifiers(source, DYNAMIC_IMPORT)).toContain(MOCKUP_SPECIFIER);
    expect(specifiers(source, STATIC_IMPORT)).not.toContain(MOCKUP_SPECIFIER);
    expect(specifiers(source, DYNAMIC_IMPORT)).toContain(SHORE_SPECIFIER);
    expect(specifiers(source, STATIC_IMPORT)).not.toContain(SHORE_SPECIFIER);
  });
});
