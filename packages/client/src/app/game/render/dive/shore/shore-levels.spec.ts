// The shore's levels near the camera (docs/rendering/opening-dive.md §4): a level bakes in steps, the camera's own and
// the next few the way it is going are kept, the rest are let go and given back only once nothing draws with them, and
// until the level in view has baked the nearest baked one stands in.

import { describe, expect, it } from 'vitest';
import { SHORE_LEVEL_CACHE } from '../../constants/dive-shore';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { TEST_SHORE_LAND, TEST_SHORE_STAGE, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { shoreLevelZoom } from './shore-lod';
import { ShoreLevels, type ShoreLevelUploader } from './shore-levels';
import { bakeShoreSnapshot, type ShoreSnapshot } from './shore-snapshot';

interface Uploaded {
  readonly zoom: number;
  isReleased: boolean;
}

function levels(): { subject: ShoreLevels<Uploaded>; uploads: Uploaded[] } {
  const uploads: Uploaded[] = [];
  const uploader: ShoreLevelUploader<Uploaded> = {
    upload: (snapshot: ShoreSnapshot) => {
      const uploaded = { zoom: snapshot.view.zoom, isReleased: false };
      uploads.push(uploaded);
      return uploaded;
    },
    release: (uploaded) => {
      uploaded.isReleased = true;
    },
  };
  const factory = createFakeShoreCanvasFactory();
  const subject = new ShoreLevels({ land: TEST_SHORE_LAND, tiles: bakedTestTiles(factory), factory }, uploader);
  subject.setStage(TEST_SHORE_STAGE, 1);
  return { subject, uploads };
}

function bakeEverything(subject: ShoreLevels<Uploaded>): void {
  for (let pass = 0; pass < 20 && subject.hasWork; pass += 1) subject.pump(Number.POSITIVE_INFINITY, () => 0);
}

describe('ShoreLevels', () => {
  it('bakes the camera’s level first, then the ones ahead and one behind', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    expect(subject.hasWork).toBe(true);
    let clock = 0;
    while (uploads.length === 0) subject.pump(1, () => (clock += 0.25));
    expect(uploads[0]!.zoom).toBe(shoreLevelZoom(10));
    bakeEverything(subject);
    expect(uploads.map((uploaded) => uploaded.zoom)).toEqual(
      [10, 11, 12, 13, 9].slice(0, SHORE_LEVEL_CACHE.ahead + 2).map(shoreLevelZoom),
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

  it('stands the nearest baked level in, coarser first, while the one in view bakes', () => {
    const { subject } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    subject.focus(shoreLevelZoom(14), 1);
    const pair = subject.levelsAt(shoreLevelZoom(14));
    expect(pair.isExact).toBe(false);
    expect(pair.level!.zoom).toBe(shoreLevelZoom(13));
    expect(pair.next).toBeNull();
  });

  it('lets the levels the camera left go, and gives them back only when asked, after the frame', () => {
    const { subject, uploads } = levels();
    subject.focus(shoreLevelZoom(10), 1);
    bakeEverything(subject);
    subject.focus(shoreLevelZoom(25), 1);
    expect(uploads.every((uploaded) => !uploaded.isReleased)).toBe(true);
    subject.releaseRetired();
    expect(uploads.every((uploaded) => uploaded.isReleased)).toBe(true);
  });

  it('drops a bake the camera has left for the level it needs now', () => {
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
