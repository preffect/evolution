// docs/ecology/acceptance.md §8.1, the evolving-world rows that run the clock into a later era (W3, W6, W9),
// each run twice and hash-compared. The first-minute rows are ecology-wild.gameplay.test.ts.
//
// The placed rows (W6, W10) place A at the broth point at setup, which vacates the seeded seats and switches the
// spawns off from tick 0 (docs/testing/scenario-runner.md §8.1): the idle A meets nothing before the fixture re-places
// it at the era tick and seats seat 0 on demand beside it. The seeded rows (W3, W9) keep every seeded seat.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  TICK_HZ,
  ZONE_ID,
  bacteriumVariantWeightsForZone,
} from '@evolution/shared';
import { cellOf, effectsOfKind } from '../gameplay/evolution-views.js';
import { BROTH_POINT, ZONE } from '../gameplay/placement.js';
import { foodSpawnedSince, placedSolo, seededSolo } from './shared-setups.js';
import {
  EUKARYOTE_TICK,
  HEADING_TOLERANCE_DEGREES,
  HUNTING_TICK,
  PLACED_SEAT,
  RUNS_PER_ROW,
  WILD_WINDOW_TICKS,
  WORLD_LEVEL_TICKS,
  WORLD_SIZE,
  algaeShareOf,
  areSeatsWithinBounds,
  distanceFromSeat,
  everyWildCellAtLevel,
  headingErrorOfSeat,
  heldWindow,
  placedSeatCell,
  targetOfSeat,
} from './wild-setups.js';

const { ecology, growth, wildCells } = DEFAULT_BALANCE;
const ONE_TICK = 1;
/** W3: the world's mass after tick 10 799 (199.983) and after 10 800 (200); the row's ± 0.01. */
const W3_MASS_BEFORE_LEVEL = 199.983;
const W3_MASS_AT_LEVEL = 200;
const W3_TOLERANCE = 0.01;
/**
 * W3: since #710 (nothing rides past the rim) no wild cell eats the idle player in or near the window: the budget is
 * 351.17, so "between 351 and 355". Across seeds 1–11, 3 of 11 windows hold one death (348–352) and the rest none
 * (351–354). From #677 to #710 the pinned seed held one death, on tick 12 365 (348–352); before #677 its death fell
 * just before the window (tick 10 667, 48 spectate ticks inside: 350–354); #638's run had none near it (351–355).
 */
const W3_DEATHS_IN_WINDOW = 0;
const W3_SPAWNED_LOW = 351;
const W3_SPAWNED_HIGH = 355;
/**
 * W3 on the pinned seed: 271 algae in 351 motes, 0.772 since ticket #738 (a wild hunter charges a prey it touches
 * until its engulf starts, so the seats eat each other more and move differently); 0.715 from #737 (a wild cell
 * leaves a prey to a closer rival; 251 in 351); 0.675 from #710 (239 in 354;
 * the 0.70 row; the window's σ is ≈ 0.07; 0.713 from #677, 0.700 before).
 */
const W3_ALGAE_SHARE_ON_SEED = 0.772;
/**
 * W9: since ticket #738 (a wild hunter charges a prey it touches until its engulf starts) the hunting-era seats eat
 * the idle player twice in the window, the second on tick 35 315, whose spectate runs 94 ticks before the window
 * ends: 526.75 − 182 / 60 × 1.5 − 94 / 60 × 1.5 = 519.85 → "between 519 and 523"; algae share on the seed
 * 284 in 519, 0.547. From #737 (a wild cell leaves a prey to a closer rival) to #738 four times: 508–512, 270 in 510,
 * 0.529. From #710 (nothing rides past the rim) to #737 none did:
 * 526–530, 301 in 526, 0.572. Across seeds 1–11 the window held 1 to 3 deaths (513–526), each count inside its own
 * budget's bound (0.542 from #677, three deaths, 513–517; 0.516 from #634, two deaths, 517–521; none before). The `eukaryote` row is 0.50, but the window's σ is
 * ≈ 0.07 (W3), so since #710 the share is pinned to the seed, never to a band (0.50 ± 0.06 until then). That the
 * spawner draws the `eukaryote` row at all is held by `spawner.test.ts` (20 000 motes, 0.50 ± 0.03).
 */
