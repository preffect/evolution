// The bands above the dish on the stage (docs/rendering/opening-dive.md §1, §4): the mockup's two canvases with the
// shore's between them, each baking, the mockup drawn before the shore so the shore knows whether the planet's forest
// showed, each part's time in its own column.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp } from '../../../../testing/fake-pixi-app';
import { fakeShoreMaker } from '../../../../testing/fake-shore-band';
import { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperStage } from './dive-upper-stage';
import { diveViewAt } from './dive-view';

function stage() {
  const host = document.createElement('div');
  const game = document.createElement('canvas');
  host.append(game);
  const mockup = fakeDiveBands();
  const shore = fakeShoreMaker();
  const shorePixi = createFakePixiApp();
  host.append(shorePixi.canvas);
  const subject = new DiveUpperStage(fakeUpperBands(mockup, shore), shorePixi, {
    host,
    devicePixelRatio: 1,
    scheduler: new ManualScheduler(),
    nowMs: () => 0,
    onBaked: () => undefined,
  });
  return { subject, host, game, mockup, band: shore.bands[0]!, shorePixi };
}

describe('DiveUpperStage', () => {
  it('stacks the planet’s canvas, the shore’s, the kelp’s, then the game’s', () => {
    const { host, game, mockup, shorePixi } = stage();
    expect([...host.children]).toEqual([mockup.canvas, shorePixi.canvas, mockup.upperCanvas, game]);
  });

  it('starts the shore baking, and is baked only once both halves are', () => {
    const { subject, band } = stage();
    expect(band.bakes.started).toBe(1);
    expect(subject.isBaked).toBe(true);
    band.isReady = false;
    expect(subject.isBaked).toBe(false);
  });

  it('draws the mockup, then the shore told whether the forest showed, each in its own column', () => {
    const { subject, mockup, band } = stage();
    const view = diveViewAt({
      zoom: 2,
      viewport: { width: 830, height: 467 },
      timeSeconds: 0,
      isMoving: false,
      globeIdleSpinDegrees: 0,
    });
    const clock = new ManualClock(0);
    const times = new DiveFrameTimes(clock);
    subject.draw(view, times, false);
    times.endFrame();
    expect(mockup.frames).toHaveLength(1);
    expect(band.draws).toEqual([{ view, isForestShown: true }]);
    expect(times.take().frames).toBe(1);
  });

  it('resizes the shore with the stage and gives every part back on destroy', () => {
    const { subject, band, host, mockup } = stage();
    subject.resize({ width: 500, height: 300 });
    expect(band.sizes).toEqual([{ width: 500, height: 300 }]);
    subject.destroy();
    expect(band.lifecycle.isDestroyed).toBe(true);
    expect(mockup.releases.count).toBe(1);
    expect(host.contains(mockup.canvas)).toBe(false);
  });
});
