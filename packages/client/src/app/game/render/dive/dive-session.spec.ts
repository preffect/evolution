// The dive session (docs/rendering/opening-dive.md §1) over the fake Pixi app `render-session.spec.ts` uses and
// recording stand-ins for the upper bands, so no spec here touches WebGL, a 2D canvas or the coastlines.
//
// What is load-bearing, each observed on the thing itself (the planet's part is `dive-session-planet.spec.ts`): the
// game's dish is drawn only where the band table says (never in orbit, unclipped inside the dish, clipped to its wall
// while the slime shows), over the slime band on the same stage, and faded in as a group of its own over the slime
// (the canvas's opacity once nothing else shows); a still dive under reduced motion draws nothing new; the lobby plays
// phase 1 on its own once; and `destroy` gives every resource back.

import { AlphaFilter, type Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { type FakePixiApp } from '../../../../testing/fake-pixi-app';
import {
  diveSessionHarness as harness,
  startedDiveSession as started,
  tickUntilBuilt,
  type DiveSessionHarness,
} from '../../../../testing/dive-session-harness';
import { DIVE_AUTOPLAY_DELAY_MS, DIVE_CANVAS_TEST_ID, DIVE_PLAY_HOLD_MS, DIVE_ZOOM_TOP } from '../constants';
import { diveGlobeIdleSpin } from './dive-camera';
import { DIVE_FIRST_PHASE } from './dive-controls';

/** The game's canvas opacity: the dish band's weight. */
const opacityOf = (app: FakePixiApp): number => Number(app.canvas.style.opacity);

/** The dish's group alpha over the slime: its root's alpha filter's, or 1 with none. */
function dishFadeOf(gameRoot: Container): number {
  const [filter] = (gameRoot.filters as readonly unknown[] | null | undefined) ?? [];
  return filter instanceof AlphaFilter ? filter.alpha : 1;
}

describe('DiveSession.start', () => {
  it('lays the slime band at the bottom of the dive’s stage, under the renderer in a root of its own', async () => {
    const { subject, app, slime } = await started();
    expect(app.canvas.dataset['testid']).toBe(DIVE_CANVAS_TEST_ID);
    tickUntilBuilt(app, subject);
    expect(subject.isBuildingRenderer).toBe(false);
    const [slimeView, gameRoot] = app.stage.children;
    expect(slimeView).toBe(slime.bands[0]!.view);
    expect(gameRoot!.children.length).toBeGreaterThan(0);
    subject.destroy();
  });

  it('gives back an app that arrives after destroy, makes no band, and answers false', async () => {
    const { subject, apps, slime } = harness();
    const start = subject.start();
    subject.destroy();
    expect(await start).toBe(false);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    expect(slime.bands).toEqual([]);
  });
});

describe('DiveSession frames', () => {
  it('draws the dish clipped to its wall while the slime shows, and the slime under it', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-4.3);
    const band = slime.bands[0]!;
    const drawnBefore = band.draws.length;
    app.tick();
    const [slimeView, gameRoot, dishClip, planet] = app.stage.children;
    expect(slimeView).toBe(band.view);
    expect(opacityOf(app)).toBe(1);
    expect(gameRoot!.mask).toBe(dishClip);
    expect(gameRoot!.visible).toBe(true);
    expect(dishFadeOf(gameRoot!)).toBe(1);
    expect(planet!.visible).toBe(false);
    expect(band.draws.length).toBe(drawnBefore + 1);
    expect(band.draws.at(-1)!.bands.slime.isActive).toBe(true);
    expect(subject.lastRenderedTick).not.toBeNull();
    subject.destroy();
  });

  it('draws only the dish, unclipped, once the view lies inside it', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-5.5);
    app.tick();
    const [, gameRoot] = app.stage.children;
    expect(slime.bands[0]!.draws.at(-1)!.bands.slime.isActive).toBe(false);
    expect(gameRoot!.mask ?? null).toBeNull();
    expect(dishFadeOf(gameRoot!)).toBe(1);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('fades the dish in by the band table as the dark field arrives, as a group over the slime on one canvas', async () => {
    const { subject, app } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-3.96);
    app.tick();
    const [, gameRoot] = app.stage.children;
    expect(opacityOf(app)).toBe(1);
    expect(dishFadeOf(gameRoot!)).toBeCloseTo(0.5, 6);
    subject.controls.scrub(-4.5);
    app.tick();
    expect(dishFadeOf(gameRoot!)).toBe(1);
    expect(gameRoot!.filters ?? null).toBeNull();
    subject.destroy();
  });

  it('fades the dish by the canvas’s opacity when no upper band shows under it', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    const band = slime.bands[0]!;
    band.draw = (view) => {
      band.draws.push(view);
      return false;
    };
    subject.controls.scrub(-3.96);
    app.tick();
    const [, gameRoot] = app.stage.children;
    expect(opacityOf(app)).toBeCloseTo(0.5, 6);
    expect(dishFadeOf(gameRoot!)).toBe(1);
    subject.destroy();
  });
});

