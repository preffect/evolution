// The dive session's planet and the stage's order (docs/rendering/opening-dive.md §1, §3, §4) over the fake Pixi app:
// the planet draws on the dive's canvas from the first frame, while the renderer still bakes; the slime band lies over
// the kelp's while the drop shows and under the dish at the bottom of the stage; between the drop and the dish only
// the slime draws; the world's full coast comes up over its quick bake once it lands; and the lobby's autoplay waits
// for its coastlines.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import type { FakePixiApp } from '../../../../testing/fake-pixi-app';
import {
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
  loadUpperBands: () => Promise.resolve(fakeUpperBands(fakePlanetSource({ isKept: false }))),
});

describe('DiveSession’s planet', () => {
  it('draws the planet on the game’s canvas from the first frame, while the renderer still bakes', async () => {
    const { subject, app, slime, views } = await started();
    expect(subject.isBuildingRenderer).toBe(true);
    app.tick();
    expect(app.textureRenders).toHaveLength(1);
    expect(app.renderCalls.count).toBe(1);
    expect(opacityOf(app)).toBe(1);
    // In orbit the slime does not show: the planet is all there is.
    expect(slime.bands[0]!.draws.at(-1)!.bands.slime.isActive).toBe(false);
    expect(views.at(-1)!.camera.zoom).toBe(DIVE_ZOOM_TOP);
    subject.destroy();
  });

  it('lays the slime over the kelp band while the drop shows, and at the bottom of the stage under the dish', async () => {
    const { subject, app, slime, kelp } = await started();
    tickUntilBuilt(app, subject);
    const slimeView = slime.bands[0]!.view;
    const kelpView = kelp.bands[0]!.view;
    const children = app.stage.children;
    subject.controls.scrub(4);
    app.tick();
    expect(children[0]).toBe(slimeView);
    // In the drop the slime draws over the drop, which the kelp band shows under it.
    subject.controls.scrub(-2);
    app.tick();
    expect(children.at(-1)).toBe(slimeView);
    expect(children.indexOf(slimeView)).toBeGreaterThan(children.indexOf(kelpView));
    expect(opacityOf(app)).toBe(1);
    // Down to the dish: the game's dish draws over the slime round it.
    subject.controls.scrub(-4.3);
    app.tick();
    expect(children[0]).toBe(slimeView);
    expect(children[1]!.visible).toBe(true);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('shows the planet alone in orbit: the game’s dish is undrawn', async () => {
    const { subject, app, views } = await started();
    tickUntilBuilt(app, subject);
    const [rendered, planetDraws] = [app.renderCalls.count, app.textureRenders.length];
    app.tick();
    const [, gameRoot] = app.stage.children;
    expect(views.at(-1)!.bands.dish.isActive).toBe(false);
    expect(gameRoot!.visible).toBe(false);
    expect(app.textureRenders.length).toBe(planetDraws + 1);
    expect(app.renderCalls.count).toBe(rendered + 1);
    expect(subject.lastRenderOutputs!.visibleCells).toBe(0);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('draws neither the planet nor the dish between the drop and the dish: the slime alone covers the view', async () => {
    const { subject, app, slime } = await started();
    tickUntilBuilt(app, subject);
    // The shore keeps the canvas up to −1.42 (ticket #801), the drop to −2.96 (#802); then the slime alone (#803).
    subject.controls.scrub(-3.3);
    const [rendered, planetDraws] = [app.renderCalls.count, app.textureRenders.length];
    app.tick();
    const [, gameRoot] = app.stage.children;
    expect(slime.bands[0]!.draws.at(-1)!.camera.zoom).toBe(-3.3);
    expect(app.textureRenders.length).toBe(planetDraws);
    expect(app.renderCalls.count).toBe(rendered + 1);
    expect(gameRoot!.visible).toBe(false);
    expect(opacityOf(app)).toBe(1);
    subject.destroy();
  });

  it('shows no planet before it has land, then brings the full coast up over the quick bake across 300 ms', async () => {
    const { subject, app, clock, dependencies } = await started(unbaked());
    const weight = (): unknown => planetUniformOf(app, DIVE_PLANET_UNIFORM.worldFineWeight);
    app.tick();
    // A cold open draws no planet until it has land: no land-less sea, and the planet unseen.
    const [, , , planet] = app.stage.children;
    expect(app.textureRenders).toHaveLength(0);
    expect(planet!.alpha).toBe(0);
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
