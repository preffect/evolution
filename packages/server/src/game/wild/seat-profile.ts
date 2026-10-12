// The seat profile (docs/ecology/giants.md §3.5.15): what a seat's mind, settle and respawn read instead of the wild
// constants, so one strategy drives a wild seat and every giant seat. A wild seat's profile is the wild cell's rules
// (docs/ecology/wild-cells.md §3.3); a giant seat's comes from its species' role (giants.md §3.5.5–§3.5.7):
//
//   rules            the decision's order after the engulf escape, the wander last: wild flee, hunt, graze;
//                    hunter flee, hunt; grazer flee, graze; drifter flee
//   diet             what it grazes and eats (`simulation/cell-diet.ts`)
//   hunt             the hunt window (prey of at least that × its mass: 0 for a wild seat, `GIANT_HUNT_MIN_PREY_MASS_FRACTION`
//                    for a giant; it gates the chase, never the swallow), the give-up and rest seconds, and the stage
//                    players become prey from (a giant: from tick 0, decision 1A)
//   turnChance       the wander's chance of a new heading per decision
//   randomStream     where its decisions draw (`wildCells`, or `giants`, so a giant never shifts a wild cell's draw)
//   growthCeiling    the mass its growth stops at: 3 × `worldMass`, or `GIANT_MASS_CEILING`
//   respawnSeconds   and what a vacated seat forgets: the respawn's countdown
//
// Built per call from the live balance, so a `debug_set_balance` patch applies on the next decision.

import {
  GIANT_ROLE,
  GIANT_ROLE_BY_SPECIES,
  RANDOM_STREAM,
  hasReachedStage,
  type BalanceConfig,
  type CellStage,
  type GiantRole,
  type GiantSpecies,
  type ServerRandomStreamLabel,
  type ValueOf,
} from '@evolution/shared';
import { giantDiet, WILD_CELL_DIET, type CellDiet } from '../simulation/cell-diet.js';
import type { GiantSeatRecord, SeatMindRecord, WildSeatRecord } from '../world/entities.js';

/** A rule a decision tries, in the profile's order, after the engulf escape and before the wander. */
export const SEAT_RULE = { flee: 'flee', hunt: 'hunt', graze: 'graze' } as const;
export type SeatRule = ValueOf<typeof SEAT_RULE>;

export interface SeatHuntRules {
  /** The hunt window: a hunt target weighs at least this × the hunter's mass. */
  readonly minPreyMassFraction: number;
  readonly giveUpSeconds: number;
  readonly restSeconds: number;
  /** The world stage from which player cells are prey; `null` from tick 0. */
  readonly playersFromStage: CellStage | null;
}

export interface SeatProfile<Seat extends SeatMindRecord = SeatMindRecord> {
  readonly rules: readonly SeatRule[];
  readonly diet: CellDiet;
  readonly hunt: SeatHuntRules;
  readonly turnChance: number;
  readonly randomStream: ServerRandomStreamLabel;
  readonly growthCeiling: (worldMass: number) => number;
  readonly respawnSeconds: number;
  /** A method, so a wild or a giant profile serves where any seat's is read (`SeatProfile`). */
  forgetOnVacate(seat: Seat): void;
}

const WILD_RULES: readonly SeatRule[] = [SEAT_RULE.flee, SEAT_RULE.hunt, SEAT_RULE.graze];
const GIANT_RULES_BY_ROLE: Readonly<Record<GiantRole, readonly SeatRule[]>> = {
  [GIANT_ROLE.hunter]: [SEAT_RULE.flee, SEAT_RULE.hunt],
  [GIANT_ROLE.grazer]: [SEAT_RULE.flee, SEAT_RULE.graze],
  [GIANT_ROLE.drifter]: [SEAT_RULE.flee],
};
/** A wild seat hunts any cell it may engulf. */
const NO_HUNT_WINDOW = 0;
/** A giant hunts players from tick 0, gated by their mass alone (decision 1A). */
const FROM_TICK_ZERO = null;

export function wildSeatProfile(balance: BalanceConfig): SeatProfile<WildSeatRecord> {
  const { wildCells } = balance;
  return {
    rules: WILD_RULES,
    diet: WILD_CELL_DIET,
    hunt: {
      minPreyMassFraction: NO_HUNT_WINDOW,
      giveUpSeconds: wildCells.WILD_CELL_HUNT_GIVE_UP_SECONDS,
      restSeconds: wildCells.WILD_CELL_HUNT_REST_SECONDS,
      playersFromStage: wildCells.WILD_CELL_HUNTS_PLAYERS_FROM_STAGE,
    },
    turnChance: wildCells.WILD_CELL_TURN_CHANCE,
    randomStream: RANDOM_STREAM.wildCells,
    growthCeiling: (worldMass) => wildCells.WILD_CELL_MAX_WORLD_MASS_MULTIPLE * worldMass,
    respawnSeconds: wildCells.WILD_CELL_RESPAWN_SECONDS,
    forgetOnVacate: (seat) => {
      seat.isStarving = false; // a starver eaten before it burst dies of that (docs/ecology/wild-cells.md §3.3.6)
    },
  };
}

export function giantSeatProfile(species: GiantSpecies, balance: BalanceConfig): SeatProfile<GiantSeatRecord> {
  const { giants, wildCells } = balance;
  return {
    rules: GIANT_RULES_BY_ROLE[GIANT_ROLE_BY_SPECIES[species]],
    diet: giantDiet(species, balance),
    hunt: {
      minPreyMassFraction: giants.GIANT_HUNT_MIN_PREY_MASS_FRACTION,
      giveUpSeconds: giants.GIANT_HUNT_GIVE_UP_SECONDS,
      restSeconds: wildCells.WILD_CELL_HUNT_REST_SECONDS,
      playersFromStage: FROM_TICK_ZERO,
    },
    turnChance: giants.GIANT_TURN_CHANCE_BY_SPECIES[species],
    randomStream: RANDOM_STREAM.giants,
    growthCeiling: () => giants.GIANT_MASS_CEILING,
    respawnSeconds: giants.GIANT_RESPAWN_SECONDS,
    forgetOnVacate: () => undefined, // a giant seat keeps nothing past its cell but its species
  };
}

/** Whether a seat on `hunt` hunts player cells at `worldStage`. */
export function isPlayerPreyAt(hunt: SeatHuntRules, worldStage: CellStage): boolean {
  return hunt.playersFromStage === null || hasReachedStage(worldStage, hunt.playersFromStage);
}
