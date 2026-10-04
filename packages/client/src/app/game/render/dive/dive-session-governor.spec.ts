// The dive session's resolution governor (docs/rendering/opening-dive.md §6, ticket #804), over the fake Pixi app and
// recording bands: slow frames step the dive's one canvas down and every band is told the ratio it renders at, smooth
// frames never touch it, nothing is judged while a band still bakes, off screen or under the evidence probe, and while
// the dive falls at DPR 2 the canvas renders at the mockup's 1.5 at most, sharp again on arrival.

import { describe, expect, it } from 'vitest';
import {
  startedDiveSession as started,
  tickUntilBuilt,
  type DiveSessionHarness,
} from '../../../../testing/dive-session-harness';
import type { FakePixiApp } from '../../../../testing/fake-pixi-app';
import {
  DIVE_MOVING_DEVICE_PIXEL_RATIO,
  DIVE_RESOLUTION_GOVERNOR,
  DIVE_TARGET_FRAME_MS,
  type DivePhaseStop,
} from '../constants';
import { DIVE_FIRST_PHASE, diveFallMs } from './dive-controls';

/** Software GL's lens: frames this far apart are far over budget, and the CPU did none of it. */
const SOFTWARE_FRAME_MS = 550;
/** A dive scrubbed into the drop, where the lens covers the stage. */
const DROP_ZOOM = -2.3;
const FRAMES_TO_JUDGE = DIVE_RESOLUTION_GOVERNOR.windowFrames + 2;

type Started = DiveSessionHarness & { app: FakePixiApp };

/** `count` frames `gapMs` apart on the session's clock. */
function frames(parts: Started, count: number, gapMs: number): void {
  for (let frame = 0; frame < count; frame += 1) {
    parts.clock.advanceMilliseconds(gapMs);
    parts.app.tick();
  }
}

/** A started dive, its renderer built, scrubbed into the drop (the reader's, so no autoplay). */
async function inTheDrop(devicePixelRatio = 1): Promise<Started> {
  const parts = await started({ devicePixelRatio });
  tickUntilBuilt(parts.app, parts.subject);
  parts.subject.controls.cancelAutoplay();
  parts.subject.controls.scrub(DROP_ZOOM);
  return parts;
}

describe('DiveSession resolution governor', () => {
  it('steps the dive’s canvas down under software GL’s frames, and tells every band the ratio it renders at', async () => {
    const parts = await inTheDrop();
    frames(parts, FRAMES_TO_JUDGE, SOFTWARE_FRAME_MS);
    expect(parts.app.resolutions).toEqual([DIVE_RESOLUTION_GOVERNOR.floorResolution]);
    frames(parts, 1, SOFTWARE_FRAME_MS);
    const lastView = parts.views.at(-1)!;
    expect(lastView.deviceRatio).toBe(DIVE_RESOLUTION_GOVERNOR.floorResolution);
    // The bands draw from the same view: the kelp and slime shaders' device px are the canvas's.
    expect(parts.slime.bands[0]!.draws.at(-1)!.deviceRatio).toBe(DIVE_RESOLUTION_GOVERNOR.floorResolution);
    parts.subject.destroy();
  });

  it('never touches the resolution while frames are smooth', async () => {
    const parts = await inTheDrop();
    frames(parts, 600, DIVE_TARGET_FRAME_MS);
    expect(parts.app.resolutions).toEqual([]);
    expect(parts.views.at(-1)!.deviceRatio).toBe(1);
    parts.subject.destroy();
  });

  it('judges no frame while a band still bakes: their slices slow the frames whatever the resolution', async () => {
    const parts = await inTheDrop();
    parts.shore.bands[0]!.isReady = false;
    frames(parts, FRAMES_TO_JUDGE * 4, SOFTWARE_FRAME_MS);
    expect(parts.app.resolutions).toEqual([]);
    parts.shore.bands[0]!.isReady = true;
    frames(parts, FRAMES_TO_JUDGE, SOFTWARE_FRAME_MS);
    expect(parts.app.resolutions).toEqual([DIVE_RESOLUTION_GOVERNOR.floorResolution]);
    parts.subject.destroy();
  });

  it('never counts the stage off screen as a slow frame', async () => {
    const parts = await inTheDrop();
    for (let visit = 0; visit < FRAMES_TO_JUDGE; visit += 1) {
      frames(parts, 2, DIVE_TARGET_FRAME_MS);
      parts.subject.setIsVisible(false);
      parts.clock.advanceMilliseconds(SOFTWARE_FRAME_MS);
      parts.subject.setIsVisible(true);
    }
    expect(parts.app.resolutions).toEqual([]);
    parts.subject.destroy();
  });

  it('never moves under the evidence probe, whose frames are drawn back to back', async () => {
    const parts = await inTheDrop();
    for (let probe = 0; probe < FRAMES_TO_JUDGE; probe += 1) {
      parts.subject.probeFrames(DROP_ZOOM, FRAMES_TO_JUDGE);
      parts.clock.advanceMilliseconds(SOFTWARE_FRAME_MS);
    }
    expect(parts.app.resolutions).toEqual([]);
    parts.subject.destroy();
  });

  it('renders a DPR 2 fall at the mockup’s 1.5 at most, and sharp at the screen’s ratio once it arrives', async () => {
    const parts = await inTheDrop(2);
    const stop: DivePhaseStop = DIVE_FIRST_PHASE;
    parts.subject.controls.playPhase(stop, parts.clock.nowMilliseconds(), false);
    frames(parts, 2, DIVE_TARGET_FRAME_MS);
    expect(parts.app.resolutions).toEqual([DIVE_MOVING_DEVICE_PIXEL_RATIO]);
    expect(parts.views.at(-1)!.deviceRatio).toBe(DIVE_MOVING_DEVICE_PIXEL_RATIO);
    frames(parts, Math.ceil((diveFallMs(stop) * 2) / DIVE_TARGET_FRAME_MS), DIVE_TARGET_FRAME_MS);
    expect(parts.subject.controls.stopReached).toBe(stop);
    expect(parts.app.resolutions).toEqual([DIVE_MOVING_DEVICE_PIXEL_RATIO, 2]);
    expect(parts.views.at(-1)!.deviceRatio).toBe(2);
    parts.subject.destroy();
  });
});
