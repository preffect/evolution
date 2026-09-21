// `cellDrawExtentRadii` is a **bound**, and this file is what makes that word mean something: it walks the
// renderer's own `buildShapeTerms` over a swept time and checks the bound is never beaten, rather than restating
// the arithmetic the module already performs.

import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  stageOf,
  type CellView,
  type OwnedTrait,
  type TraitId,
  type TraitTier,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { createTestCellView } from '../../../../testing/builders';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { NOISE_STRIP_ROWS, PREVIEW_SEED } from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from './cell-deformation';
import { appendageReachRadii, cellDrawExtentRadii, restingDrawState } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';
import { FLAGELLUM_TRAIT } from './flagellum-lines';
import { FORM_PROFILES } from './forms/form-profiles';
import { buildShapeTerms } from './shape-terms';

const BALANCE = DEFAULT_BALANCE;
const STRIP = buildNoiseStrip(createSeededRandom(PREVIEW_SEED).fork(RANDOM_STREAM.cosmetic));

const CILIA_TRAIT: TraitId = 'cilia';
const TIER_I: TraitTier = 1;
const TIER_II: TraitTier = 2;
const TIER_III: TraitTier = 3;

/** A unit radius, so every reach this file compares is already in radii. */
const UNIT_RADIUS = 1;
/** Any speed at all: `buildShapeTerms` takes the ratio separately, and only the heading comes from the velocity. */
const MOVING_VELOCITY = 100;
const SPRINTING_TICKS = 1;
const NOT_SPRINTING_TICKS = 0;

function viewOf(traits: readonly OwnedTrait[], speedRatio: number, isSprinting: boolean): CellView {
  return createTestCellView({
    radius: UNIT_RADIUS,
    velocityX: speedRatio * MOVING_VELOCITY,
    velocityY: 0,
    sprintRemainingTicks: isSprinting ? SPRINTING_TICKS : NOT_SPRINTING_TICKS,
    traits: traits.map((owned) => ({ ...owned })),
    stage: stageOf(
      traits.map((owned) => owned.traitId),
      BALANCE.ladder,
    ),
  });
}

/** The reach the renderer actually built at `timeSeconds`, in radii: `radius` is 1, so `maxRadii` already is. */
function measuredReachRadii(view: CellView, timeSeconds: number, speedRatio: number, stripRow: number): number {
  const terms = buildShapeTerms({
    view,
    traits: summariseCellTraits(view),
    timeSeconds,
    speedRatio,
    heading: 0,
    phase: 0,
    stripRow,
    strip: STRIP,
    deformation: REST_DEFORMATION,
  });
  return terms.maxRadii;
}

/** One breathing period is under a second, so a few seconds at tick resolution sweeps every phase of every term. */
const SWEPT_SECONDS = 4;
const SWEPT_TICKS = Math.ceil(SWEPT_SECONDS / TICK_INTERVAL_S);
/** Any row: the test below pins that the reach does not depend on which one a cell rolled. */
const FIXED_STRIP_ROW = 0;
const RESTING = 0;
const SWIMMING = 1;
const AT_ZERO_SECONDS = 0;

describe('cellDrawExtentRadii', () => {
  /**
   * The bound's whole job. `peakReachRadii` takes the breathing sine at its peak and every other term straight
   * from `maxReachRadii`, so a term added to one and not the other shows up here — as a tick whose measured reach
   * went past the bound — rather than as a subject clipped by the lens's crop.
   *
   * Swept over four seconds of ticks, which is several periods of both the breathing and the wobble, so the sine
   * each contributes is sampled at every phase. The strip row is held at one value **because `maxReachRadii`
   * bounds the strip rather than sampling it** — the test below pins that, so this loop is not silently trading
   * coverage for speed. Its cost is the reason: this is 241 ticks × 5 stages × 2 speeds of real shape terms.
   */
  it('is never beaten by a frame the renderer actually builds', () => {
    for (const stage of Object.values(CELL_STAGE)) {
      for (const speedRatio of [RESTING, SWIMMING]) {
        const view = viewOf(BENCH_STAGE_TRAITS[stage], speedRatio, false);
        const bound = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(speedRatio));
        for (let tick = 0; tick <= SWEPT_TICKS; tick += 1) {
          const measured = measuredReachRadii(view, tick * TICK_INTERVAL_S, speedRatio, FIXED_STRIP_ROW);
          expect(
            measured,
            `${stage} at speed ${speedRatio}, tick ${tick}: the renderer reached ${measured.toFixed(4)} radii, ` +
              `past the ${bound.drawnRadii.toFixed(4)} bound the lens is framed from`,
          ).toBeLessThanOrEqual(bound.drawnRadii);
        }
      }
    }
  });

  /** What the fixed row above rests on: the strip moves `r(θ)`, but its **reach** is bounded, not sampled. */
  it('reaches the same maximum whichever strip row a cell drew', () => {
    const view = viewOf(BENCH_STAGE_TRAITS[CELL_STAGE.eukaryote], SWIMMING, false);
    const rows = Array.from({ length: NOISE_STRIP_ROWS }, (_unused, row) =>
      measuredReachRadii(view, AT_ZERO_SECONDS, SWIMMING, row),
    );
    expect(new Set(rows).size).toBe(1);
  });

  /** The body is the membrane without the halo, so it is always the smaller of the two bands' extents. */
  it('keeps the body inside the drawn extent for every stage', () => {
    for (const stage of Object.values(CELL_STAGE)) {
      const view = viewOf(BENCH_STAGE_TRAITS[stage], SWIMMING, false);
      const { bodyRadii, drawnRadii } = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(SWIMMING));
      expect(bodyRadii, stage).toBeGreaterThan(0);
      expect(bodyRadii, stage).toBeLessThan(drawnRadii);
    }
  });

  /** A sprint doubles the tail's wave and adds the axial stretch, so it can only widen a cell, never narrow it. */
  it('grows with a sprint and with speed', () => {
    const traits = BENCH_STAGE_TRAITS[CELL_STAGE.prokaryote];
    const traitsOf = (speedRatio: number, isSprinting: boolean) =>
      summariseCellTraits(viewOf(traits, speedRatio, isSprinting));
    const resting = cellDrawExtentRadii(traitsOf(RESTING, false), restingDrawState(RESTING));
    const swimming = cellDrawExtentRadii(traitsOf(SWIMMING, false), restingDrawState(SWIMMING));
    const sprinting = cellDrawExtentRadii(traitsOf(SWIMMING, true), {
      ...restingDrawState(SWIMMING),
      isSprinting: true,
    });
    expect(swimming.drawnRadii).toBeGreaterThan(resting.drawnRadii);
    expect(sprinting.drawnRadii).toBeGreaterThan(swimming.drawnRadii);
  });
});

