// docs/ecology/wild-cells.md §3.3.3, ticket #738: the hunt's give-up at its boundary (exactly
// `WILD_CELL_HUNT_GIVE_UP_SECONDS` after the hunt began, one tick earlier), never while engulfing, and the hunt's clock
// kept for the same prey and restarted for a new one; the rest after a give-up, to the tick. docs/ecology/acceptance.md
// §8.2 G13: a giant seat's profile gives up after `GIANT_HUNT_GIVE_UP_SECONDS` and rests as long as a wild seat.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, entityId, secondsToTicks } from '@evolution/shared';
import { LUNCH_MASS, THREAT_MASS, arena } from '../../testing/wild-arena.js';
import { seatTestGiantCell } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { giantSeatProfile, wildSeatProfile } from './seat-profile.js';
import { giveUpStaleHunt, isHuntResting, isHuntStale, latchHunt } from './wild-hunt-give-up.js';

const WILD_HUNT = wildSeatProfile(DEFAULT_BALANCE).hunt;
const GIANT_HUNT = giantSeatProfile(GIANT_SPECIES.amoeba, DEFAULT_BALANCE).hunt;

const GIVE_UP_TICKS = secondsToTicks(DEFAULT_BALANCE.wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS);
const REST_TICKS = secondsToTicks(DEFAULT_BALANCE.wildCells.WILD_CELL_HUNT_REST_SECONDS);
const HUNT_START_TICK = 100;
const OTHER_PREY = entityId('c-other');

/** Seat 0 hunting the player since `HUNT_START_TICK`. */
function hunting() {
  const setup = arena({ wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: 5 });
  const seat = setup.world.wildSeats[0]!;
  latchHunt(seat, setup.player.id, HUNT_START_TICK);
  return { ...setup, seat };
}

describe('isHuntStale', () => {
  it('is stale exactly WILD_CELL_HUNT_GIVE_UP_SECONDS after the hunt began, not one tick earlier', () => {
    const { seat, wild } = hunting();
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, WILD_HUNT)).toBe(false);
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS, WILD_HUNT)).toBe(true);
  });

  it('is never stale while the hunter engulfs, nor without a hunt', () => {
    const { seat, wild, player } = hunting();
    beginEngulf({ predator: wild, prey: player });
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS, WILD_HUNT)).toBe(false);
    const idle = hunting();
    idle.seat.huntPreyId = null;
    expect(isHuntStale(idle.seat, idle.wild, HUNT_START_TICK + GIVE_UP_TICKS, WILD_HUNT)).toBe(false);
  });
});

describe('giveUpStaleHunt', () => {
  it('ends a stale hunt and remembers its prey; leaves a fresh one alone', () => {
    const fresh = hunting();
    giveUpStaleHunt(fresh.seat, fresh.wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, WILD_HUNT);
    expect(fresh.seat.huntPreyId).toBe(fresh.player.id);
    expect(fresh.seat.givenUpPreyId).toBeNull();
    const stale = hunting();
    giveUpStaleHunt(stale.seat, stale.wild, HUNT_START_TICK + GIVE_UP_TICKS, WILD_HUNT);
    expect(stale.seat.huntPreyId).toBeNull();
    expect(stale.seat.givenUpPreyId).toBe(stale.player.id);
  });
});

describe('isHuntResting', () => {
  it('rests from the give-up for WILD_CELL_HUNT_REST_SECONDS, and not one tick longer', () => {
    const { seat, wild } = hunting();
    const giveUpTick = HUNT_START_TICK + GIVE_UP_TICKS;
    expect(isHuntResting(seat, giveUpTick)).toBe(false);
    giveUpStaleHunt(seat, wild, giveUpTick, WILD_HUNT);
    expect(isHuntResting(seat, giveUpTick)).toBe(true);
    expect(isHuntResting(seat, giveUpTick + REST_TICKS - 1)).toBe(true);
    expect(isHuntResting(seat, giveUpTick + REST_TICKS)).toBe(false);
  });

  it('never rests after a fresh hunt that was not given up', () => {
    const { seat, wild } = hunting();
    giveUpStaleHunt(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, WILD_HUNT);
    expect(isHuntResting(seat, HUNT_START_TICK + GIVE_UP_TICKS - 1)).toBe(false);
  });
});

describe('latchHunt', () => {
  it('keeps the clock for the same prey and restarts it for another', () => {
    const { seat, player } = hunting();
    latchHunt(seat, player.id, HUNT_START_TICK + 1);
    expect(seat.huntStartTick).toBe(HUNT_START_TICK);
    latchHunt(seat, OTHER_PREY, HUNT_START_TICK + 2);
    expect(seat.huntStartTick).toBe(HUNT_START_TICK + 2);
    expect(seat.huntPreyId).toBe(OTHER_PREY);
  });
});

/** G13: "a hunt of P began on tick 24": decision ticks 474 (7.5 s on) and 504 (8 s on); the wild seat's 324 (5 s on). */
const G13_HUNT_START_TICK = 24;
const G13_GOES_ON_TICK = 474;
const G13_GIANT_GIVE_UP_TICK = 504;
const G13_WILD_GIVE_UP_TICK = 324;
const G13_REST_UNTIL_TICK = 1404;
const AMOEBA_BORN_MASS = 1000;
const AMOEBA_AT = { x: -1000, y: 0 };

describe('giveUpStaleHunt for a giant seat (G13)', () => {
  /** The amoeba in its own seat, hunting the player since tick 24. */
  function amoebaHunting() {
    const world = createTestWorld();
    const player = world.cells[0]!;
    const amoeba = seatTestGiantCell(world, {
      species: GIANT_SPECIES.amoeba,
      at: AMOEBA_AT,
      bornMass: AMOEBA_BORN_MASS,
    });
    latchHunt(amoeba.seat, player.id, G13_HUNT_START_TICK);
    return { ...amoeba, player };
  }

  it('goes on at 7.5 s and ends at 8 s, resting the wild 15 s (until 1 404)', () => {
    const { seat, cell, player } = amoebaHunting();
    giveUpStaleHunt(seat, cell, G13_GOES_ON_TICK, GIANT_HUNT);
    expect([seat.huntPreyId, seat.givenUpPreyId]).toEqual([player.id, null]);
    giveUpStaleHunt(seat, cell, G13_GIANT_GIVE_UP_TICK, GIANT_HUNT);
    expect([seat.huntPreyId, seat.givenUpPreyId, seat.huntRestUntilTick]).toEqual([
      null,
      player.id,
      G13_REST_UNTIL_TICK,
    ]);
  });

  it('a wild seat with the same hunt ends it at 5 s, as before, where the giant goes on', () => {
    const { seat, wild, player } = hunting();
    latchHunt(seat, null, G13_HUNT_START_TICK);
    latchHunt(seat, player.id, G13_HUNT_START_TICK);
    giveUpStaleHunt(seat, wild, G13_WILD_GIVE_UP_TICK - 1, WILD_HUNT);
    expect(seat.huntPreyId).toBe(player.id);
    giveUpStaleHunt(seat, wild, G13_WILD_GIVE_UP_TICK, WILD_HUNT);
    expect(seat.givenUpPreyId).toBe(player.id);
    const giant = amoebaHunting();
    giveUpStaleHunt(giant.seat, giant.cell, G13_WILD_GIVE_UP_TICK, GIANT_HUNT);
    expect(giant.seat.huntPreyId).toBe(giant.player.id);
  });
});
