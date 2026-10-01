// @vitest-environment node
// The planet's render resolution (docs/rendering/opening-dive.md §4): the mockup's caps, and its guard on a slow GPU.

import { describe, expect, it } from 'vitest';
import { DIVE_PLANET_RESOLUTION_GUARD } from '../../constants';
import { DivePlanetResolution } from './dive-planet-resolution';

const { slowFrameMs, strikesToStep, step, floor, sampleWindowMs } = DIVE_PLANET_RESOLUTION_GUARD;

/** `count` frames `intervalMs` apart from `startMs`; answers the time of the last. */
function frames(resolution: DivePlanetResolution, count: number, intervalMs: number, startMs = 0): number {
  let nowMs = startMs;
  for (let frame = 0; frame < count; frame += 1) {
    nowMs += intervalMs;
    resolution.noteFrame(nowMs);
  }
  return nowMs;
}

describe('DivePlanetResolution', () => {
  it('draws the sphere at up to 1.5× and the forest under the shore at 1×, never past the upper bands’ ratio', () => {
    const resolution = new DivePlanetResolution();
    expect(resolution.ratioAt(7, 2)).toBe(1.5);
    expect(resolution.ratioAt(7, 1)).toBe(1);
    expect(resolution.ratioAt(4, 2)).toBe(1);
  });

  it('steps the quality down after a run of slow frames, and never below its floor', () => {
    const resolution = new DivePlanetResolution();
    // The first frame only starts the clock; each slow one after it is a strike, and the step comes past the last.
    frames(resolution, strikesToStep + 1, slowFrameMs + 1);
    expect(resolution.ratioAt(7, 1)).toBe(1);
    frames(resolution, 1, slowFrameMs + 1, (strikesToStep + 1) * (slowFrameMs + 1));
    expect(resolution.ratioAt(7, 1)).toBeCloseTo(step, 9);
    frames(resolution, 400, slowFrameMs + 1, 10000);
    expect(resolution.ratioAt(7, 1)).toBe(floor);
  });

  it('takes a strike off for a quick frame, and ignores a gap too long to be a frame (a pause, a hidden tab)', () => {
    const resolution = new DivePlanetResolution();
    let nowMs = frames(resolution, strikesToStep, slowFrameMs + 1);
    nowMs = frames(resolution, 1, slowFrameMs - 1, nowMs);
    nowMs = frames(resolution, 1, slowFrameMs + 1, nowMs);
    expect(resolution.ratioAt(7, 1)).toBe(1);
    frames(resolution, 5, sampleWindowMs, nowMs);
    expect(resolution.ratioAt(7, 1)).toBe(1);
  });
});
