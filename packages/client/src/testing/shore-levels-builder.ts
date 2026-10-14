// The shore's levels for their specs (docs/rendering/opening-dive.md §4): levels whose bakes draw nothing, so a spec
// reads the rules of what is kept, baked and drawn, and a helper that bakes exactly the levels it names.

import type { ShoreLevelUploader } from '../app/game/render/dive/shore/shore-levels';
import { ShoreLevels } from '../app/game/render/dive/shore/shore-levels';
import { shoreLevelZoom } from '../app/game/render/dive/shore/shore-lod';
import type { ShoreView } from '../app/game/render/dive/shore/shore-paint';
import type { ShoreSnapshot } from '../app/game/render/dive/shore/shore-snapshot';
import { createFakeShoreCanvasFactory } from './fake-shore-canvas';
import { TEST_SHORE_LAND, TEST_SHORE_STAGE, bakedTestTiles } from './shore-paint-builder';

export interface Uploaded {
  readonly zoom: number;
  /** Baked at `SHORE_LEVEL_DRAFT_SCALE` of the stage's ratio, to be redrawn at full resolution. */
  readonly isDraft: boolean;
  isReleased: boolean;
}

/** A bake with no drawing: it lands the view it was asked for. */
export function* quickBake(view: ShoreView): Generator<void, ShoreSnapshot> {
  yield;
  return { view } as unknown as ShoreSnapshot;
}

export function uploaderOf(uploads: Uploaded[]): ShoreLevelUploader<Uploaded> {
  return {
    upload: (snapshot: ShoreSnapshot) => {
      const uploaded = { zoom: snapshot.view.zoom, isDraft: snapshot.view.devicePixelRatio < 1, isReleased: false };
      uploads.push(uploaded);
      return uploaded;
    },
    release: (uploaded) => {
      uploaded.isReleased = true;
    },
  };
}

/** Levels whose bakes draw nothing (`bakeShoreSnapshot` has its own spec below): the rules of what is kept and drawn. */
export function quickLevels(uploads: Uploaded[] = []): ShoreLevels<Uploaded> {
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
export function bakeOnly(subject: ShoreLevels<Uploaded>, wanted: readonly number[]): void {
  let clock = 0;
  for (const level of wanted) {
    subject.focus(shoreLevelZoom(level), -1);
    while (!subject.isBakedAt(shoreLevelZoom(level))) subject.pump(2, () => (clock += 1));
  }
}
