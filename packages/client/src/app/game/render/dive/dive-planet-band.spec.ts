// The dive's planet band (docs/rendering/opening-dive.md §4): its coastline bakes in order and kept for the page, the
// world's full bake coming up over its quick one, and a draw through the app's renderer at the planet's own
// resolution. Over one-texel bakes and a recording renderer: no WebGL, no coastlines.

import { ManualClock } from '@evolution/shared';
import { Container, type RenderTexture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { fakePlanetSource, oneTexelBakeJob } from '../../../../testing/dive-session-harness';
import { DIVE_GLOBE_CROSSFADE_MS } from '../constants';
import { DivePlanetBand, type DivePlanetSource } from './dive-planet-band';
import { diveViewAt } from './dive-view';
import { DIVE_PLANET_UNIFORM as UNIFORM } from './planet/dive-planet-shader';

const VIEWPORT = { width: 400, height: 200 };

function viewAt(zoom: number) {
  return diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds: 1, isMoving: false, globeIdleSpinDegrees: 0 });
}

function drawn(band: DivePlanetBand, zoom: number, nowMs: number, isMotionReduced = false): RenderTexture[] {
  const targets: RenderTexture[] = [];
  band.draw({ view: viewAt(zoom), bandsRatio: 2, nowMs, isMotionReduced }, (_container, target) =>
    targets.push(target),
  );
  return targets;
}

/** A planet whose bakes record the order they are made in. */
function orderedSource(made: string[]): DivePlanetSource {
  const source = fakePlanetSource({ isKept: false });
  const recorded = (slot: string) => () => {
    made.push(slot);
    return oneTexelBakeJob(2);
  };
  return {
    kept: source.kept,
    plan: { ...source.plan, worldPreview: recorded('preview'), world: recorded('world'), region: recorded('region') },
  };
}

describe('DivePlanetBand bakes', () => {
  it('bakes the world’s quick coast, then its full one, then the region’s, keeping each for the page', () => {
    const made: string[] = [];
    const source = orderedSource(made);
    const band = new DivePlanetBand(source, new ManualClock(0));
    expect(band.isBaked).toBe(false);
    expect(band.isPlanetReady).toBe(false);
    expect(band.pumpBakes(8)).toBe(true);
    expect(made).toEqual(['preview', 'world', 'region']);
    expect([...source.kept.keys()]).toEqual(['worldPreviewSdf', 'worldSdf', 'regionSdf']);
    expect(band.isBaked).toBe(true);
    expect(band.isPlanetReady).toBe(true);
    expect(band.pumpBakes(8)).toBe(false);
    band.destroy();
  });

  it('stops a slice at its budget on the dive’s clock, and carries the bake on in the next', () => {
    const clock = new ManualClock(0);
    const made: string[] = [];
    const source = orderedSource(made);
    const slow = (): ReturnType<typeof oneTexelBakeJob> =>
      (function* () {
        clock.advanceMilliseconds(10);
        yield;
        return yield* oneTexelBakeJob(0);
      })();
    const band = new DivePlanetBand({ ...source, plan: { ...source.plan, worldPreview: slow } }, clock);
    expect(band.pumpBakes(8)).toBe(false);
    expect(source.kept.size).toBe(0);
    expect(band.pumpBakes(8)).toBe(true);
    expect(source.kept.has('worldPreviewSdf')).toBe(true);
    band.destroy();
  });

  it('bakes nothing an earlier open kept, and never the quick coast once the full one is kept', () => {
    const made: string[] = [];
    const source = orderedSource(made);
    source.kept.set('worldSdf', { width: 1, height: 1, data: new Uint8Array(4), metresPerTexel: 1 });
    const band = new DivePlanetBand(source, new ManualClock(0));
    expect(band.isPlanetReady).toBe(true);
    band.pumpBakes(8);
    expect(made).toEqual(['region']);
    band.destroy();
  });
});

describe('DivePlanetBand draws', () => {
  it('never draws a planet without land on a cold open: it fades in once the quick coast lands', () => {
    const made: string[] = [];
    const band = new DivePlanetBand(orderedSource(made), new ManualClock(0));
    const stage = new Container();
    band.attachTo(stage);
    const planet = stage.children[0]!;
    expect(drawn(band, 7, 0)).toEqual([]);
    expect(planet.alpha).toBe(0);
    expect(drawn(band, 7, 500)).toEqual([]);
    expect(planet.alpha).toBe(0);
    band.pumpBakes(8);
    expect(drawn(band, 7, 1000)).toHaveLength(1);
    expect(planet.alpha).toBe(0);
    drawn(band, 7, 1000 + DIVE_GLOBE_CROSSFADE_MS / 2);
    expect(planet.alpha).toBeCloseTo(0.5, 6);
    drawn(band, 7, 1000 + DIVE_GLOBE_CROSSFADE_MS);
    expect(planet.alpha).toBe(1);
    band.destroy();
  });

  it('shows a planet kept from an earlier open at once, and a cold one at once under reduced motion', () => {
    const kept = new DivePlanetBand(fakePlanetSource(), new ManualClock(0));
    const keptStage = new Container();
    kept.attachTo(keptStage);
    expect(drawn(kept, 7, 0)).toHaveLength(1);
    expect(keptStage.children[0]!.alpha).toBe(1);
    kept.destroy();
    const cold = new DivePlanetBand(fakePlanetSource({ isKept: false, slices: 0 }), new ManualClock(0));
    const coldStage = new Container();
    cold.attachTo(coldStage);
    drawn(cold, 7, 0, true);
    cold.pumpBakes(8);
    drawn(cold, 7, 10, true);
    expect(coldStage.children[0]!.alpha).toBe(1);
    cold.destroy();
  });

  it('draws through the renderer it is handed, at the sphere’s ratio, and shows or hides its sprite', () => {
    const band = new DivePlanetBand(fakePlanetSource(), new ManualClock(0));
    const stage = new Container();
    band.attachTo(stage);
    const [target] = drawn(band, 7, 0);
    expect([target!.width, target!.height]).toEqual([600, 300]);
    band.setIsShown(false);
    expect(stage.children[0]!.visible).toBe(false);
    band.setIsShown(true);
    expect(stage.children[0]!.visible).toBe(true);
    expect(band.uniformValue(UNIFORM.isRegionReady)).toBe(1);
    band.destroy();
    expect(stage.children).toHaveLength(0);
  });

  it('brings the full coast up over the quick one across the crossfade once it lands, at once if it was kept', () => {
    const band = new DivePlanetBand(fakePlanetSource({ isKept: false, slices: 0 }), new ManualClock(0));
    drawn(band, 7, 0);
    expect(band.uniformValue(UNIFORM.worldFineWeight)).toBe(0);
    band.pumpBakes(8);
    drawn(band, 7, 1000);
    expect(band.uniformValue(UNIFORM.worldFineWeight)).toBe(0);
    drawn(band, 7, 1000 + DIVE_GLOBE_CROSSFADE_MS / 2);
    expect(band.uniformValue(UNIFORM.worldFineWeight)).toBeCloseTo(0.5, 6);
    band.destroy();

    const kept = new DivePlanetBand(fakePlanetSource(), new ManualClock(0));
    drawn(kept, 7, 0);
    expect(kept.uniformValue(UNIFORM.worldFineWeight)).toBe(1);
    kept.destroy();
  });
});