const W9_DEATHS_IN_WINDOW = 2;
const W9_SPAWNED_LOW = 519;
const W9_SPAWNED_HIGH = 523;
const W9_ALGAE_SHARE_ON_SEED = 0.547;
/** A seed's share is one number: the tolerance only absorbs the rounding of the literal the row states (± 0.001). */
const SEED_SHARE_TOLERANCE = 0.001;
/** W6: seat 0 at mass 380 (radius 77.97) and A at 20, pinned, 390 wu east; the velocity read 60 ticks on. */
const W6_PREY_MASS = 20;
const W6_PREY_EAST_WU = 390;
const W6_SETTLE_TICKS = 60;
/** 21 570: one decision interval (30 ticks) before the hunting era. */
const W6_EARLY_TICK = HUNTING_TICK - wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS * TICK_HZ;
const W6_PREY_CENTRE = { x: BROTH_POINT.x + W6_PREY_EAST_WU, y: BROTH_POINT.y };
/** The same A 700 wu east: past seat 0's sight of 626.3 wu. */
const W6_FAR_PREY_EAST_WU = 700;
const W6_FAR_PREY_CENTRE = { x: BROTH_POINT.x + W6_FAR_PREY_EAST_WU, y: BROTH_POINT.y };
/** W6: A at the broth point from tick 0 (spawns off), seat 0 and A re-placed by the fixture at `tick`. */
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
      .expect(
        'fullMass in [base, max(base, 3 × 199.983)], mass in [min(20, base), fullMass + meals] after tick 10 799',
        areSeatsWithinBounds(W3_MASS_BEFORE_LEVEL, W3_TOLERANCE),
      )
      .atTick(levelTick - ONE_TICK)
      .toBe(true)
      .expect('no world_level_up yet', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atTick(levelTick - ONE_TICK)
      .toEqual([])
      .expect(
        'every wild cell level 2 with nucleoid I, prokaryote, after tick 10 800',
        everyWildCellAtLevel(2, CELL_STAGE.prokaryote, ['nucleoid']),
      )
      .atTick(levelTick)
      .toBe(true)
      .expect(
        'the same bounds on base size 200 × size after tick 10 800',
        areSeatsWithinBounds(W3_MASS_AT_LEVEL, W3_TOLERANCE),
      )
      .atTick(levelTick)
      .toBe(true)
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
    // The seed's own draw of the 0.70 row (docs/ecology/acceptance.md §8.1 W3), with no death in the window.
    expect(counts.deaths).toBe(RUNS_PER_ROW * W3_DEATHS_IN_WINDOW);
    expect(Math.abs(algaeShareOf(counts) - W3_ALGAE_SHARE_ON_SEED)).toBeLessThanOrEqual(SEED_SHARE_TOLERANCE);
  });

  it('W9: the eukaryote bloom spawns 519–523 motes in the window (2 deaths) at the 50 % algae row; the variant table', async () => {
    const run = seededSolo('W9').advance(EUKARYOTE_TICK + WILD_WINDOW_TICKS + ONE_TICK);
    const { counts, windowEnd } = heldWindow(run, EUKARYOTE_TICK + ONE_TICK);
    await run
      .expect('motes spawned in the window', foodSpawnedSince('food at window start'))
      .atTick(windowEnd)
      .toBeBetween(W9_SPAWNED_LOW, W9_SPAWNED_HIGH)
      .runDeterministic();
    // Seats eat the idle player 4 times in the window on this seed; each spectate takes the per-player rate off the budget.
    expect(counts.deaths).toBe(RUNS_PER_ROW * W9_DEATHS_IN_WINDOW);
    expect(ecology.FOOD_KIND_WEIGHTS_BY_WORLD_STAGE.eukaryote).toEqual({ algae: 0.5, bacterium: 0.5 });
    expect(Math.abs(algaeShareOf(counts) - W9_ALGAE_SHARE_ON_SEED)).toBeLessThanOrEqual(SEED_SHARE_TOLERANCE);
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
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: WORLD_SIZE, at: ZONE.broth })
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
      .expect('no sprint on tick 21 600 (390 > 3 × 77.97)', (view) => placedSeatCell(view)?.sprintRemainingTicks)
      .atTick(HUNTING_TICK)
      .toBe(0)
      .expect('the distance has shrunk', (view) => distanceFromSeat(view, 0))
      .atTick(HUNTING_TICK + W6_SETTLE_TICKS)
      .toBeLessThan(W6_PREY_EAST_WU)
      .runDeterministic();
    await eraRow('W6 one interval early')
      .atTick(W6_EARLY_TICK)
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: WORLD_SIZE, at: ZONE.broth })
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
    await eraRow('W6 out of sight')
      .atTick(HUNTING_TICK)
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: WORLD_SIZE, at: ZONE.broth })
      .atTick(HUNTING_TICK)
      .placeCell({ playerIndex: 0, mass: W6_PREY_MASS, isPinned: true, at: W6_FAR_PREY_CENTRE })
      .advance(HUNTING_TICK)
      .expect("A 700 wu east is out of sight (626.3): a wander target, not A's centre", targetOfSeat)
      .atTick(HUNTING_TICK)
      .toSatisfy(
        (target) => target !== undefined && (target.x !== W6_FAR_PREY_CENTRE.x || target.y !== W6_FAR_PREY_CENTRE.y),
        "a target that is not A's centre",
      )
      .runDeterministic();
  });
});
