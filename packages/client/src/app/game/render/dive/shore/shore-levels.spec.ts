// The shore's levels near the camera (docs/rendering/opening-dive.md §4): a level bakes in steps, the camera's own and
// the next few the way it is going are kept with the anchor, the rest are let go and given back only once nothing
// draws with them, and until the level in view has baked the nearest coarser baked one stands in, never a finer one.

import { describe, expect, it } from 'vitest';
import { SHORE_LEVEL_CACHE, SHORE_LOD } from '../../constants/dive-shore';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { TEST_SHORE_LAND, TEST_SHORE_STAGE, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { SHORE_LEVEL_COUNT, shoreLevelZoom } from './shore-lod';
import { ShoreLevels } from './shore-levels';
import { bakeOnly, quickLevels, uploaderOf, type Uploaded } from '../../../../../testing/shore-levels-builder';
import type { ShoreView } from './shore-paint';
import { bakeShoreSnapshot, type ShoreSnapshot } from './shore-snapshot';
import { SHORE_BAKE_WAITING, type ShoreBakeStep } from './shore-pump';
import { DIVE_BAKE_BUDGET_MS } from '../../constants/dive';

function levels(): { subject: ShoreLevels<Uploaded>; uploads: Uploaded[] } {
  const uploads: Uploaded[] = [];
  return { subject: quickLevels(uploads), uploads };
}

/** A clock that ticks once a read: a pump of budget 2 takes one step. */
function counter(): () => number {
  let clock = 0;
  return () => (clock += 1);
}

function bakeEverything(subject: ShoreLevels<Uploaded>): void {
  for (let pass = 0; pass < 20 && subject.hasWork; pass += 1) subject.pump(Number.POSITIVE_INFINITY, () => 0);
}

describe('ShoreLevels', () => {
  it('drafts the camera’s level first, then the ones ahead, one behind and the anchor, then redraws each in full', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    expect(subject.hasWork).toBe(true);
    let clock = 0;
    while (uploads.length === 0) subject.pump(1, () => (clock += 0.25));
    expect(uploads[0]).toEqual({ zoom: shoreLevelZoom(10), isDraft: true, isReleased: false });
    bakeEverything(subject);
    const ahead = Array.from({ length: SHORE_LEVEL_CACHE.ahead }, (_unused, index) => 11 + index);
    const order = [10, ...ahead, 9, SHORE_LEVEL_CACHE.anchor].map(shoreLevelZoom);
    expect(uploads.map((uploaded) => [uploaded.zoom, uploaded.isDraft])).toEqual([
      ...order.map((zoom) => [zoom, true]),
      ...order.map((zoom) => [zoom, false]),
    ]);
    expect(subject.hasWork).toBe(false);
    expect(subject.isBakedAt(shoreLevelZoom(10))).toBe(true);
  });

  it('lets each draft go once its full redraw is up, and stands the draft in until then', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    for (let pass = 0; pass < 20 && uploads.length < 1; pass += 1) subject.pump(2, counter());
    expect(subject.levelsAt(shoreLevelZoom(10)).level).toBe(uploads[0]);
    bakeEverything(subject);
    const draft = uploads[0]!;
    expect(subject.levelsAt(shoreLevelZoom(10)).level!.isDraft).toBe(false);
    subject.releaseRetired();
    expect(draft.isReleased).toBe(true);
  });

  it('drops a full redraw under way for a level the camera needs and has nothing for', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    const clock = counter();
    // every draft in, and the first full redraw started
    while (uploads.length < SHORE_LEVEL_CACHE.ahead + 3) subject.pump(2, clock);
    subject.pump(2, clock);
    // one level on: 10, whose redraw is under way, is still kept, and the new one at the far end has nothing yet
    subject.focus(shoreLevelZoom(11), 1);
    while (uploads.length < SHORE_LEVEL_CACHE.ahead + 4) subject.pump(2, clock);
    expect(uploads.at(-1)).toEqual({
      zoom: shoreLevelZoom(11 + SHORE_LEVEL_CACHE.ahead),
      isDraft: true,
      isReleased: false,
    });
  });

  it('answers the level in view and the next one, with no stand-in once both have baked', () => {
    const { subject } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    const pair = subject.levelsAt(shoreLevelZoom(10) - 0.05);
    expect(pair.isExact).toBe(true);
    expect(pair.level!.zoom).toBe(shoreLevelZoom(10));
    expect(pair.next!.zoom).toBe(shoreLevelZoom(11));
  });

  it('stands the nearest coarser level in, never the finer one, though both are as near', () => {
    const subject = quickLevels();
    bakeOnly(subject, [13, 15]);
    const pair = subject.levelsAt(shoreLevelZoom(14));
    expect(pair.isExact).toBe(false);
    expect(pair.level!.zoom).toBe(shoreLevelZoom(13));
    expect(subject.standInLevelAt(shoreLevelZoom(14))).toBe(13);
  });

  it('has no stand-in with only finer levels baked: a finer one would cover only the middle of the view', () => {
    const subject = quickLevels();
    bakeOnly(subject, [15]);
    expect(subject.levelsAt(shoreLevelZoom(14)).level).toBeNull();
    expect(subject.standInLevelAt(shoreLevelZoom(14))).toBeNull();
  });

  it('keeps the stand-in when the camera jumps past the cache window, until the level it jumped to lands', () => {
    const subject = quickLevels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    subject.focus(shoreLevelZoom(30), 1);
    // the finest baked level above 30 stays, and covers the view
    expect(subject.levelsAt(shoreLevelZoom(30)).level!.zoom).toBe(shoreLevelZoom(10 + SHORE_LEVEL_CACHE.ahead));
    bakeEverything(subject);
    subject.focus(shoreLevelZoom(30), 1);
    expect(subject.levelsAt(shoreLevelZoom(30)).isExact).toBe(true);
    expect(subject.isBakedAt(shoreLevelZoom(10 + SHORE_LEVEL_CACHE.ahead))).toBe(false);
  });

  it('lets the levels the camera left go, and gives them back only when asked, after the frame', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    subject.focus(shoreLevelZoom(25), 1);
    const kept = [shoreLevelZoom(SHORE_LEVEL_CACHE.anchor), shoreLevelZoom(10 + SHORE_LEVEL_CACHE.ahead)];
    // the kept levels' full redraws stay; everything else, their drafts too, goes
    const isLetGo = (uploaded: Uploaded): boolean => uploaded.isDraft || !kept.includes(uploaded.zoom);
    expect(uploads.filter(isLetGo).length).toBeGreaterThan(0);
    expect(uploads.every((uploaded) => !uploaded.isReleased)).toBe(true);
    subject.releaseRetired();
    expect(uploads.filter(isLetGo).every((uploaded) => uploaded.isReleased)).toBe(true);
    expect(uploads.filter((uploaded) => !isLetGo(uploaded)).every((uploaded) => !uploaded.isReleased)).toBe(true);
  });

  it('ends a pump at once while another thread bakes its level, and lands it when it is sent', () => {
    const factory = createFakeShoreCanvasFactory();
    const uploads: Uploaded[] = [];
    let isSent = false;
    let steps = 0;
    function* awaitingBake(view: ShoreView): Generator<ShoreBakeStep, ShoreSnapshot> {
      while (!isSent) {
        steps += 1;
        yield SHORE_BAKE_WAITING;
      }
      return { view } as unknown as ShoreSnapshot;
    }
    const subject = new ShoreLevels<Uploaded>(
      { land: TEST_SHORE_LAND, tiles: bakedTestTiles(factory), factory },
      uploaderOf(uploads),
      awaitingBake,
    );
    subject.setStage(TEST_SHORE_STAGE, 1);
    subject.focus(shoreLevelZoom(10), 1);
    // a millisecond a read: a pump that took 'waiting' for a step would spin through its whole budget
    expect(subject.pump(DIVE_BAKE_BUDGET_MS, counter())).toBe(false);
    expect(steps).toBe(1);
    isSent = true;
    expect(subject.pump(DIVE_BAKE_BUDGET_MS, counter())).toBe(true);
    expect(uploads[0]!.zoom).toBe(shoreLevelZoom(10));
  });

  it('drops a bake the camera has turned away from for the level it needs now', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    subject.pump(
      0.5,
      (() => {
        let clock = 0;
        return () => (clock += 0.25);
      })(),
    );
    subject.focus(shoreLevelZoom(30), 1);
    bakeEverything(subject);
    expect(uploads[0]!.zoom).toBe(shoreLevelZoom(30));
  });

  it('starts again when the stage changes size: the levels are baked for one', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    subject.setStage({ width: 600, height: 400 }, 1);
    subject.releaseRetired();
    expect(uploads.every((uploaded) => uploaded.isReleased)).toBe(true);
    expect(subject.isBakedAt(shoreLevelZoom(10))).toBe(false);
  });

  it('bakes the way the camera goes: back up the dive, the coarser levels ahead', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), -1);
    bakeEverything(subject);
    expect(uploads[1]!.zoom).toBe(shoreLevelZoom(9));
  });
});

