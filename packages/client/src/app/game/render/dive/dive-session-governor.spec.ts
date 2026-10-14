// The dive session's resolution governor (docs/rendering/opening-dive.md §6, ticket #804), over the fake Pixi app and
// recording bands: slow frames step the dive's one canvas down and every band is told the ratio it renders at, smooth
// frames never touch it, the bands' bake slices are left out of the frames' gaps (ticket #814), nothing is judged off
// screen or under the evidence probe, and while the dive falls at DPR 2 the canvas renders at the mockup's 1.5 at
// most, sharp again on arrival. Each case steps a started dive through hundreds of frames, and the fall through all of
// its bands, so they take the dive's heavy timeout.

import type { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  startedDiveSession as started,
  tickUntilBuilt,
  type DiveSessionHarness,
} from '../../../../testing/dive-session-harness';
import { DIVE_HEAVY_TEST_TIMEOUT_MS } from '../../../../testing/dive-test-timeouts';
import type { FakePixiApp } from '../../../../testing/fake-pixi-app';
import {
  DIVE_MOVING_DEVICE_PIXEL_RATIO,
  DIVE_PLAY_HOLD_MS,
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
/** Frames drawn after a fall's last frame: the stop latched, then a whole governor window at the restored ratio, so it is shown to last. */
const FRAMES_PAST_ARRIVAL = FRAMES_TO_JUDGE;

type Started = DiveSessionHarness & { app: FakePixiApp };

/** The ratio the dive's canvas renders at now: the last one it was set to, or the dive's own. */
function resolutionOf(parts: Started): number {
  return parts.app.resolutions.at(-1) ?? parts.dependencies.devicePixelRatio;
}

/** `count` frames on the session's clock, `gapMs` apart, or as far apart as the resolution makes them. */
function frames(parts: Started, count: number, gapMs: number | ((resolution: number) => number)): void {
  for (let frame = 0; frame < count; frame += 1) {
    parts.clock.advanceMilliseconds(typeof gapMs === 'number' ? gapMs : gapMs(resolutionOf(parts)));
    parts.app.tick();
  }
}

/** Software GL's frames: their cost goes with the canvas's pixels. */
const softwareFrame = (resolution: number): number => SOFTWARE_FRAME_MS * resolution * resolution;

/** A started dive, its renderer built, scrubbed into the drop (the reader's, so no autoplay). */
async function inTheDrop(devicePixelRatio = 1): Promise<Started> {
  const parts = await started({ devicePixelRatio });
  tickUntilBuilt(parts.app, parts.subject);
  parts.subject.controls.cancelAutoplay();
  parts.subject.controls.scrub(DROP_ZOOM);
  return parts;
}

describe('DiveSession resolution governor', { timeout: DIVE_HEAVY_TEST_TIMEOUT_MS }, () => {
  it('steps the dive’s canvas down under software GL’s frames, and tells every band the ratio it renders at', async () => {
    const parts = await inTheDrop();
    frames(parts, FRAMES_TO_JUDGE, softwareFrame);
    expect(parts.app.resolutions).toEqual([DIVE_RESOLUTION_GOVERNOR.floorResolution]);
    frames(parts, 1, softwareFrame);
    const lastView = parts.views.at(-1)!;
    expect(lastView.deviceRatio).toBe(DIVE_RESOLUTION_GOVERNOR.floorResolution);
    // The bands draw from the same view: the kelp and slime shaders' device px are the canvas's.
    expect(parts.slime.bands[0]!.draws.at(-1)!.deviceRatio).toBe(DIVE_RESOLUTION_GOVERNOR.floorResolution);
    parts.subject.destroy();
  });

  it('gives the resolution back when fewer pixels do not quicken the frames (a slow CPU, not the GPU)', async () => {
    const parts = await inTheDrop();
    const slowCpuFrameMs = DIVE_TARGET_FRAME_MS * 2;
    // Over budget throughout for long enough to step, then a window more to see the step did not help.
    frames(
      parts,
      FRAMES_TO_JUDGE * 2 + Math.ceil(DIVE_RESOLUTION_GOVERNOR.sustainedMs / slowCpuFrameMs),
      slowCpuFrameMs,
    );
    const [stepped, restored] = parts.app.resolutions;
    expect(stepped).toBeLessThan(1);
    expect(restored).toBe(1);
    expect(parts.views.at(-1)!.deviceRatio).toBe(1);
    parts.subject.destroy();
  });

  it('counts a frame held up in its submit as the GPU’s (its queue full), not the page’s, and steps down', async () => {
    const parts = await inTheDrop();
    // Software GL at DPR 2: the page blocks inside the submit until the GPU process has room.
    (parts.app.app as { render: () => void }).render = () => parts.clock.advanceMilliseconds(SOFTWARE_FRAME_MS);
    frames(parts, FRAMES_TO_JUDGE, 0);
    expect(parts.app.resolutions).toEqual([DIVE_RESOLUTION_GOVERNOR.floorResolution]);
    parts.subject.destroy();
  });

  it('never touches the resolution while frames are smooth', async () => {
    const parts = await inTheDrop();
    frames(parts, 600, DIVE_TARGET_FRAME_MS);
    expect(parts.app.resolutions).toEqual([]);
    expect(parts.views.at(-1)!.deviceRatio).toBe(1);
    parts.subject.destroy();
  });

  it('judges frames while a band still bakes, its slices left out of their gaps (ticket #814)', async () => {
    const parts = await inTheDrop();
    parts.shore.bands[0]!.isReady = false;
    // A slice on the bands' scheduler between each two smooth frames, as long as software GL's frame: on budget.
    const bakes = parts.shore.bands[0]!.bakes.scheduler!;
    const slices = parts.dependencies.scheduler as ManualScheduler;
    for (let frame = 0; frame < FRAMES_TO_JUDGE * 4; frame += 1) {
      bakes.after(0, () => parts.clock.advanceMilliseconds(SOFTWARE_FRAME_MS));
      slices.advanceMilliseconds(0);
      frames(parts, 1, DIVE_TARGET_FRAME_MS);
    }
    expect(parts.app.resolutions).toEqual([]);
    // Software GL's own frames while the band still bakes: the canvas steps down, before the bakes land.
    frames(parts, FRAMES_TO_JUDGE, softwareFrame);
    expect(parts.app.resolutions).toEqual([DIVE_RESOLUTION_GOVERNOR.floorResolution]);
    parts.subject.destroy();
  });

  it('judges no frame while the GPU is on the bands’ warm-up: a one-off that no resolution shortens', async () => {
    const parts = await started();
    parts.app.gpu.isCaughtUp = false;
    tickUntilBuilt(parts.app, parts.subject);
    parts.subject.controls.cancelAutoplay();
    parts.subject.controls.scrub(DROP_ZOOM);
    frames(parts, FRAMES_TO_JUDGE * 4, SOFTWARE_FRAME_MS);
    expect(parts.app.resolutions).toEqual([]);
    parts.app.gpu.isCaughtUp = true;
    frames(parts, FRAMES_TO_JUDGE, softwareFrame);
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
    // A probe under software GL: each of its frames waits on the GPU in its submit.
    (parts.app.app as { render: () => void }).render = () => parts.clock.advanceMilliseconds(SOFTWARE_FRAME_MS);
    parts.subject.probeFrames(DROP_ZOOM, FRAMES_TO_JUDGE * 2);
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
    // The hold and the fall, frame by frame (each draws every band the fall passes), and no more.
    const fallFrames = Math.ceil((DIVE_PLAY_HOLD_MS + diveFallMs(stop)) / DIVE_TARGET_FRAME_MS);
    frames(parts, fallFrames + FRAMES_PAST_ARRIVAL, DIVE_TARGET_FRAME_MS);
    expect(parts.subject.controls.stopReached).toBe(stop);
    expect(parts.app.resolutions).toEqual([DIVE_MOVING_DEVICE_PIXEL_RATIO, 2]);
    expect(parts.views.at(-1)!.deviceRatio).toBe(2);
    parts.subject.destroy();
  });
});
