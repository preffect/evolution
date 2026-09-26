// docs/ecology/mass-and-movement.md §5.3 and docs/ecology/absorption.md §6.3 ("near-equal cells only push apart"): two
// protocells of equal mass charging each other at full throttle never pass through each other (#709): on the axis,
// just off it, at 45°, sprinting, and sprinting on the top sprint trait. Before #709 the on-axis pair crossed in one
// tick and every off-axis pair settled about 80 % overlapped and pivoted through itself within a few ticks; now the
// centres stay `CELL_MIN_CENTRE_DISTANCE_FRACTION` of the radii's sum apart (one radius for an equal pair: neither
// centre enters the other cell), and a pair that would cross within one tick is pushed back to its own side.

import { describe, it } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, TICK_HZ } from '@evolution/shared';
import {
  PLACED_ROW_SEED,
  evolutionScenario as scenario,
  type EvolutionScenarioSnapshot,
} from '../gameplay/evolution-adapter.js';
import { cellOf, distanceBetweenCells, type EvolutionView } from '../gameplay/evolution-views.js';
import { combineScripts, createScriptedStrategy, sprint, type PlayerScript } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { FULL_THROTTLE_RADII } from './shared-setups.js';

/** Two protocells of equal mass (ratio 1, under every engulf ratio), 100 wu apart on the broth line. */
const CHARGER_MASS = DEFAULT_BALANCE.growth.CELL_STARTING_MASS;
const CHARGER_GAP_WU = 100;
const COLLISION_TICKS = 3 * TICK_HZ;
/** The pair is symmetric: the midpoint of the centres never moves. */
const MIDPOINT_TOLERANCE_WU = 1e-6;
const MINIMUM_CENTRE_DISTANCE_FRACTION = DEFAULT_BALANCE.growth.CELL_MIN_CENTRE_DISTANCE_FRACTION;
/** The float noise of the push that lands a pair exactly on the minimum centre distance. */
const DISTANCE_TOLERANCE_WU = 1e-9;

/** "Charges the other player": full throttle through the other player's centre, re-aimed every tick. */
const chargeTheOtherPlayer: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const self = context.cell;
  const other = context.snapshot.cells.find(
    (cell) => cell.kind === CELL_KIND.player && cell.playerId !== context.actorId,
  );
  if (self === undefined || other === undefined) {
    return null;
  }
  const distance = Math.hypot(other.x - self.x, other.y - self.y);
  const reach = (FULL_THROTTLE_RADII * self.radius) / distance;
  return { targetX: self.x + (other.x - self.x) * reach, targetY: self.y + (other.y - self.y) * reach };
};

/** The top sprint trait (tier III simple flagellum): the fastest closing a pair can reach, past the centre-distance cap. */
const TOP_SPRINT_TRAIT = { traitId: 'simple_flagellum', tier: 3 } as const;
/** A 1 wu sideways offset: the smallest asymmetry that let the pair pivot through itself before the depth cap. */
const OFF_AXIS_WU = 1;
const DIAGONAL_RADIANS = Math.PI / 4;

interface ChargeRow {
  readonly name: string;
  /** B's placement relative to A's centre (wu). */
  readonly offset: { readonly x: number; readonly y: number };
  readonly isSprinting: boolean;
  readonly traits: readonly (typeof TOP_SPRINT_TRAIT)[];
  /**
   * On the axis nothing turns the pair, so each keeps its side for good. Off it, the pair pressed together at the
   * minimum distance rolls round itself (the steer lags the turning centre line): it slides past, never through.
   */
  readonly isOnAxis: boolean;
}

