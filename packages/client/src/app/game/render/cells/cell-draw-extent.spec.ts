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
import { sampleProfileRing } from './radial-profile';
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
const REST_PULSE = 1;
/** An eat's peak pulse, near enough: what the tail must follow and the cilia must not. */
const EATING_PULSE = 1.1;
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

  /**
   * Speed stretches the body out along the heading; a sprint doubles the tail's wave and adds the axial stretch on
   * top. The drawn extent is **not** claimed to grow with plain speed: the stretch tapers the rear the tail roots
   * on, so a swimming flagellate's tip sits nearer its centre than a resting one's (ticket #491).
   */
  it('grows its body with speed and its drawn extent with a sprint', () => {
    const traits = BENCH_STAGE_TRAITS[CELL_STAGE.prokaryote];
    const traitsOf = (speedRatio: number, isSprinting: boolean) =>
      summariseCellTraits(viewOf(traits, speedRatio, isSprinting));
    const resting = cellDrawExtentRadii(traitsOf(RESTING, false), restingDrawState(RESTING));
    const swimming = cellDrawExtentRadii(traitsOf(SWIMMING, false), restingDrawState(SWIMMING));
    const sprinting = cellDrawExtentRadii(traitsOf(SWIMMING, true), {
      ...restingDrawState(SWIMMING),
      isSprinting: true,
    });
    expect(swimming.bodyRadii).toBeGreaterThan(resting.bodyRadii);
    expect(sprinting.drawnRadii).toBeGreaterThan(swimming.drawnRadii);
  });
});

/**
 * The form terms the bounds must see (ticket #192 turned the old tripwire into this). `evaluateProfile` is
 * `radius × pulse × B(Δ) × stretch × surface`, and a form adds to it twice: its `B` (whose peak `maxReachRadii`,
 * `peakReachRadii` and `peakRearMembraneRadii` multiply in) and, for the amoeba, the pseudopod bumps in the reserved
 * slots. Measured here on the **drawn membrane** — the profile itself, walked round the ring over swept time — so a
 * form whose `B` peaks above its `peak`, or whose lobes the bounds leave out, shows up as a cell the quad and the
 * lens would clip.
 */
/** Every half degree would be exact to a hair; this is fine enough to catch a lobe the bounds leave out. */
const RING_SAMPLES = 180;
/** Every fifth tick: several periods of every term over the swept four seconds, at a fifth of the cost. */
const TICK_STRIDE = 5;

describe('the form profiles the bounds must see', () => {
  function drawnMembraneRadii(view: CellView, timeSeconds: number, speedRatio: number): number {
    const terms = buildShapeTerms({
      view,
      traits: summariseCellTraits(view),
      timeSeconds,
      speedRatio,
      heading: 0,
      phase: 0,
      stripRow: FIXED_STRIP_ROW,
      strip: STRIP,
      deformation: REST_DEFORMATION,
    });
    const ring = sampleProfileRing(terms, RING_SAMPLES);
    const widest = Math.max(...ring);
    expect(widest, 'the per-instance reach covers the drawn membrane').toBeLessThanOrEqual(
      terms.maxRadii / terms.haloOuterRadii,
    );
    return widest;
  }

  /** The widest membrane drawn over the swept ticks. */
  function widestDrawnRadii(view: CellView, speedRatio: number): number {
    let widest = 0;
    for (let tick = 0; tick <= SWEPT_TICKS; tick += TICK_STRIDE) {
      widest = Math.max(widest, drawnMembraneRadii(view, tick * TICK_INTERVAL_S, speedRatio));
    }
    return widest;
  }

  it('never draws a membrane past the body bound, for any form at any tier', () => {
    const cases = [...FORM_PROFILES.keys()].flatMap((traitId) =>
      [TIER_I, TIER_II, TIER_III].flatMap((tier) =>
        [RESTING, SWIMMING].map((speedRatio) => ({ traitId, tier, speedRatio })),
      ),
    );
    for (const { traitId, tier, speedRatio } of cases) {
      const view = viewOf([{ traitId, tier }], speedRatio, false);
      const { bodyRadii } = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(speedRatio));
      expect(widestDrawnRadii(view, speedRatio), `${traitId} ${tier} at speed ${speedRatio}`).toBeLessThanOrEqual(
        bodyRadii,
      );
    }
  });

  /** The amoeba's lobes are the widest thing a form draws: its body bound sits well past the blob's. */
  it('widens the amoeba’s body bound by its lobes', () => {
    const amoeba = viewOf([{ traitId: 'amoeba_pseudopods', tier: TIER_I }], RESTING, false);
    const blob = viewOf([], RESTING, false);
    const amoebaBody = cellDrawExtentRadii(summariseCellTraits(amoeba), restingDrawState(RESTING)).bodyRadii;
    const blobBody = cellDrawExtentRadii(summariseCellTraits(blob), restingDrawState(RESTING)).bodyRadii;
    expect(amoebaBody).toBeGreaterThan(blobBody * 1.3);
  });
});

