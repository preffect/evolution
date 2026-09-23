// docs/ecology/acceptance.md §8.1, the evolving-world rows that run the clock into a later era (W3, W6, W9, W10),
// each run twice and hash-compared. The first-minute rows are ecology-wild.gameplay.test.ts.
//
// The placed rows (W6, W10) place A at the broth point at setup, which vacates the seeded seats and switches the
// spawns off from tick 0 (docs/testing/scenario-runner.md §8.1): the idle A meets nothing before the fixture re-places
// it at the era tick and seats seat 0 on demand beside it. The seeded rows (W3, W9) keep every seeded seat.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  TICK_HZ,
  TICK_INTERVAL_S,
  ZONE_ID,
  bacteriumVariantWeightsForZone,
} from '@evolution/shared';
import { cellOf, effectsOfKind, massOf } from '../gameplay/evolution-views.js';
import { BROTH_POINT, ZONE } from '../gameplay/placement.js';
import { CENTRE_DISTANCE_WU, PROGRESS_TOLERANCE, absorption, releaseReasons } from './engulf-setups.js';
import { MASS_TOLERANCE, foodSpawnedSince, placedSolo, seededSolo } from './shared-setups.js';
import {
  EUKARYOTE_TICK,
  HEADING_TOLERANCE_DEGREES,
  HUNTING_TICK,
  PLACED_SEAT,
  RUNS_PER_ROW,
  WILD_WINDOW_TICKS,
  WORLD_LEVEL_TICKS,
  WORLD_SPREAD,
  algaeShareOf,
  distanceFromSeat,
  everyWildCellAtLevel,
  headingErrorOfSeat,
  heldWindow,
  massOfSeat,
  placedSeat,
  progressOfSeat,
  statesOfSeat,
  targetOfSeat,
  worldMassAtTick,
  worstSpreadMiss,
} from './wild-setups.js';

const { ecology, growth, wildCells } = DEFAULT_BALANCE;
const ONE_TICK = 1;
/** W3: "mass = 199.983 × its spread" after tick 10 799, "200 × its spread" after 10 800; the tolerance the row states. */
const W3_MASS_BEFORE_LEVEL = 199.983;
const W3_MASS_AT_LEVEL = 200;
const W3_SPAWNED_LOW = 351;
const W3_SPAWNED_HIGH = 355;
/** W3 on the pinned seed: 291 algae and 12 clusters of 5 in 303 events, 0.829 (the 0.70 row; the window's σ is ≈ 0.07). */
const W3_ALGAE_SHARE_ON_SEED = 0.829;
/** W9: the idle player dies three times in the window; "between 513 and 517", "algae share within 0.50 ± 0.06" (0.514). */
const W9_DEATHS_IN_WINDOW = 3;
const W9_SPAWNED_LOW = 513;
const W9_SPAWNED_HIGH = 517;
const W9_ALGAE_SHARE = 0.5;
const W9_ALGAE_SHARE_ON_SEED = 0.514;
const ALGAE_SHARE_TOLERANCE = 0.06;
/** A seed's share is one number: the tolerance only absorbs the rounding of the literal the row states. */
const SEED_SHARE_TOLERANCE = 0.001;
/** W6: seat 0 at mass 380 (radius 77.97) and A at 20, pinned, 390 wu east; the velocity read 60 ticks on. */
const W6_PREY_MASS = 20;
const W6_PREY_EAST_WU = 390;
const W6_SETTLE_TICKS = 60;
/** 21 570: one decision interval (30 ticks) before the hunting era. */
const W6_EARLY_TICK = HUNTING_TICK - wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS * TICK_HZ;
const W6_PREY_CENTRE = { x: BROTH_POINT.x + W6_PREY_EAST_WU, y: BROTH_POINT.y };
/** W10: P (Toxin Vacuole II, mass 380, pinned) and seat 0 at spread 1.3 (mass 494) 10 wu east of it. */
const W10_PREY_MASS = 380;
const W10_SEAT_SPREAD = 1.3;
const W10_TOXIN_TIER = 2;
const W10_SECOND_TICK = HUNTING_TICK + ONE_TICK;
/** The row's ticks: cover ends 21 611, seal 21 635, the ratio release 21 640 from the absorb phase. */
const W10_COVER_END_TICK = 21_611;
const W10_SEAL_TICK = 21_635;
const W10_RELEASE_TICK = 21_640;
/** After tick 21 601: 494.02 pinned − 0.42 booked by step 5 (the start tick's step 5 saw a free seat: no drain). */
const W10_SEAT_MASS_AFTER_SECOND_TICK = 493.6;
const W10_SEAT_DRAINED_AFTER_SECOND_TICK = 0.42;
const W10_PREY_MASS_AFTER_SECOND_TICK = 379.98;
/** At the release: seat 0 ≈ 416.45 (< 1.1 × P), drained ≈ 78.42, P ≈ 379.51. */
const W10_SEAT_MASS_AT_RELEASE = 416.45;
const W10_SEAT_DRAINED_AT_RELEASE = 78.42;
const W10_PREY_MASS_AT_RELEASE = 379.51;
/** "Ratio 1.3 → massFactor 1.25 / 1.3": the cover rate (1/69.2 a tick), and the progress after the start tick. */
const W10_MASS_FACTOR = absorption.ENGULF_MASS_RATIO / W10_SEAT_SPREAD;
const W10_COVER_RATE_PER_TICK = TICK_INTERVAL_S / (absorption.ENGULF_BASE_DURATION_SECONDS * W10_MASS_FACTOR);

