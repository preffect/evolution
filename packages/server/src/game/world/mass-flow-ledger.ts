// Why each player cell's mass moved (docs/ui/hud.md §3.1.5, docs/architecture/wire-contract.md §4, #383): a
// transient record beside `world.effects`, filled from the server's own deltas by the metabolism step and the
// sprint start. Never a record field, never hashed or replayed (`state-hash.ts` names it derived), so the state hash
// is unchanged. Keyed by player: a cell's entry is rebuilt by every metabolism step, so a dead cell's is gone by the
// next tick.

import type { MassRateCause, PlayerId, ZoneId } from '@evolution/shared';

/** One player cell's metabolism on the latest tick it ran, at full precision. */
export interface MassFlowRecord {
  /** Mass/s applied per cause (post-floor, post-cap; losses negative); every cause present, zeros included. */
  readonly ratesPerSecond: Readonly<Record<MassRateCause, number>>;
  /** The folded `decayMultiplier` − 1. */
  readonly decayTraitShare: number;
  readonly zone: ZoneId;
}

export interface MassFlowLedger {
  /** The latest metabolism step's records; replaced whole by each step. */
  metabolismByPlayer: Partial<Record<PlayerId, MassFlowRecord>>;
  /** Sprint mass taken since the last broadcast drain. */
  sprintSpentPendingByPlayer: Partial<Record<PlayerId, number>>;
  /** What the last drain sealed: the broadcast window's sprint spend, which the snapshot reports. */
  sprintSpentByPlayer: Partial<Record<PlayerId, number>>;
}

export function createMassFlowLedger(): MassFlowLedger {
  return { metabolismByPlayer: {}, sprintSpentPendingByPlayer: {}, sprintSpentByPlayer: {} };
}

/** A metabolism step starts: the previous tick's records go, so only cells that metabolise this tick report. */
export function beginMetabolismRecords(ledger: MassFlowLedger): void {
  ledger.metabolismByPlayer = {};
}

export function recordMetabolism(ledger: MassFlowLedger, playerId: PlayerId, record: MassFlowRecord): void {
  ledger.metabolismByPlayer[playerId] = record;
}

/** Adds what a sprint start took; the window's total is what the next drain seals. */
export function recordSprintSpent(ledger: MassFlowLedger, playerId: PlayerId, massSpent: number): void {
  ledger.sprintSpentPendingByPlayer[playerId] = (ledger.sprintSpentPendingByPlayer[playerId] ?? 0) + massSpent;
}

/** The drain (the broadcast, or a scenario's tick): the pending sprint spend becomes the reported window. */
export function sealSprintWindow(ledger: MassFlowLedger): void {
  ledger.sprintSpentByPlayer = ledger.sprintSpentPendingByPlayer;
  ledger.sprintSpentPendingByPlayer = {};
}
