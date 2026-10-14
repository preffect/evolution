// The shore's levels at rest below the band (docs/rendering/opening-dive.md §4, ticket #814): nothing more is wanted,
// the bake under way is ended so a worker cancels it, and the levels baked stay for the camera's way back up.

import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_BUDGET_MS } from '../../constants/dive';
import { awaitingLevels, quickLevels, type Uploaded } from '../../../../../testing/shore-levels-builder';
import { shoreLevelZoom } from './shore-lod';

const LEVEL_IN_VIEW = 10;

describe('ShoreLevels.rest', () => {
  it('wants nothing more and keeps the levels baked for the way back up', () => {
    const uploads: Uploaded[] = [];
    const subject = quickLevels(uploads);
    subject.focus(shoreLevelZoom(LEVEL_IN_VIEW), 1);
    for (let pass = 0; pass < 20 && subject.hasWork; pass += 1) subject.pump(Number.POSITIVE_INFINITY, () => 0);
    subject.releaseRetired();
    const kept = uploads.filter((uploaded) => !uploaded.isReleased);
    subject.rest();
    expect(subject.hasWork).toBe(false);
    subject.releaseRetired();
    expect(kept.every((uploaded) => !uploaded.isReleased)).toBe(true);
    expect(subject.isBakedAt(shoreLevelZoom(LEVEL_IN_VIEW))).toBe(true);
  });

  it('ends the bake under way, so a worker cancels it, and bakes again once the camera is back', () => {
    const ended: number[] = [];
    const subject = awaitingLevels(ended);
    subject.focus(shoreLevelZoom(LEVEL_IN_VIEW), 1);
    let clock = 0;
    subject.pump(DIVE_BAKE_BUDGET_MS, () => (clock += 1));
    subject.rest();
    expect(ended).toEqual([shoreLevelZoom(LEVEL_IN_VIEW)]);
    expect(subject.hasWork).toBe(false);
    subject.focus(shoreLevelZoom(LEVEL_IN_VIEW), 1);
    expect(subject.hasWork).toBe(true);
  });
});
