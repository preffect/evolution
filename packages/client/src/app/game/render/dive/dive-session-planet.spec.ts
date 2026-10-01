// The dive session's planet (docs/rendering/opening-dive.md §1, §3, §4) over the fake Pixi app: it draws on the game's
// canvas from the first frame, while the renderer still bakes; the mockup's canvas lies over it while it shows, so the
// shore draws over it; neither it nor the dish draws between them; the world's full coast comes up over its quick
// bake once it lands; and the lobby's autoplay waits for its coastlines.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import type { FakePixiApp } from '../../../../testing/fake-pixi-app';
import {
  fakeDiveBands,
  fakePlanetSource,
  fakeUpperBands,
  planetUniformOf,
  startedDiveSession as started,
  tickUntilBuilt,
  type DiveSessionHarness,
} from '../../../../testing/dive-session-harness';
import { DIVE_AUTOPLAY_DELAY_MS, DIVE_BAKE_START_DELAY_MS, DIVE_GLOBE_CROSSFADE_MS, DIVE_ZOOM_TOP } from '../constants';
import { DIVE_PLANET_UNIFORM } from './planet/dive-planet-shader';

/** The game's canvas opacity: 1 while it shows the planet, the dish band's weight at the bottom. */
const opacityOf = (app: FakePixiApp): number => Number(app.canvas.style.opacity);

/** A dive whose planet has baked nothing yet: its coastlines bake on the scheduler. */
const unbaked = (): Partial<DiveSessionHarness['dependencies']> => ({
  loadUpperBands: () => Promise.resolve(fakeUpperBands(fakeDiveBands(), fakePlanetSource({ isKept: false }))),
});

describe('DiveSession’s planet', () => {
  it('draws the planet on the game’s canvas from the first frame, while the renderer still bakes', async () => {
    const { subject, app, bands, views } = await started();
    expect(subject.isBuildingRenderer).toBe(true);
    app.tick();
    expect(app.textureRenders).toHaveLength(1);
    expect(app.renderCalls.count).toBe(1);
    expect(opacityOf(app)).toBe(1);
    // In orbit no mockup band draws: its canvas is hidden and the planet is all there is.
    expect(bands.frames).toHaveLength(0);
    expect(bands.canvas.hidden).toBe(true);
    expect(views.at(-1)!.camera.zoom).toBe(DIVE_ZOOM_TOP);
    subject.destroy();
  });

  it('lays the mockup’s canvas over the game’s while the planet shows, so the shore draws over it', async () => {
    const { subject, app, bands, dependencies } = await started();
    dependencies.host.append(app.canvas);
    subject.controls.scrub(4);
    app.tick();
    expect(bands.frames.at(-1)!.zoom).toBe(4);
    expect(dependencies.host.lastElementChild).toBe(bands.canvas);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('shows the planet alone in orbit: the game’s dish is undrawn', async () => {
    const { subject, app, views } = await started();
    tickUntilBuilt(app, subject);
    const [rendered, planetDraws] = [app.renderCalls.count, app.textureRenders.length];
    app.tick();
    const [gameRoot] = app.stage.children;
    expect(views.at(-1)!.bands.dish.isActive).toBe(false);
    expect(gameRoot!.visible).toBe(false);
    expect(app.textureRenders.length).toBe(planetDraws + 1);
    expect(app.renderCalls.count).toBe(rendered + 1);
    expect(subject.lastRenderOutputs!.visibleCells).toBe(0);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('draws neither the planet nor the dish between them, where the mockup’s canvas covers the view', async () => {
    const { subject, app, bands } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-0.3);
    const [rendered, planetDraws] = [app.renderCalls.count, app.textureRenders.length];
    app.tick();
    expect(bands.frames.at(-1)!.zoom).toBe(-0.3);
    expect(app.textureRenders.length).toBe(planetDraws);
    expect(app.renderCalls.count).toBe(rendered);
    expect(opacityOf(app)).toBe(0);
    subject.destroy();
  });

  it('brings the world’s full coast up over its quick bake across 300 ms, at once under reduced motion', async () => {
    const { subject, app, clock, dependencies } = await started(unbaked());
    const weight = (): unknown => planetUniformOf(app, DIVE_PLANET_UNIFORM.worldFineWeight);
    app.tick();
    expect(weight()).toBe(0);
    (dependencies.scheduler as ManualScheduler).advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    app.tick();
    expect(weight()).toBe(0);
    clock.advanceMilliseconds(DIVE_GLOBE_CROSSFADE_MS / 2);
    app.tick();
    expect(weight()).toBeCloseTo(0.5, 6);
    clock.advanceMilliseconds(DIVE_GLOBE_CROSSFADE_MS / 2);
    app.tick();
    expect(weight()).toBe(1);
    subject.destroy();

    const reduced = await started(unbaked());
    reduced.motion.isReduced = true;
    reduced.app.tick();
    (reduced.dependencies.scheduler as ManualScheduler).advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    reduced.app.tick();
    expect(planetUniformOf(reduced.app, DIVE_PLANET_UNIFORM.worldFineWeight)).toBe(1);
    reduced.subject.destroy();
  });

  it('holds the lobby’s autoplay until the planet’s coastlines have baked', async () => {
    const { subject, app, clock, dependencies } = await started(unbaked());
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 3);
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    (dependencies.scheduler as ManualScheduler).advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    app.tick();
    expect(subject.controls.isPlaying).toBe(true);
    subject.destroy();
  });
});
