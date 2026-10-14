// docs/ecology/giants.md §3.5.15: the seat profile. A wild seat keeps the wild constants; each giant's comes from its
// species' role (§3.5.5–§3.5.7): its decision order, the hunt window and give-up, players as prey from tick 0, its turn
// chance, the `giants` stream, the fixed growth ceiling and its respawn.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, GIANT_SPECIES, RANDOM_STREAM } from '@evolution/shared';
import { createWildSeatRecord } from './wild-seats.js';
import { giantSeatProfile, isPlayerPreyAt, SEAT_RULE, wildSeatProfile } from './seat-profile.js';

const { giants, wildCells } = DEFAULT_BALANCE;
const WORLD_MASS = 200;

describe('wildSeatProfile', () => {
  const profile = wildSeatProfile(DEFAULT_BALANCE);

  it('flees, hunts any cell it may engulf, grazes, then wanders on the wildCells stream', () => {
    expect(profile.rules).toEqual([SEAT_RULE.flee, SEAT_RULE.hunt, SEAT_RULE.graze]);
    expect(profile.hunt).toEqual({
      minPreyMassFraction: 0,
      giveUpSeconds: wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS,
      restSeconds: wildCells.WILD_CELL_HUNT_REST_SECONDS,
      playersFromStage: wildCells.WILD_CELL_HUNTS_PLAYERS_FROM_STAGE,
    });
    expect(profile.turnChance).toBe(wildCells.WILD_CELL_TURN_CHANCE);
    expect(profile.randomStream).toBe(RANDOM_STREAM.wildCells);
  });

  it('grows to 3 × the world mass and respawns after WILD_CELL_RESPAWN_SECONDS, forgetting it starved', () => {
    expect(profile.growthCeiling(WORLD_MASS)).toBe(wildCells.WILD_CELL_MAX_WORLD_MASS_MULTIPLE * WORLD_MASS);
    expect(profile.respawnSeconds).toBe(wildCells.WILD_CELL_RESPAWN_SECONDS);
    const seat = { ...createWildSeatRecord(0), isStarving: true };
    profile.forgetOnVacate(seat);
    expect(seat.isStarving).toBe(false);
  });
});

describe('giantSeatProfile', () => {
  it('orders each role: hunter flee, hunt; grazer flee, graze; drifter flee', () => {
    expect(giantSeatProfile(GIANT_SPECIES.amoeba, DEFAULT_BALANCE).rules).toEqual([SEAT_RULE.flee, SEAT_RULE.hunt]);
    expect(giantSeatProfile(GIANT_SPECIES.paramecium, DEFAULT_BALANCE).rules).toEqual([
      SEAT_RULE.flee,
      SEAT_RULE.graze,
    ]);
    expect(giantSeatProfile(GIANT_SPECIES.diatom, DEFAULT_BALANCE).rules).toEqual([SEAT_RULE.flee]);
  });

  it('hunts only its window, gives up after 8 s, rests as a wild seat, and hunts players from tick 0', () => {
    expect(giantSeatProfile(GIANT_SPECIES.amoeba, DEFAULT_BALANCE).hunt).toEqual({
      minPreyMassFraction: giants.GIANT_HUNT_MIN_PREY_MASS_FRACTION,
      giveUpSeconds: giants.GIANT_HUNT_GIVE_UP_SECONDS,
      restSeconds: wildCells.WILD_CELL_HUNT_REST_SECONDS,
      playersFromStage: null,
    });
  });

  it("turns by its species' chance, draws from the giants stream, stops growing at the ceiling, respawns in 90 s", () => {
    for (const species of Object.values(GIANT_SPECIES)) {
      const profile = giantSeatProfile(species, DEFAULT_BALANCE);
      expect(profile.turnChance).toBe(giants.GIANT_TURN_CHANCE_BY_SPECIES[species]);
      expect(profile.randomStream).toBe(RANDOM_STREAM.giants);
      expect(profile.growthCeiling(WORLD_MASS)).toBe(giants.GIANT_MASS_CEILING);
      expect(profile.respawnSeconds).toBe(giants.GIANT_RESPAWN_SECONDS);
    }
  });

  it('reads the live balance', () => {
    const patched = structuredClone(DEFAULT_BALANCE);
    patched.giants.GIANT_HUNT_GIVE_UP_SECONDS = 1;
    patched.giants.GIANT_TURN_CHANCE_BY_SPECIES.giant_diatom = 1;
    expect(giantSeatProfile(GIANT_SPECIES.amoeba, patched).hunt.giveUpSeconds).toBe(1);
    expect(giantSeatProfile(GIANT_SPECIES.diatom, patched).turnChance).toBe(1);
  });
});

describe('isPlayerPreyAt', () => {
  it("gates a wild seat on WILD_CELL_HUNTS_PLAYERS_FROM_STAGE and never a giant's", () => {
    const wild = wildSeatProfile(DEFAULT_BALANCE).hunt;
    const giant = giantSeatProfile(GIANT_SPECIES.amoeba, DEFAULT_BALANCE).hunt;
    expect(isPlayerPreyAt(wild, CELL_STAGE.protocell)).toBe(false);
    expect(isPlayerPreyAt(wild, wildCells.WILD_CELL_HUNTS_PLAYERS_FROM_STAGE)).toBe(true);
    expect(isPlayerPreyAt(giant, CELL_STAGE.protocell)).toBe(true);
  });
});
