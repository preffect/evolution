// The shore's bake worker (docs/rendering/opening-dive.md §4, ticket #809): it bakes the tiles the page lacks and
// sends each once, then the level asked for last, a step a turn, and sends it with its pictures and buffers
// transferred; a level asked for while another bakes replaces it; and it says once when it cannot bake.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeBitmap,
  createFakeShoreBakeScope,
  fakeBitmap,
  isClosed,
  type FakeShoreBakeScope,
} from '../../../../../testing/fake-shore-bake';
import { QUICK_TILE_BAKES, TEST_SHORE_LAND, TEST_SHORE_STAGE } from '../../../../../testing/shore-paint-builder';
import { SHORE_BAKE_MESSAGE, type ShoreBakeReport, type ShoreLevelBaked } from './shore-bake-messages';
import { ShoreBakeWorkerCore } from './shore-bake-worker-core';
import { shoreLevelView } from './shore-lod';
import { SHORE_TILE_NAMES } from './shore-tiles';

const FAR_LEVEL = 0;

function worker(): { core: ShoreBakeWorkerCore; scope: FakeShoreBakeScope } {
  const scope = createFakeShoreBakeScope();
  return { core: new ShoreBakeWorkerCore(scope, QUICK_TILE_BAKES), scope };
}

function bake(id: number, level = FAR_LEVEL) {
  return { type: SHORE_BAKE_MESSAGE.bake, id, view: shoreLevelView(level, TEST_SHORE_STAGE, 1, 1) } as const;
}

function reportsOf<Type extends ShoreBakeReport['type']>(scope: FakeShoreBakeScope, type: Type) {
  return scope.reports.filter((report) => report.message.type === type);
}

/** Lets the tiles' bitmap copies resolve and post. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ShoreBakeWorkerCore', () => {
  beforeEach(() => vi.stubGlobal('ImageBitmap', FakeBitmap));
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing before it is opened, then bakes every tile and sends each once, its bitmap transferred', async () => {
    const { core, scope } = worker();
    core.handle(bake(1));
    expect(scope.runTurns()).toBe(0);
    core.handle({ type: SHORE_BAKE_MESSAGE.open, land: TEST_SHORE_LAND, tiles: [] });
    scope.runTurns();
    await settle();
    const tiles = reportsOf(scope, SHORE_BAKE_MESSAGE.tile);
    expect(tiles.map((report) => (report.message as { name: string }).name).sort()).toEqual(
      [...SHORE_TILE_NAMES].sort(),
    );
    for (const report of tiles) expect(report.transfer).toEqual([(report.message as { bitmap: ImageBitmap }).bitmap]);
  });

  it('adopts the tiles the page sent, closing their bitmaps, and sends only the rest', async () => {
    const { core, scope } = worker();
    const [first, second] = SHORE_TILE_NAMES;
    const sent = [first!, second!].map((name) => ({ name, bitmap: fakeBitmap(), averageRgba: [0, 0, 0, 1] as const }));
    core.handle({ type: SHORE_BAKE_MESSAGE.open, land: TEST_SHORE_LAND, tiles: sent });
    scope.runTurns();
    await settle();
    expect(sent.every((tile) => isClosed(tile.bitmap))).toBe(true);
    const names = reportsOf(scope, SHORE_BAKE_MESSAGE.tile).map((report) => (report.message as { name: string }).name);
    expect(names).toHaveLength(SHORE_TILE_NAMES.length - sent.length);
    expect(names).not.toContain(first);
  });

  it('bakes the level asked for after the tiles, and sends it with its pictures and buffers transferred', () => {
    const { core, scope } = worker();
    core.handle({ type: SHORE_BAKE_MESSAGE.open, land: TEST_SHORE_LAND, tiles: [] });
    core.handle(bake(7));
    expect(scope.runTurns()).toBeGreaterThan(SHORE_TILE_NAMES.length);
    const [level] = reportsOf(scope, SHORE_BAKE_MESSAGE.level);
    const message = level!.message as ShoreLevelBaked;
    expect(message.id).toBe(7);
    expect(message.snapshot.colour.image).toBeInstanceOf(FakeBitmap);
    expect(level!.transfer).toContain(message.snapshot.colour.image);
    expect(level!.transfer).toContain(message.snapshot.sea.bytes.buffer);
    expect(level!.transfer).toContain(message.snapshot.ramp.bytes.buffer);
  });

  it('drops a level under way for one asked for after it, and sends only the newer one', () => {
    const { core, scope } = worker();
    core.handle({ type: SHORE_BAKE_MESSAGE.open, land: TEST_SHORE_LAND, tiles: [] });
    scope.runTurns(SHORE_TILE_NAMES.length * 2);
    core.handle(bake(1));
    scope.runTurns(2);
    core.handle(bake(2, FAR_LEVEL + 1));
    scope.runTurns();
    const levels = reportsOf(scope, SHORE_BAKE_MESSAGE.level).map((report) => report.message as ShoreLevelBaked);
    expect(levels.map((level) => level.id)).toEqual([2]);
    expect(levels[0]!.snapshot.view.zoom).toBe(shoreLevelView(FAR_LEVEL + 1, TEST_SHORE_STAGE, 1, 1).zoom);
  });

  it('says once that it cannot bake when a bake throws, and stops', () => {
    const scope = createFakeShoreBakeScope();
    const throwing = Object.fromEntries(
      SHORE_TILE_NAMES.map((name) => [
        name,
        function* () {
          yield;
          throw new Error('no 2D context');
        },
      ]),
    ) as unknown as typeof QUICK_TILE_BAKES;
    const core = new ShoreBakeWorkerCore(scope, throwing);
    core.handle({ type: SHORE_BAKE_MESSAGE.open, land: TEST_SHORE_LAND, tiles: [] });
    core.handle(bake(1));
    scope.runTurns();
    expect(scope.reports.map((report) => report.message.type)).toEqual([SHORE_BAKE_MESSAGE.failed]);
  });
});