const CHARGE_ROWS: readonly ChargeRow[] = [
  { name: 'on the axis', offset: { x: CHARGER_GAP_WU, y: 0 }, isSprinting: false, traits: [], isOnAxis: true },
  {
    name: `${OFF_AXIS_WU} wu off the axis`,
    offset: { x: CHARGER_GAP_WU, y: OFF_AXIS_WU },
    isSprinting: false,
    traits: [],
    isOnAxis: false,
  },
  {
    name: 'at 45°',
    offset: { x: CHARGER_GAP_WU * Math.cos(DIAGONAL_RADIANS), y: CHARGER_GAP_WU * Math.sin(DIAGONAL_RADIANS) },
    isSprinting: false,
    traits: [],
    isOnAxis: false,
  },
  {
    name: 'both sprinting',
    offset: { x: CHARGER_GAP_WU, y: OFF_AXIS_WU },
    isSprinting: true,
    traits: [],
    isOnAxis: false,
  },
  {
    name: 'both sprinting on the top sprint trait',
    offset: { x: CHARGER_GAP_WU, y: 0 },
    isSprinting: true,
    traits: [TOP_SPRINT_TRAIT],
    isOnAxis: true,
  },
];

/** How far B's centre lies ahead of A's along the line they were placed on: positive while each keeps its side. */
function gapAlongPlacement(view: EvolutionView, row: ChargeRow): number {
  const west = cellOf(view, 0);
  const east = cellOf(view, 1);
  if (west === undefined || east === undefined) {
    return 0;
  }
  return ((east.x - west.x) * row.offset.x + (east.y - west.y) * row.offset.y) / Math.hypot(row.offset.x, row.offset.y);
}

function chargingPair(row: ChargeRow) {
  const charger = row.isSprinting ? combineScripts([chargeTheOtherPlayer, sprint()]) : chargeTheOtherPlayer;
  const createCharger = createScriptedStrategy('charger', charger);
  return scenario(`two chargers never cross: ${row.name}`)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: CHARGER_MASS, traits: row.traits })
    .placeCell({
      playerIndex: 1,
      mass: CHARGER_MASS,
      traits: row.traits,
      at: { x: BROTH_POINT.x + row.offset.x, y: BROTH_POINT.y + row.offset.y },
    })
    .bot(0, createCharger)
    .bot(1, createCharger)
    .advance(COLLISION_TICKS);
}

/** Where the two centres are, less the minimum centre distance of §5.3: never below 0 at the end of a tick. */
function distancePastMinimum(view: EvolutionView): number {
  const west = cellOf(view, 0);
  const east = cellOf(view, 1);
  const distance = distanceBetweenCells(view, 0, 1);
  if (west === undefined || east === undefined || distance === undefined) {
    return -Infinity;
  }
  return distance - (west.radius + east.radius) * MINIMUM_CENTRE_DISTANCE_FRACTION;
}

describe('ecology/mass-and-movement.md §5.3: two equal cells charging each other (#709)', () => {
  it.each(CHARGE_ROWS)('$name: never through each other, in contact, midpoint held', async (row) => {
    const run = chargingPair(row);
    for (let tick = 1; tick <= COLLISION_TICKS; tick += 1) {
      run
        .expect(`no closer than the minimum centre distance on tick ${tick}`, distancePastMinimum)
        .atTick(tick)
        .toBeGreaterThan(-DISTANCE_TOLERANCE_WU);
      if (row.isOnAxis) {
        run
          .expect(`each keeps its side on tick ${tick}`, (view) => gapAlongPlacement(view, row))
          .atTick(tick)
          .toBeGreaterThan(0);
      }
    }
    await run
      .expect('they are in contact', (view) => {
        const west = cellOf(view, 0);
        const east = cellOf(view, 1);
        return (west?.radius ?? 0) + (east?.radius ?? 0) - (distanceBetweenCells(view, 0, 1) ?? Infinity);
      })
      .atEnd()
      .toBeGreaterThan(0)
      .expect('the midpoint never moved', (view) => [
        ((cellOf(view, 0)?.x ?? 0) + (cellOf(view, 1)?.x ?? 0)) / 2,
        ((cellOf(view, 0)?.y ?? 0) + (cellOf(view, 1)?.y ?? 0)) / 2,
      ])
      .atEnd()
      .toSatisfy(
        (midpoint) =>
          Math.hypot(
            (midpoint as number[])[0]! - (BROTH_POINT.x + row.offset.x / 2),
            (midpoint as number[])[1]! - (BROTH_POINT.y + row.offset.y / 2),
          ) < MIDPOINT_TOLERANCE_WU,
        'within the tolerance of the placed midpoint',
      )
      .runDeterministic();
  });
});
