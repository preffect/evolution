// `cellDrawExtentRadii` is a **bound**, and this file is what makes that word mean something: it walks the
// renderer's own `buildShapeTerms` over a swept time and checks the bound is never beaten, rather than restating
// the arithmetic the module already performs.

import { CELL_STAGE, TICK_INTERVAL_S, type CellView, type TraitId, type TraitTier } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  PROFILE_WALK_TICKS,
  PROFILE_WALK_TICK_STRIDE,
  PROFILE_WALK_TIMEOUT_MS,
  drawnMembraneAt,
  profileWalkTerms,
  profileWalkView,
} from '../../../../testing/profile-walk';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { NOISE_STRIP_ROWS } from '../constants';
import { appendageReachRadii, cellDrawExtentRadii, restingDrawState } from './cell-draw-extent';
import { summariseCellTraits } from './cell-traits';
import { FLAGELLUM_TRAIT } from './flagellum-lines';
import { haloOuterRadiiOf } from './shape-terms';

const CILIA_TRAIT: TraitId = 'cilia';
const TIER_I: TraitTier = 1;
const TIER_III: TraitTier = 3;
const viewOf = profileWalkView;

/** The drawn membrane with its halo, in radii, checked on the way against the quad's per-instance reach. */
function drawnReachRadii(view: CellView, timeSeconds: number, speedRatio: number): number {
  const { widest, quadMembrane } = drawnMembraneAt(view, timeSeconds, speedRatio);
  expect(widest, 'the per-instance reach covers the drawn membrane').toBeLessThanOrEqual(quadMembrane);
  return widest * haloOuterRadiiOf(summariseCellTraits(view));
}

const RESTING = 0;
const SWIMMING = 1;
const REST_PULSE = 1;
/** An eat's peak pulse, near enough: what the tail must follow and the cilia must not. */
const EATING_PULSE = 1.1;
const AT_ZERO_SECONDS = 0;

describe('cellDrawExtentRadii', () => {
  /**
   * The bound's whole job. `peakReachRadii` takes the breathing sine at its peak and every other term at its own,
   * so a term the renderer draws and the bound leaves out shows up here — as a tick whose drawn membrane, halo and
   * all, went past the bound — rather than as a subject clipped by the lens's crop. It measures the profile itself:
   * the amoeba's bound is tighter than the quad's `maxRadii` (#192), which the helper checks separately.
   *
   * Swept over four seconds at every fifth tick, which is several periods of both the breathing and the wobble, so the sine
   * each contributes is sampled at every phase. The strip row is held at one value **because `maxReachRadii`
   * bounds the strip rather than sampling it** — the test below pins that, so this loop is not silently trading
   * coverage for speed. Its cost is the reason: this is 49 ticks × 180 angles × 5 stages × 2 speeds of real profiles.
   */
  it(
    'is never beaten by a frame the renderer actually builds',
    () => {
      for (const stage of Object.values(CELL_STAGE)) {
        for (const speedRatio of [RESTING, SWIMMING]) {
          const view = viewOf(BENCH_STAGE_TRAITS[stage], speedRatio, false);
          const bound = cellDrawExtentRadii(summariseCellTraits(view), restingDrawState(speedRatio));
          for (let tick = 0; tick <= PROFILE_WALK_TICKS; tick += PROFILE_WALK_TICK_STRIDE) {
            const measured = drawnReachRadii(view, tick * TICK_INTERVAL_S, speedRatio);
            expect(
              measured,
              `${stage} at speed ${speedRatio}, tick ${tick}: the renderer reached ${measured.toFixed(4)} radii, ` +
                `past the ${bound.drawnRadii.toFixed(4)} bound the lens is framed from`,
            ).toBeLessThanOrEqual(bound.drawnRadii);
          }
        }
      }
    },
    PROFILE_WALK_TIMEOUT_MS,
  );

  /** What the fixed row above rests on: the strip moves `r(θ)`, but its **reach** is bounded, not sampled. */
  it('reaches the same maximum whichever strip row a cell drew', () => {
    const view = viewOf(BENCH_STAGE_TRAITS[CELL_STAGE.eukaryote], SWIMMING, false);
    const rows = Array.from(
      { length: NOISE_STRIP_ROWS },
      (_unused, row) => profileWalkTerms(view, AT_ZERO_SECONDS, SWIMMING, row).maxRadii,
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
