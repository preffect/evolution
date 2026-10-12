// docs/ecology/acceptance.md §8.2, the giants that run of slice 3 (giants.md §3.5.4, §3.5.5, §3.5.17), each run twice
// and hash-compared: G7 (the hunter and the drifter flee, the drifter sprinting under a plain cell's cruise) and G10
// (the diatom's armour, swallowed before its first decision so it never gets to flee). The placed rows run on seed 48
// (docs/testing/scenario-runner.md §8.1).

import { describe, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GIANT_SPECIES,
  canEngulf,
  radiusForMass,
  type GiantSpecies,
  type Vec2,
} from '@evolution/shared';
import { cellOf, giantCellOf, massOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { player, targetPoint } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { decayed, placedSolo, type EvolutionScenarioBuilder } from './shared-setups.js';
import {
  AMOEBA_DECISION_TICK,
  DIATOM_DECISION_TICK,
  giantAndA,
  giantHeadingErrorFrom,
  giantSpeedOf,
  giantTarget,
} from './giant-setups.js';
import { HEADING_TOLERANCE_DEGREES } from './wild-setups.js';

const { absorption, controls, growth } = DEFAULT_BALANCE;
const { amoeba: AMOEBA, diatom: DIATOM } = GIANT_SPECIES;
const ONE_TICK = 1;
const WEST: Vec2 = { x: -1, y: 0 };
/** "Its speed never exceeds" the cap: a hair over it for the float sum. */
const SPEED_CAP_SLACK = 1e-9;

/** G7: A at 1 300 600 wu east of the amoeba born 1 000; at 1 700 600 wu east of the diatom born 1 200. */
const G7_AMOEBA_BORN_MASS = 1000;
const G7_AMOEBA = { species: AMOEBA, bornMass: G7_AMOEBA_BORN_MASS };
const G7_AMOEBA_THREAT_MASS = 1300;
const G7_DIATOM_BORN_MASS = 1200;
const G7_DIATOM = { species: DIATOM, bornMass: G7_DIATOM_BORN_MASS };
const G7_DIATOM_THREAT_MASS = 1700;
const G7_THREAT_EAST_WU = 600;
/**
 * The sprint variant: a flee sprint is taken only when the threat's own sprint would land (`isFleeSprintWorthwhile`,
 * the #594 review), which an idle threat's never does from outside engulf contact (its steer eases off as its target
 * nears its own centre). So A at 1 800 (1 710 after paying its sprint, still ≥ 1.40 × 1 200) starts 200 wu east and
 * charges west from tick 1: about 148 wu off on tick 26 and closing at full throttle, so its sprint would land.
 */
const G7_SPRINT_THREAT_MASS = 1800;
const G7_SPRINT_THREAT_EAST_WU = 200;
const CHARGE_WEST: Vec2 = { x: -BROTH_POINT.x * 2, y: 0 };
const G7_READ_AFTER_TICKS = 60;
/** 220 × 0.7, 220 × 0.9215 × 0.6 and that × 1.8 (no Mitochondrion): G8's speeds. */
const AMOEBA_CRUISE = 154;
const DIATOM_CRUISE = 121.638;
const DIATOM_SPRINT = 218.948;
/** G10: A at 1 650 (under 1.40 × 1 200) or 1 700 (over), the diatom born 1 200 10 wu east. */
const G10_DIATOM_BORN_MASS = 1200;
const G10_UNDER_ARMOUR_MASS = 1650;
const G10_OVER_ARMOUR_MASS = 1700;
const G10_GAP_WU = 10;
const G10_READ_TICK = 60;
const G10_VARIANT_READ_TICK = 10;
/** The spines drain 2 % of the diatom's mass a second: 1 200 × 0.02 / 60 = 0.4 a tick. */
const G10_SPINE_DRAIN_PER_TICK = 0.4;
/** The engulf starts on tick 1 (step 6); the spines drain from the next tick's engulf step. */
const G10_ENGULF_START_TICK = 1;
const SPINE_TOLERANCE = 0.01;
const TARGET_TOLERANCE_WU = 0.01;

/** "Its speed never exceeds `cap`" on every tick through `lastTick`. */
function speedNeverExceeds(run: EvolutionScenarioBuilder, species: GiantSpecies, cap: number, lastTick: number) {
  for (let tick = ONE_TICK; tick <= lastTick; tick += 1) {
    run
      .expect(`speed ≤ ${cap} on tick ${tick}`, giantSpeedOf(species))
      .atTick(tick)
      .toBeAtMost(cap + SPEED_CAP_SLACK);
  }
  return run;
}

describe('ecology/acceptance.md §8.2: the hunter and the drifter flee (G7)', () => {
  it('G7: the amoeba flees A (1 298.98 ≥ 1 250) on tick 24 to 2 radii west, no sprint, never over 154 wu/s', async () => {
    const readTick = AMOEBA_DECISION_TICK + G7_READ_AFTER_TICKS;
    const run = giantAndA('G7', G7_AMOEBA, { mass: G7_AMOEBA_THREAT_MASS, eastWu: G7_THREAT_EAST_WU })
      .advance(readTick)
      .expect('target = (1247.02, 0)', giantTarget(AMOEBA))
      .atTick(AMOEBA_DECISION_TICK)
      .toSatisfy((target) => isCloseTo(target, fleeTargetWest(G7_AMOEBA_BORN_MASS)), '2 radii west of its centre')
      .expect('no sprint (600 > 4 × 126.49)', (view) => giantCellOf(view, AMOEBA)?.sprintRemainingTicks)
      .atTick(AMOEBA_DECISION_TICK)
      .toBe(0)
      .expect('heading west within 5° by tick 84', giantHeadingErrorFrom(AMOEBA, WEST))
      .atTick(readTick)
      .toBeAtMost(HEADING_TOLERANCE_DEGREES);
    await speedNeverExceeds(run, AMOEBA, AMOEBA_CRUISE, readTick).runDeterministic();
  });

  it('G7 (drifter): the diatom flees A (≥ 1.40 × 1 200) on tick 26, no sprint, never over 121.638 wu/s', async () => {
    const readTick = DIATOM_DECISION_TICK + G7_READ_AFTER_TICKS;
    const run = giantAndA('G7 drifter', G7_DIATOM, { mass: G7_DIATOM_THREAT_MASS, eastWu: G7_THREAT_EAST_WU })
      .advance(readTick)
      .expect('target = (1222.87, 0)', giantTarget(DIATOM))
      .atTick(DIATOM_DECISION_TICK)
      .toSatisfy((target) => isCloseTo(target, fleeTargetWest(G7_DIATOM_BORN_MASS)), '2 radii west of its centre')
      .expect('no sprint (600 > 4 × 138.56)', (view) => giantCellOf(view, DIATOM)?.sprintRemainingTicks)
      .atTick(DIATOM_DECISION_TICK)
      .toBe(0)
      .expect('heading west within 5° by tick 86', giantHeadingErrorFrom(DIATOM, WEST))
      .atTick(readTick)
      .toBeAtMost(HEADING_TOLERANCE_DEGREES);
    await speedNeverExceeds(run, DIATOM, DIATOM_CRUISE, readTick).runDeterministic();
  });

  it('G7 (drifter sprint): A at 1 800 charging from 200 wu east: it flees sprinting, never over 218.948 wu/s', async () => {
    const readTick = DIATOM_DECISION_TICK + G7_READ_AFTER_TICKS;
    const run = giantAndA('G7 sprint', G7_DIATOM, { mass: G7_SPRINT_THREAT_MASS, eastWu: G7_SPRINT_THREAT_EAST_WU })
      .atTick(ONE_TICK, player(0).does(targetPoint(CHARGE_WEST.x, CHARGE_WEST.y)))
      .advance(readTick)
      .expect('not engulfed when it decides', (view) => giantCellOf(view, DIATOM)?.engulfedByCellId)
      .atTick(DIATOM_DECISION_TICK)
      .toBeNull()
      .expect('sprinting from its decision', (view) => giantCellOf(view, DIATOM)?.sprintRemainingTicks)
      .atTick(DIATOM_DECISION_TICK)
      .toBeGreaterThan(0)
      .expect('not before it', (view) => giantCellOf(view, DIATOM)?.sprintRemainingTicks)
      .atTick(DIATOM_DECISION_TICK - ONE_TICK)
      .toBe(0);
    await speedNeverExceeds(run, DIATOM, DIATOM_SPRINT, readTick).runDeterministic();
  });
});

describe("ecology/acceptance.md §8.2: the diatom's armour (G10)", () => {
  it('G10: A at 1 650 (< 1.40 × 1 200) has no ring on the diatom and starts no engulf in 60 ticks', async () => {
    await placedSolo('G10')
      .placeCell({ playerIndex: 0, mass: G10_UNDER_ARMOUR_MASS })
      .placeGiant({ species: DIATOM, bornMass: G10_DIATOM_BORN_MASS, eastOfFirstCellWu: G10_GAP_WU })
      .advance(G10_READ_TICK)
      .expect('canEngulf(A, diatom) false on tick 0', aCanEngulfDiatom)
      .atTick(0)
      .toBe(false)
      .expect('no engulf in 60 ticks', (view) => giantCellOf(view, DIATOM)?.engulfedByCellId)
      .atTick(G10_READ_TICK)
      .toBeNull()
      .runDeterministic();
  });

  it('G10 (A at 1 700): edible on tick 0, swallowed from tick 1 before its first decision, the spines draining A', async () => {
    await placedSolo('G10 1700')
      .placeCell({ playerIndex: 0, mass: G10_OVER_ARMOUR_MASS })
      .placeGiant({ species: DIATOM, bornMass: G10_DIATOM_BORN_MASS, eastOfFirstCellWu: G10_GAP_WU })
      .advance(G10_VARIANT_READ_TICK)
      .expect('canEngulf(A, diatom) on tick 0', aCanEngulfDiatom)
      .atTick(0)
      .toBe(true)
      .expect(
        'engulfed by A from tick 1',
        (view) => giantCellOf(view, DIATOM)?.engulfedByCellId === cellOf(view, 0)?.id,
      )
      .atTick(ONE_TICK)
      .toBe(true)
      .expect('A loses 0.4 a tick to the spines on top of its decay', (view) => {
        const mass = massOf(view, 0);
        return mass === undefined ? undefined : decayed(G10_OVER_ARMOUR_MASS, G10_VARIANT_READ_TICK) - mass;
      })
      .atTick(G10_VARIANT_READ_TICK)
      .toBeCloseTo(G10_SPINE_DRAIN_PER_TICK * spineDrainTicks(G10_VARIANT_READ_TICK), SPINE_TOLERANCE)
      .runDeterministic();
  });
});

/** Own centre + 2 radii west: the flee target from a threat due east. */
function fleeTargetWest(bornMass: number): Vec2 {
  const radius = radiusForMass(bornMass, growth);
  return { x: BROTH_POINT.x - controls.STEER_FULL_THROTTLE_RADII * radius, y: BROTH_POINT.y };
}

function isCloseTo(actual: Vec2 | undefined, expected: Vec2): boolean {
  return (
    actual !== undefined &&
    Math.abs(actual.x - expected.x) <= TARGET_TOLERANCE_WU &&
    Math.abs(actual.y - expected.y) <= TARGET_TOLERANCE_WU
  );
}

function aCanEngulfDiatom(view: EvolutionView): boolean {
  const eater = cellOf(view, 0);
  const diatom = giantCellOf(view, DIATOM);
  return eater !== undefined && diatom !== undefined && canEngulf(eater, diatom, absorption);
}

/** The ticks the spines have drained A through `tick`: from tick 2, the first tick of the running engulf after its start. */
function spineDrainTicks(tick: number): number {
  return tick - G10_ENGULF_START_TICK;
}
