// The one-seat arena the wild strategy's unit tests decide in (docs/ecology/wild-cells.md §3.3.3): seat 0 alone at
// the origin with the player(s) placed east of it, its headings frozen so a wander target is exactly
// `pointAlongHeading`, due to decide on the next call. Shared by wild-strategy.test.ts and wild-strategy-sprint.test.ts.

import { DEFAULT_BALANCE, playerId, type BalanceConfig } from '@evolution/shared';
import type { PlayerIdentity } from '../game/session/players.js';
import { setCellMass } from '../game/simulation/cell-mass.js';
import type { CellRecord } from '../game/world/entities.js';
import { findCell } from '../game/world/lookups.js';
import type { StepContext, WorldState } from '../game/world/world-state.js';
import { createTestStepContext, createTestWorld } from './world-builders.js';

/** Elapsed ticks at which the world stage is `endosymbiosis`, the hunting stage (W6). */
export const HUNTING_TICK = 21_600;
export const PROTOCELL_TICK = 1;
export const THREAT_MASS = 100;
export const LUNCH_MASS = 20;
/** How far past a boundary (sight, a sprint range) the "just outside" cases sit, in own radii or in wu. */
export const JUST_PAST_RADII = 0.01;
export const JUST_PAST_WU = 1;
export const SECOND_PLAYER: PlayerIdentity = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
/** Keeps every heading: the wander target is then exactly `pointAlongHeading`. */
export const NEVER_TURNS: BalanceConfig = structuredClone(DEFAULT_BALANCE);
NEVER_TURNS.wildCells.WILD_CELL_TURN_CHANCE = 0;

export interface Arena {
  readonly world: WorldState;
  readonly context: StepContext;
  readonly wild: CellRecord;
  readonly player: CellRecord;
}

export interface ArenaOptions {
  readonly wildMass: number;
  readonly playerMass: number;
  /** The player's centre this many wild radii east of the wild cell (at the origin). */
  readonly playerAtRadii: number;
  readonly tick?: number;
  readonly players?: readonly PlayerIdentity[];
}

/** Seat 0 alone at the origin with the player(s) placed east of it, due to decide on the next call. */
export function arena(options: ArenaOptions): Arena {
  const world = createTestWorld({ hasWildSeats: true, players: options.players });
  const seat = world.wildSeats[0]!;
  const wild = findCell(world, seat.cellId!)!;
  const player = world.cells[0]!;
  world.wildSeats = [seat];
  world.cells = [...world.cells.filter((cell) => cell.playerId !== null), wild];
  world.tick = options.tick ?? PROTOCELL_TICK;
  setCellMass(wild, options.wildMass, world.balance);
  wild.x = 0;
  wild.y = 0;
  setCellMass(player, options.playerMass, world.balance);
  player.x = wild.radius * options.playerAtRadii;
  player.y = 0;
  seat.decideInTicks = 1;
  return { world, context: createTestStepContext(world, { balance: NEVER_TURNS }), wild, player };
}

export function targetOf(cell: CellRecord) {
  return { x: cell.targetX, y: cell.targetY };
}
