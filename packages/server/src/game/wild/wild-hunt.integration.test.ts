// The wild hunt through the whole step (docs/ecology/wild-cells.md §3.3.3, ticket #738): a hunter touching a prey that
// drifts away charges in and starts the engulf, where aiming at the prey's centre rides alongside it; and a hunter that
// cannot land its prey gives it up after `WILD_CELL_HUNT_GIVE_UP_SECONDS`, leaves it alone, and rests
// `WILD_CELL_HUNT_REST_SECONDS` before it hunts the next prey in sight.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, secondsToTicks, type BalanceConfig } from '@evolution/shared';
import { HUNTING_TICK, LUNCH_MASS, SECOND_PLAYER, THREAT_MASS, arena } from '../../testing/wild-arena.js';
import { TEST_PLAYER } from '../../testing/world-builders.js';
import type { PlayerIdentity } from '../session/players.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { speedCapOf } from '../simulation/movement.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import { runStep } from '../simulation/step.js';
import type { CellRecord } from '../world/entities.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';

/**
 * The prey drifts away at this share of the hunter's speed cap. Measured: the charge (2) starts the engulf on tick 21;
 * aiming at the centre never does within 10 s, at any share from 0.3 up.
 */
const DRIFT_SHARE_OF_HUNTER_CAP = 0.4;
/** The hunter's centre starts this many own radii behind the prey's: touching, its membrane short of the centre. */
const TOUCHING_GAP_RADII = 1.1;
/** How long the charge row waits for the engulf to start (s): about three times the charge's 21 ticks. */
const CHARGE_WINDOW_SECONDS = 1;
/** The give-up row keeps its prey this many hunter radii ahead, out of reach. */
const OUT_OF_REACH_RADII = 4;
/** The rest row's second prey, kept this many hunter radii behind it: in sight, but farther than the first. */
const FARTHER_PREY_RADII = 6;
const TICKS_PER_DRIFT_STEP = 1;

function withChargeRadii(radii: number): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE);
  balance.wildCells.WILD_CELL_HUNT_CHARGE_RADII = radii;
  return balance;
}

function withGiveUpSeconds(seconds: number): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE);
  balance.wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS = seconds;
  return balance;
}

/**
 * Seat 0 (mass 100) at the origin hunting the player (mass 20) east of it, in the hunting era; its size factor is set
 * so the settle keeps it at 100 (its base size is the world's mass times the factor).
 */
function chase(balance: BalanceConfig, gapRadii: number, players?: readonly PlayerIdentity[]) {
  const setup = arena({
    wildMass: THREAT_MASS,
    playerMass: LUNCH_MASS,
    playerAtRadii: gapRadii,
    tick: HUNTING_TICK,
    players,
  });
  const seat = setup.world.wildSeats[0]!;
  seat.sizeFactor = THREAT_MASS / worldReferenceAt(setup.world, HUNTING_TICK).worldMass;
  seat.fullMass = THREAT_MASS;
  seat.grownMass = 0;
  setup.world.balance = balance;
  return setup;
}

/** Steps `ticks` ticks, moving the prey east after each at `speed` wu/s (placed, not steered: it has no input). */
function stepWithPreyAt(world: WorldState, prey: CellRecord, ticks: number, place: (prey: CellRecord) => void): void {
  for (let count = 0; count < ticks; count += TICKS_PER_DRIFT_STEP) {
    runStep(world, world.balance, createInputRejectionCounters());
    place(prey);
  }
}

/** Ticks until the hunter starts engulfing the drifting prey, or `null` within the window. */
function ticksToEngulf(chargeRadii: number): number | null {
  const { world, wild, player } = chase(withChargeRadii(chargeRadii), TOUCHING_GAP_RADII);
  const drift = speedCapOf(wild, world, world.balance) * DRIFT_SHARE_OF_HUNTER_CAP;
  const drifting = (prey: CellRecord) => {
    prey.x += drift / secondsToTicks(1);
    prey.velocityX = drift;
    prey.velocityY = 0;
  };
  for (let tick = 1; tick <= secondsToTicks(CHARGE_WINDOW_SECONDS); tick += 1) {
    stepWithPreyAt(world, player, 1, drifting);
    if (wild.engulfingCellId === player.id) {
      return tick;
    }
  }
  return null;
}