/** W6, W10: A at the broth point from tick 0 (spawns off), seat 0 and A re-placed by the fixture at `tick`. */
function eraRow(name: string) {
  return placedSolo(name).placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS });
}

describe('ecology/acceptance.md §8.1: the world clock and the wild cells', () => {
  it('W3: the seats step to level 2 on tick 10 800 exactly, and the prokaryote broth spawns 70 % algae', async () => {
    const levelTick = WORLD_LEVEL_TICKS;
    const run = seededSolo('W3').advance(levelTick + WILD_WINDOW_TICKS + ONE_TICK);
    const { counts, windowEnd } = heldWindow(run, levelTick + ONE_TICK);
    await run
      .expect(
        'every wild cell level 1, no traits, protocell after tick 10 799',
        everyWildCellAtLevel(1, CELL_STAGE.protocell, []),
      )
      .atTick(levelTick - ONE_TICK)
      .toBe(true)
      .expect('mass = 199.983 × spread after tick 10 799', worstSpreadMiss(W3_MASS_BEFORE_LEVEL))
      .atTick(levelTick - ONE_TICK)
      .toBeAtMost(MASS_TOLERANCE)
      .expect('no world_level_up yet', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atTick(levelTick - ONE_TICK)
      .toEqual([])
      .expect(
        'every wild cell level 2 with nucleoid I, prokaryote, after tick 10 800',
        everyWildCellAtLevel(2, CELL_STAGE.prokaryote, ['nucleoid']),
      )
      .atTick(levelTick)
      .toBe(true)
      .expect('mass = 200 × spread after tick 10 800', worstSpreadMiss(W3_MASS_AT_LEVEL))
      .atTick(levelTick)
      .toBeAtMost(MASS_TOLERANCE)
      .expect('exactly one world_level_up { level: 2, stage: prokaryote }', (view) =>
        effectsOfKind(view, EFFECT_KIND.worldLevelUp),
      )
      .atTick(levelTick)
      .toEqual([{ kind: EFFECT_KIND.worldLevelUp, tick: levelTick, level: 2, stage: CELL_STAGE.prokaryote }])
      .expect('motes spawned in the window', foodSpawnedSince('food at window start'))
      .atTick(windowEnd)
      .toBeBetween(W3_SPAWNED_LOW, W3_SPAWNED_HIGH)
      .runDeterministic();
    // The pure table: the protocell and prokaryote rows the fill and the window read.
    expect(ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.protocell).toEqual({ algae: 0.75, bacterium: 0.25 });
    expect(ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.prokaryote).toEqual({ algae: 0.7, bacterium: 0.3 });
    // The seed's own draw of the 0.70 row (docs/ecology/acceptance.md §8.1 W3): no death in the window.
    expect(counts.deaths).toBe(0);
    expect(algaeShareOf(counts)).toBeCloseTo(W3_ALGAE_SHARE_ON_SEED, SEED_SHARE_TOLERANCE);
  });

  it('W9: the eukaryote bloom spawns 513–517 motes in the window (three deaths) at 50 % algae; the variant table', async () => {
    const run = seededSolo('W9').advance(EUKARYOTE_TICK + WILD_WINDOW_TICKS + ONE_TICK);
    const { counts, windowEnd } = heldWindow(run, EUKARYOTE_TICK + ONE_TICK);
    await run
      .expect('motes spawned in the window', foodSpawnedSince('food at window start'))
      .atTick(windowEnd)
      .toBeBetween(W9_SPAWNED_LOW, W9_SPAWNED_HIGH)
      .runDeterministic();
    // The hunting era's seats eat the idle player three times; each spectate takes the per-player rate off the budget.
    expect(counts.deaths).toBe(RUNS_PER_ROW * W9_DEATHS_IN_WINDOW);
    expect(algaeShareOf(counts)).toBeGreaterThanOrEqual(W9_ALGAE_SHARE - ALGAE_SHARE_TOLERANCE);
    expect(algaeShareOf(counts)).toBeLessThanOrEqual(W9_ALGAE_SHARE + ALGAE_SHARE_TOLERANCE);
    expect(algaeShareOf(counts)).toBeCloseTo(W9_ALGAE_SHARE_ON_SEED, SEED_SHARE_TOLERANCE);
    const weights = (
      zone: (typeof ZONE_ID)[keyof typeof ZONE_ID],
      stage: (typeof CELL_STAGE)[keyof typeof CELL_STAGE],
    ) => bacteriumVariantWeightsForZone(zone, stage, ecology);
    expect(weights(ZONE_ID.openBroth, CELL_STAGE.protocell)).toEqual({ plain: 1, aerobic: 0, photosynthetic: 0 });
    expect(weights(ZONE_ID.openBroth, CELL_STAGE.endosymbiosis)).toEqual({
      plain: 0.6,
      aerobic: 0.2,
      photosynthetic: 0.2,
    });
    expect(weights(ZONE_ID.viscousGel, CELL_STAGE.eukaryote)).toEqual({
      plain: 0.4,
      aerobic: 0.3,
      photosynthetic: 0.3,
    });
    expect(weights(ZONE_ID.warmVent, CELL_STAGE.protocell)).toEqual({ plain: 0.3, aerobic: 0.7, photosynthetic: 0 });
    expect(weights(ZONE_ID.warmVent, CELL_STAGE.eukaryote)).toEqual({ plain: 0.3, aerobic: 0.7, photosynthetic: 0 });
  });

  it('W6: seated at tick 21 600, seat 0 hunts the lunch 390 wu east on that very tick; one interval earlier it wanders', async () => {
    const hunting = eraRow('W6')
      .atTick(HUNTING_TICK)
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: WORLD_SPREAD, at: ZONE.broth })
      .atTick(HUNTING_TICK)
      .placeCell({ playerIndex: 0, mass: W6_PREY_MASS, isPinned: true, at: W6_PREY_CENTRE })
      .advance(HUNTING_TICK + W6_SETTLE_TICKS);
    await hunting
      .expect("seat 0's target is A's centre on tick 21 600", targetOfSeat)
      .atTick(HUNTING_TICK)
      .toEqual(W6_PREY_CENTRE)
      .expect('velocity points at A within 5° by tick 21 660', (view) => headingErrorOfSeat(view, cellOf(view, 0)))
      .atTick(HUNTING_TICK + W6_SETTLE_TICKS)
      .toBeAtMost(HEADING_TOLERANCE_DEGREES)
      .expect('the distance has shrunk', (view) => distanceFromSeat(view, 0))
      .atTick(HUNTING_TICK + W6_SETTLE_TICKS)
      .toBeLessThan(W6_PREY_EAST_WU)
      .runDeterministic();
    await eraRow('W6 one interval early')
      .atTick(W6_EARLY_TICK)
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: WORLD_SPREAD, at: ZONE.broth })
      .atTick(W6_EARLY_TICK)
      .placeCell({ playerIndex: 0, mass: W6_PREY_MASS, isPinned: true, at: W6_PREY_CENTRE })
      .advance(W6_EARLY_TICK)
      .expect("a wander target, not A's centre, on tick 21 570", targetOfSeat)
      .atTick(W6_EARLY_TICK)
      .toSatisfy(
        (target) => target !== undefined && (target.x !== W6_PREY_CENTRE.x || target.y !== W6_PREY_CENTRE.y),
        "a target that is not A's centre",
      )
      .runDeterministic();
  });

  it('W10: a wild predator bleeds the Toxin Vacuole drain tick for tick and releases by ratio before the payout', async () => {
    const afterRelease = W10_RELEASE_TICK + ONE_TICK;
    await eraRow('W10')
      .atTick(HUNTING_TICK)
      .placeCell({
        playerIndex: 0,
        mass: W10_PREY_MASS,
        isPinned: true,
        at: ZONE.broth,
        traits: [{ traitId: 'toxin_vacuole', tier: W10_TOXIN_TIER }],
      })
      .atTick(HUNTING_TICK)
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: W10_SEAT_SPREAD, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
      .advance(afterRelease)
      .expect(
        'the engulf starts on tick 21 600 from progress 0: one cover tick done',
        (view) => cellOf(view, 0)?.engulfProgress,
      )
      .atTick(HUNTING_TICK)
      .toBeCloseTo(W10_COVER_RATE_PER_TICK, PROGRESS_TOLERANCE)
      .expect('P being engulfed', (view) => cellOf(view, 0)?.states)
      .atTick(HUNTING_TICK)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect("seat 0's mass ≈ 493.6 after tick 21 601", massOfSeat)
      .atTick(W10_SECOND_TICK)
      .toBeCloseTo(W10_SEAT_MASS_AFTER_SECOND_TICK, MASS_TOLERANCE)
      .expect("seat 0's drainedMass ≈ 0.42", (view) => placedSeat(view)?.drainedMass)
      .atTick(W10_SECOND_TICK)
      .toBeCloseTo(W10_SEAT_DRAINED_AFTER_SECOND_TICK, MASS_TOLERANCE)
      .expect('P ≈ 379.98', (view) => massOf(view, 0))
      .atTick(W10_SECOND_TICK)
      .toBeCloseTo(W10_PREY_MASS_AFTER_SECOND_TICK, MASS_TOLERANCE)
      .expect('cover ends on tick 21 611, into the wrap band', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_COVER_END_TICK)
      .toBeGreaterThan(absorption.ENGULF_WRAP_START_PROGRESS)
      .expect('still in cover the tick before', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_COVER_END_TICK - ONE_TICK)
      .toBeLessThan(absorption.ENGULF_WRAP_START_PROGRESS)
      .expect('sealed on tick 21 635', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_SEAL_TICK)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('not yet sealed the tick before', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_SEAL_TICK - ONE_TICK)
      .toBeLessThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('still held the tick before the release', (view) => cellOf(view, 0)?.states)
      .atTick(W10_RELEASE_TICK - ONE_TICK)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('released by ratio on tick 21 640, from the absorb phase', releaseReasons)
      .atTick(W10_RELEASE_TICK)
      .toEqual(['ratio'])
      .expect('seat 0 ≈ 416.45 at the release', massOfSeat)
      .atTick(W10_RELEASE_TICK)
      .toBeCloseTo(W10_SEAT_MASS_AT_RELEASE, MASS_TOLERANCE)
      .expect(
        'below 1.1 × P',
        (view) => (massOfSeat(view) ?? Number.NaN) < absorption.ENGULF_RELEASE_RATIO * (massOf(view, 0) ?? 0),
      )
      .atTick(W10_RELEASE_TICK)
      .toBe(true)
      .expect('drained ≈ 78.42 in all', (view) => placedSeat(view)?.drainedMass)
      .atTick(W10_RELEASE_TICK)
      .toBeCloseTo(W10_SEAT_DRAINED_AT_RELEASE, MASS_TOLERANCE)
      .expect('P ≈ 379.51', (view) => massOf(view, 0))
      .atTick(W10_RELEASE_TICK)
      .toBeCloseTo(W10_PREY_MASS_AT_RELEASE, MASS_TOLERANCE)
      .expect('P alive and free', (view) => cellOf(view, 0)?.states)
      .atTick(W10_RELEASE_TICK)
      .toEqual([])
      .expect('seat 0 free with progress 0', (view) => [statesOfSeat(view), progressOfSeat(view)])
      .atTick(W10_RELEASE_TICK)
      .toEqual([[], 0])
      .expect('seat 0 re-pinned in full on the next tick', massOfSeat)
      .atTick(afterRelease)
      .toBeCloseTo(worldMassAtTick(afterRelease) * W10_SEAT_SPREAD, MASS_TOLERANCE)
      .expect('drainedMass 0 again', (view) => placedSeat(view)?.drainedMass)
      .atTick(afterRelease)
      .toBe(0)
      .expect('and, P still in contact, seat 0 starts on it again', statesOfSeat)
      .atTick(afterRelease)
      .toEqual([CELL_STATE.engulfing])
      .runDeterministic();
  });
});
