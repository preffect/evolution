// docs/ecology/wild-cells.md §3.3.3, ticket #738: the hunt's give-up at its boundary (exactly
// `WILD_CELL_HUNT_GIVE_UP_SECONDS` after the hunt began, one tick earlier), never while engulfing, and the hunt's clock
// kept for the same prey and restarted for a new one; the rest after a give-up, to the tick.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, entityId, secondsToTicks } from '@evolution/shared';
import { LUNCH_MASS, THREAT_MASS, arena } from '../../testing/wild-arena.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { giveUpStaleHunt, isHuntResting, isHuntStale, latchHunt } from './wild-hunt-give-up.js';

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
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, DEFAULT_BALANCE)).toBe(false);
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS, DEFAULT_BALANCE)).toBe(true);
  });

  it('is never stale while the hunter engulfs, nor without a hunt', () => {
    const { seat, wild, player } = hunting();
    beginEngulf({ predator: wild, prey: player });
    expect(isHuntStale(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS, DEFAULT_BALANCE)).toBe(false);
    const idle = hunting();
    idle.seat.huntPreyId = null;
    expect(isHuntStale(idle.seat, idle.wild, HUNT_START_TICK + GIVE_UP_TICKS, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('giveUpStaleHunt', () => {
  it('ends a stale hunt and remembers its prey; leaves a fresh one alone', () => {
    const fresh = hunting();
    giveUpStaleHunt(fresh.seat, fresh.wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, DEFAULT_BALANCE);
    expect(fresh.seat.huntPreyId).toBe(fresh.player.id);
    expect(fresh.seat.givenUpPreyId).toBeNull();
    const stale = hunting();
    giveUpStaleHunt(stale.seat, stale.wild, HUNT_START_TICK + GIVE_UP_TICKS, DEFAULT_BALANCE);
    expect(stale.seat.huntPreyId).toBeNull();
    expect(stale.seat.givenUpPreyId).toBe(stale.player.id);
  });
});

describe('isHuntResting', () => {
  it('rests from the give-up for WILD_CELL_HUNT_REST_SECONDS, and not one tick longer', () => {
    const { seat, wild } = hunting();
    const giveUpTick = HUNT_START_TICK + GIVE_UP_TICKS;
    expect(isHuntResting(seat, giveUpTick)).toBe(false);
    giveUpStaleHunt(seat, wild, giveUpTick, DEFAULT_BALANCE);
    expect(isHuntResting(seat, giveUpTick)).toBe(true);
    expect(isHuntResting(seat, giveUpTick + REST_TICKS - 1)).toBe(true);
    expect(isHuntResting(seat, giveUpTick + REST_TICKS)).toBe(false);
  });

  it('never rests after a fresh hunt that was not given up', () => {
    const { seat, wild } = hunting();
    giveUpStaleHunt(seat, wild, HUNT_START_TICK + GIVE_UP_TICKS - 1, DEFAULT_BALANCE);
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