describe('appendageReachRadii', () => {
  /** A swimming cell's shape: the rear tapered well inside the widest membrane, so the two roots are told apart. */
  const membrane = { widestRadii: 1.2, rearRadii: 0.9 };

  /** A cell with neither trait has nothing hanging off it, so the membrane is the whole extent. */
  it('reaches nothing past a cell with no cilia and no tail', () => {
    const bare = summariseCellTraits(viewOf([], RESTING, false));
    expect(appendageReachRadii(bare, membrane, false, REST_PULSE)).toBe(0);
  });

  /** The two cases the tail's tier separates: a longer wave at tier III, and double that again on a sprint. */
  it('lengthens the tail with its tier and doubles its wave on a sprint', () => {
    const tierOne = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_I }], RESTING, false));
    const tierThree = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_III }], RESTING, false));
    const shortTail = appendageReachRadii(tierOne, membrane, false, REST_PULSE);
    const longTail = appendageReachRadii(tierThree, membrane, false, REST_PULSE);
    const sprintingTail = appendageReachRadii(tierThree, membrane, true, REST_PULSE);
    expect(shortTail).toBeGreaterThan(membrane.widestRadii);
    expect(longTail).toBeGreaterThan(shortTail);
    expect(sprintingTail).toBeGreaterThan(longTail);
  });

  /**
   * The renderer roots the tail on the membrane **at the rear** and the cilia all round it, so the tail moves with
   * the rear radius and the cilia with the widest — two cases, so a bound that rooted both on either one fails here.
   */
  it('roots the tail on the rear membrane and the cilia on the widest', () => {
    const tailed = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_III }], RESTING, false));
    const ciliated = summariseCellTraits(viewOf([{ traitId: CILIA_TRAIT, tier: TIER_I }], RESTING, false));
    const wider = { ...membrane, widestRadii: membrane.widestRadii + 1 };
    const longerRear = { ...membrane, rearRadii: membrane.rearRadii + 1 };
    const tailReach = appendageReachRadii(tailed, membrane, false, REST_PULSE);
    const ciliaReach = appendageReachRadii(ciliated, membrane, false, REST_PULSE);
    expect(appendageReachRadii(tailed, wider, false, REST_PULSE)).toBe(tailReach);
    expect(appendageReachRadii(tailed, longerRear, false, REST_PULSE)).toBeGreaterThan(tailReach);
    expect(appendageReachRadii(ciliated, longerRear, false, REST_PULSE)).toBe(ciliaReach);
    expect(appendageReachRadii(ciliated, wider, false, REST_PULSE)).toBeCloseTo(ciliaReach + 1);
  });

  /** Cilia are hairs on the membrane, not a tail: they reach a fraction of a radius, not two of them. */
  it('reaches only just past the membrane for cilia', () => {
    const ciliated = summariseCellTraits(viewOf([{ traitId: CILIA_TRAIT, tier: TIER_I }], RESTING, false));
    const reach = appendageReachRadii(ciliated, membrane, false, REST_PULSE);
    expect(reach).toBeGreaterThan(membrane.widestRadii);
    expect(reach).toBeLessThan(membrane.widestRadii + 1);
  });

  /**
   * The renderer draws the tail off `r × pulse` and the cilia in unpulsed radii past the membrane, so a clip's
   * pulse lengthens the one and leaves the other alone — two cases, so a bound that scaled both, or neither,
   * fails here.
   */
  it('lengthens the tail with the pulse and leaves the cilia alone', () => {
    const tailed = summariseCellTraits(viewOf([{ traitId: FLAGELLUM_TRAIT, tier: TIER_III }], RESTING, false));
    const ciliated = summariseCellTraits(viewOf([{ traitId: CILIA_TRAIT, tier: TIER_I }], RESTING, false));
    const restingTail = appendageReachRadii(tailed, membrane, false, REST_PULSE);
    const pulsedTail = appendageReachRadii(tailed, membrane, false, EATING_PULSE);
    expect(pulsedTail).toBeGreaterThan(restingTail);
    expect(appendageReachRadii(ciliated, membrane, false, EATING_PULSE)).toBe(
      appendageReachRadii(ciliated, membrane, false, REST_PULSE),
    );
  });
});
