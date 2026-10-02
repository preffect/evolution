// The layers above the dish (docs/rendering/opening-dive.md §1, §4) with the shore band in them (ticket #801): its
// canvas right under the mockup's wherever that goes, its bake started with the others and counted in `isBaked`, the
// mockup drawn first so the shore knows whether the planet's forest shows, its time in its own column.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakePlanetSource, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp } from '../../../../testing/fake-pixi-app';
import { fakeShoreMaker } from '../../../../testing/fake-shore-band';
import { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperLayers } from './dive-upper-layers';
import { diveViewAt } from './dive-view';

function layers() {
  const host = document.createElement('div');
  const game = createFakePixiApp();
  host.append(game.canvas);
  const mockup = fakeDiveBands();
  const shore = fakeShoreMaker();
  const shorePixi = createFakePixiApp();
  const clock = new ManualClock(0);
  const frameTimes = new DiveFrameTimes(clock);
  const subject = new DiveUpperLayers({
    bands: fakeUpperBands(mockup, fakePlanetSource(), shore),
    host,
    stage: new Container(),
    clock,
    frameTimes,
    renderToTexture: (container, target) => game.renderToTexture(container, target),
    shorePixi,
    devicePixelRatio: 1,
  });
  return { subject, host, game, mockup, band: shore.bands[0]!, shorePixi, frameTimes };
}

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

const FRAME = { screenRatio: 1, nowMs: 0, isMotionReduced: false };

describe('DiveUpperLayers’ shore', () => {
  it('lies right under the mockup’s canvas, over the game’s while the planet shows and under it at the dish', () => {
    const { subject, host, game, mockup, shorePixi } = layers();
    expect([...host.children]).toEqual([shorePixi.canvas, mockup.canvas, game.canvas]);
    subject.draw(viewAt(2), FRAME);
    expect([...host.children]).toEqual([game.canvas, shorePixi.canvas, mockup.canvas]);
    subject.draw(viewAt(-4.3), FRAME);
    expect([...host.children]).toEqual([shorePixi.canvas, mockup.canvas, game.canvas]);
  });

  it('starts the shore baking, and is baked only once the shore is ready too', () => {
    const { subject, band } = layers();
    subject.bakeOn(new ManualScheduler(), () => undefined);
    expect(band.bakes.started).toBe(1);
    expect(subject.isBaked).toBe(true);
    band.isReady = false;
    expect(subject.isBaked).toBe(false);
  });

  it('draws the mockup even with only the shore active, then the shore told whether the forest showed', () => {
    const { subject, mockup, band, frameTimes } = layers();
    const view = viewAt(2.6);
    expect(view.bands.kelp.isActive).toBe(false);
    subject.draw(view, FRAME);
    frameTimes.endFrame();
    expect(mockup.frames).toHaveLength(1);
    expect(band.draws).toEqual([{ view, isForestShown: true }]);
    expect(frameTimes.take().frames).toBe(1);
  });

  it('resizes the shore with the stage and gives every part back on destroy', () => {
    const { subject, band, host, mockup } = layers();
    subject.resize({ width: 500, height: 300 });
    expect(band.sizes).toEqual([{ width: 500, height: 300 }]);
    subject.destroy();
    expect(band.lifecycle.isDestroyed).toBe(true);
    expect(mockup.releases.count).toBe(1);
    expect(host.contains(mockup.canvas)).toBe(false);
  });
});