describe('the wild hunt through the step (ticket #738)', () => {
  it('charges a prey drifting away and starts the engulf; aiming at its centre only rides alongside it', () => {
    expect(ticksToEngulf(DEFAULT_BALANCE.wildCells.WILD_CELL_HUNT_CHARGE_RADII)).not.toBeNull();
    expect(ticksToEngulf(0)).toBeNull();
  });

  it('gives up a prey it cannot land after WILD_CELL_HUNT_GIVE_UP_SECONDS, and does not hunt it again', () => {
    const { world, wild, player } = chase(DEFAULT_BALANCE, OUT_OF_REACH_RADII);
    const seat = world.wildSeats[0]!;
    const ahead = (prey: CellRecord) => {
      prey.x = wild.x + wild.radius * OUT_OF_REACH_RADII;
      prey.y = wild.y;
    };
    stepWithPreyAt(world, player, 1, ahead);
    expect(seat.huntPreyId).toBe(player.id);
    const giveUpTicks = secondsToTicks(DEFAULT_BALANCE.wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS);
    stepWithPreyAt(world, player, giveUpTicks - 1, ahead);
    expect(seat.huntPreyId).toBe(player.id);
    stepWithPreyAt(world, player, giveUpTicks, ahead);
    expect(seat.huntPreyId).toBeNull();
    expect(seat.givenUpPreyId).toBe(player.id);
    // Past the rest, with the given-up prey the only one in sight, it still does not hunt it.
    const decisionAfterTheRest =
      seat.huntRestUntilTick + secondsToTicks(DEFAULT_BALANCE.wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS);
    stepWithPreyAt(world, player, decisionAfterTheRest - world.tick, ahead);
    expect(seat.huntPreyId).toBeNull();
  });

  it('keeps hunting that prey while the give-up is longer than the chase', () => {
    const patient = withGiveUpSeconds(DEFAULT_BALANCE.session.ROUND_DURATION_SECONDS);
    const { world, wild, player } = chase(patient, OUT_OF_REACH_RADII);
    const ahead = (prey: CellRecord) => {
      prey.x = wild.x + wild.radius * OUT_OF_REACH_RADII;
      prey.y = wild.y;
    };
    stepWithPreyAt(world, player, 2 * secondsToTicks(DEFAULT_BALANCE.wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS), ahead);
    expect(world.wildSeats[0]!.huntPreyId).toBe(player.id);
    expect(world.wildSeats[0]!.givenUpPreyId).toBeNull();
  });

  it('rests WILD_CELL_HUNT_REST_SECONDS after a give-up before it hunts the next prey in sight', () => {
    const { world, wild, player } = chase(DEFAULT_BALANCE, OUT_OF_REACH_RADII, [TEST_PLAYER, SECOND_PLAYER]);
    const second = world.cells[1]!;
    setCellMass(second, LUNCH_MASS, world.balance);
    const bothOutOfReach = () => {
      player.x = wild.x + wild.radius * OUT_OF_REACH_RADII;
      player.y = wild.y;
      second.x = wild.x - wild.radius * FARTHER_PREY_RADII;
      second.y = wild.y;
    };
    bothOutOfReach();
    const seat = world.wildSeats[0]!;
    const { wildCells } = DEFAULT_BALANCE;
    const giveUpTicks = secondsToTicks(wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS);
    const restTicks = secondsToTicks(wildCells.WILD_CELL_HUNT_REST_SECONDS);
    // The first decision (tick 1 here) hunts the nearer prey; it is given up on that tick + giveUpTicks.
    stepWithPreyAt(world, player, 1 + giveUpTicks + restTicks - 1, bothOutOfReach);
    expect(seat.givenUpPreyId).toBe(player.id);
    expect(seat.huntPreyId).toBeNull();
    stepWithPreyAt(world, player, 1, bothOutOfReach);
    expect(seat.huntPreyId).toBe(second.id);
  });
});