describe('DiveSession under reduced motion', () => {
  it('draws nothing new while the dive is still, and one frame for each change', async () => {
    const { subject, app, views, motion } = await started();
    motion.isReduced = true;
    app.tick();
    const [drawn, planetDraws] = [views.length, app.textureRenders.length];
    app.tick();
    app.tick();
    expect(views.length).toBe(drawn);
    expect(app.textureRenders.length).toBe(planetDraws);
    subject.controls.scrub(3);
    subject.requestFrame();
    app.tick();
    expect(views.length).toBe(drawn + 1);
    expect(views.at(-1)!.camera.zoom).toBe(3);
    subject.destroy();
  });

  it('holds the ambient time still', async () => {
    const { subject, app, clock, views, motion } = await started();
    motion.isReduced = true;
    app.tick();
    clock.advanceMilliseconds(5000);
    subject.requestFrame();
    app.tick();
    expect(views.at(-1)!.timeSeconds).toBe(views[0]!.timeSeconds);
    subject.destroy();
  });
});

describe('DiveSession autoplay', () => {
  it('plays phase 1’s opening once, a moment after the open', async () => {
    const { subject, app, clock } = await started();
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS);
    app.tick();
    expect(subject.controls.stopShown).toBe(DIVE_FIRST_PHASE);
    clock.advanceMilliseconds(DIVE_PLAY_HOLD_MS + 1000);
    app.tick();
    expect(subject.controls.zoom).toBeLessThan(DIVE_ZOOM_TOP);
    subject.destroy();
  });

  it('never plays on its own under reduced motion, or once the reader has taken the controls', async () => {
    for (const takeOver of [
      (parts: DiveSessionHarness) => (parts.motion.isReduced = true),
      (parts: DiveSessionHarness) => parts.subject.controls.cancelAutoplay(),
    ]) {
      const parts = await started();
      takeOver(parts);
      parts.clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 2);
      parts.app.tick();
      expect(parts.subject.controls.isPlaying).toBe(false);
      parts.subject.destroy();
    }
  });
});

describe('DiveSession in orbit (ticket #805)', () => {
  /** The planet's longitude at the view's centre in the last frame drawn: d3's rotation looks at its negation. */
  const centreLongitudeOf = (parts: DiveSessionHarness): number => -parts.views.at(-1)!.globeRotation[0];

  it('turns the planet on its own while the dive waits in orbit', async () => {
    const parts = await started();
    parts.subject.controls.cancelAutoplay();
    parts.app.tick();
    const before = centreLongitudeOf(parts);
    parts.clock.advanceMilliseconds(2000);
    parts.app.tick();
    expect(centreLongitudeOf(parts) - before).toBeCloseTo(diveGlobeIdleSpin(2000), 6);
    parts.subject.destroy();
  });

  it('holds the planet still under reduced motion, while paused, and once the dive is below the opening turn', async () => {
    const stillnesses: ((parts: DiveSessionHarness) => void)[] = [
      (parts) => (parts.motion.isReduced = true),
      (parts) => {
        parts.subject.controls.playPhase(DIVE_FIRST_PHASE, parts.clock.nowMilliseconds(), false);
        parts.subject.controls.togglePause(parts.clock.nowMilliseconds());
      },
      (parts) => parts.subject.controls.scrub(5),
    ];
    for (const holdStill of stillnesses) {
      const parts = await started();
      parts.subject.controls.cancelAutoplay();
      holdStill(parts);
      parts.app.tick();
      const before = parts.views.at(-1)!.globeRotation;
      parts.clock.advanceMilliseconds(2000);
      parts.subject.requestFrame();
      parts.app.tick();
      expect(parts.views.at(-1)!.globeRotation).toEqual(before);
      parts.subject.destroy();
    }
  });
});

describe('DiveSession.destroy', () => {
  it('destroys the app, unbinds its textures, gives the bands back and frees the planet', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    const [, , , planet] = app.stage.children;
    subject.destroy();
    expect(planet!.destroyed).toBe(true);
    expect(app.textureRenders.at(-1)!.target.destroyed).toBe(true);
    expect(app.lifecycle.isDestroyed).toBe(true);
    expect(app.unbindCalls.count).toBe(1);
    expect(slime.bands[0]!.lifecycle.isDestroyed).toBe(true);
  });

  it('stops and starts the ticker as the stage leaves and comes back into view', async () => {
    const { subject, app } = await started();
    subject.setIsVisible(false);
    expect(app.ticking.isRunning).toBe(false);
    subject.setIsVisible(true);
    expect(app.ticking.isRunning).toBe(true);
    subject.destroy();
  });
});

describe('DiveSession.probeFrames', () => {
  it('draws the frames back to back at the zoom, the scene moving on, and answers their means', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    const band = slime.bands[0]!;
    const drawn = band.draws.length;
    const report = subject.probeFrames(-2.8, 4);
    expect(report.frames).toBe(4);
    expect(band.draws.length).toBe(drawn + 4);
    const probed = band.draws.slice(-4);
    expect(probed.every((frame) => frame.camera.zoom === -2.8)).toBe(true);
    expect(probed[3]!.timeSeconds - probed[0]!.timeSeconds).toBeCloseTo(3 / 60, 6);
    subject.destroy();
  });
});
