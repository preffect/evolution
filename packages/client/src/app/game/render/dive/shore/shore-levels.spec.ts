// The shore's levels near the camera (docs/rendering/opening-dive.md §4): a level bakes in steps, the camera's own and
// the next few the way it is going are kept with the anchor, the rest are let go and given back only once nothing
// draws with them, and until the level in view has baked the nearest coarser baked one stands in, never a finer one.

import { describe, expect, it } from 'vitest';
import { SHORE_LEVEL_CACHE } from '../../constants/dive-shore';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { TEST_SHORE_LAND, TEST_SHORE_STAGE, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { shoreLevelZoom } from './shore-lod';
import { ShoreLevels, type ShoreLevelUploader } from './shore-levels';
import type { ShoreView } from './shore-paint';
import { bakeShoreSnapshot, type ShoreSnapshot } from './shore-snapshot';

interface Uploaded {
  readonly zoom: number;
  isReleased: boolean;
}

function levels(): { subject: ShoreLevels<Uploaded>; uploads: Uploaded[] } {
  const uploads: Uploaded[] = [];
  return { subject: quickLevels(uploads), uploads };
}

function bakeEverything(subject: ShoreLevels<Uploaded>): void {
  for (let pass = 0; pass < 20 && subject.hasWork; pass += 1) subject.pump(Number.POSITIVE_INFINITY, () => 0);
}

/** A bake with no drawing: it lands the view it was asked for. */
function* quickBake(view: ShoreView): Generator<void, ShoreSnapshot> {
  yield;
  return { view } as unknown as ShoreSnapshot;
}

function uploaderOf(uploads: Uploaded[]): ShoreLevelUploader<Uploaded> {
  return {
    upload: (snapshot: ShoreSnapshot) => {
      const uploaded = { zoom: snapshot.view.zoom, isReleased: false };
      uploads.push(uploaded);
      return uploaded;
    },
    release: (uploaded) => {
      uploaded.isReleased = true;
    },
  };
}

/** Levels whose bakes draw nothing (`bakeShoreSnapshot` has its own spec below): the rules of what is kept and drawn. */
function quickLevels(uploads: Uploaded[] = []): ShoreLevels<Uploaded> {
  const factory = createFakeShoreCanvasFactory();
  const subject = new ShoreLevels<Uploaded>(
    { land: TEST_SHORE_LAND, tiles: bakedTestTiles(factory), factory },
    uploaderOf(uploads),
    quickBake,
  );
  subject.setStage(TEST_SHORE_STAGE, 1);
  return subject;
}

/** Bakes exactly `wanted`, one step a pump, each with the camera on it going up the dive, so the earlier stay kept. */
function bakeOnly(subject: ShoreLevels<Uploaded>, wanted: readonly number[]): void {
  let clock = 0;
  for (const level of wanted) {
    subject.focus(shoreLevelZoom(level), -1);
    while (!subject.isBakedAt(shoreLevelZoom(level))) subject.pump(2, () => (clock += 1));
  }
}

describe('ShoreLevels', () => {
  it('bakes the camera’s level first, then the ones ahead, one behind, and the anchor', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    expect(subject.hasWork).toBe(true);
    let clock = 0;
    while (uploads.length === 0) subject.pump(1, () => (clock += 0.25));
    expect(uploads[0]!.zoom).toBe(shoreLevelZoom(10));
    bakeEverything(subject);
    const ahead = Array.from({ length: SHORE_LEVEL_CACHE.ahead }, (_unused, index) => 11 + index);
    expect(uploads.map((uploaded) => uploaded.zoom)).toEqual(
      [10, ...ahead, 9, SHORE_LEVEL_CACHE.anchor].map(shoreLevelZoom),
    );
    expect(subject.hasWork).toBe(false);
    expect(subject.isBakedAt(shoreLevelZoom(10))).toBe(true);
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
    const isLetGo = (uploaded: Uploaded): boolean => !kept.includes(uploaded.zoom);
    expect(uploads.filter(isLetGo).length).toBeGreaterThan(0);
    expect(uploads.every((uploaded) => !uploaded.isReleased)).toBe(true);
    subject.releaseRetired();
    expect(uploads.filter(isLetGo).every((uploaded) => uploaded.isReleased)).toBe(true);
    expect(uploads.filter((uploaded) => !isLetGo(uploaded)).every((uploaded) => !uploaded.isReleased)).toBe(true);
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