/**
 * A tripwire, not a feature test. `evaluateProfile` is `radius × pulse × form.evaluate(Δ) × stretch × surface`,
 * but `maxReachRadii` has **no form term** — it bounds the stretch and the surface and nothing else. That is
 * exact only while every form draws the blob (`B ≡ 1`), which is where the registry still stands: every
 * `profileAt` is `BLOB_PROFILE` and returns `null`, with the five silhouettes owed by #192–#196.
 *
 * The day one of them registers a real `B(Δ)`, a profile with a peak above 1 reaches further than `maxRadii`
 * claims — which is the encyclopedia lens clipping a stentor's trumpet, and the in-game quad extent clipping it
 * too. This fires then, on the commit that causes it, instead of being found in a screenshot.
 */
describe('the form profiles maxReachRadii does not bound', () => {
  it('all still draw the blob, so the reach is exact', () => {
    for (const [traitId, form] of FORM_PROFILES) {
      for (const tier of [TIER_I, TIER_II, TIER_III]) {
        expect(
          form.profileAt(tier),
          `"${traitId}" tier ${tier} now has a form profile of its own. maxReachRadii (shape-terms.ts) multiplies ` +
            'no form term into its bound, so if that profile peaks above 1 the membrane reaches further than ' +
            'maxRadii reports: the cell quad clips it in play, and the encyclopedia lens — which frames from ' +
            'peakReachRadii — clips it in the preview. Teach both the profile’s peak before landing the silhouette.',
        ).toBeNull();
      }
    }
  });
});

describe('appendageReachRadii', () => {
  const membraneRadii = 1.2;

  /** A cell with neither trait has nothing hanging off it, so the membrane is the whole extent. */
  it('reaches nothing past a cell with no cilia and no tail', () => {
    const bare = summariseCellTraits(viewOf([], RESTING, false));
    expect(appendageReachRadii(bare, membraneRadii, false)).toBe(0);
  });

  /** The two cases the tail's tier separates: a longer wave at tier III, and double that again on a sprint. */
  it('lengthens the tail with its tier and doubles its wave on a sprint', () => {
    const tierOne = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_I }], RESTING, false));
    const tierThree = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_III }], RESTING, false));
    const shortTail = appendageReachRadii(tierOne, membraneRadii, false);
    const longTail = appendageReachRadii(tierThree, membraneRadii, false);
    const sprintingTail = appendageReachRadii(tierThree, membraneRadii, true);
    expect(shortTail).toBeGreaterThan(membraneRadii);
    expect(longTail).toBeGreaterThan(shortTail);
    expect(sprintingTail).toBeGreaterThan(longTail);
  });

  /** Cilia are hairs on the membrane, not a tail: they reach a fraction of a radius, not two of them. */
  it('reaches only just past the membrane for cilia', () => {
    const ciliated = summariseCellTraits(viewOf([{ traitId: CILIA_TRAIT, tier: TIER_I }], RESTING, false));
    const reach = appendageReachRadii(ciliated, membraneRadii, false);
    expect(reach).toBeGreaterThan(membraneRadii);
    expect(reach).toBeLessThan(membraneRadii + 1);
  });
});