describe('ShoreLevels.fallFloorZoom', () => {
  it('holds a fall above the band until the anchor has baked, then above the first level with no near stand-in', () => {
    const subject = quickLevels();
    const inOrbit = (): number => {
      subject.focus(7, 1);
      return subject.fallFloorZoom;
    };
    expect(inOrbit()).toBe(shoreLevelZoom(0));
    bakeOnly(subject, [0]);
    expect(inOrbit()).toBe(shoreLevelZoom(SHORE_LEVEL_CACHE.standInSteps + 1));
    bakeOnly(subject, [3]);
    expect(inOrbit()).toBe(shoreLevelZoom(3 + SHORE_LEVEL_CACHE.standInSteps + 1));
  });

  it('counts only the levels still ahead, and lets the fall go once every one has a stand-in', () => {
    const subject = quickLevels();
    bakeOnly(subject, [0, 40]);
    subject.focus(shoreLevelZoom(40), 1);
    expect(subject.fallFloorZoom).toBe(Number.NEGATIVE_INFINITY);
  });

  it('never holds a fall for the level past the cut, which serves only zooms the band never draws (ticket #804)', () => {
    const last = SHORE_LEVEL_COUNT - 1;
    expect([shoreLevelZoom(last) <= SHORE_LOD.cutZoom, shoreLevelZoom(last - 1) > SHORE_LOD.cutZoom]).toEqual([
      true,
      true,
    ]);
    /** The floor with the level `level` ahead three steps from its nearest baked level (the stand-in allows two). */
    const floorPast = (level: number): number => {
      const subject = quickLevels();
      bakeOnly(subject, [0, level - 1 - SHORE_LEVEL_CACHE.standInSteps]);
      subject.focus(shoreLevelZoom(level - 1) + SHORE_LOD.stepZoom / 2, 1);
      return subject.fallFloorZoom;
    };
    expect(floorPast(last)).toBe(Number.NEGATIVE_INFINITY);
    expect(floorPast(last - 1)).toBe(shoreLevelZoom(last - 1));
  });
});

describe('bakeShoreSnapshot', () => {
  it('yields between its steps and answers a level the size the view asks, with its sea data and ramp', () => {
    const factory = createFakeShoreCanvasFactory();
    const view = {
      zoom: 1.5,
      pixelsPerMetre: 37,
      screenPixelsPerMetre: 26,
      widthPx: 100,
      heightPx: 60,
      devicePixelRatio: 1,
      halfWidthM: 1.35,
      halfHeightM: 0.81,
      timeSeconds: 0,
    };
    const bake = bakeShoreSnapshot(view, { land: TEST_SHORE_LAND, tiles: bakedTestTiles(factory), factory });
    let steps = 0;
    let step = bake.next();
    while (step.done !== true) {
      steps += 1;
      step = bake.next();
    }
    expect(steps).toBeGreaterThan(3);
    const snapshot = step.value;
    expect([snapshot.colour.width, snapshot.colour.height]).toEqual([100, 60]);
    expect(snapshot.ramp.entries).toBeGreaterThan(0);
    expect(snapshot.sea.bytes.length).toBeGreaterThan(0);
  });
});
