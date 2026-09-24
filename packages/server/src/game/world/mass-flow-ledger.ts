// Why each player cell's mass moved (docs/ui/hud.md §3.1.5, docs/architecture/wire-contract.md §4, #383): a
// transient record beside `world.effects`, filled from the server's own deltas by the metabolism step, the sprint
// start and a dropped no-draft offer. Never a record field, never hashed or replayed (`state-hash.ts` names it
// derived), so the state hash is unchanged. Keyed by player: a cell's entry is rebuilt by every metabolism step, so a
// dead cell's is gone by the next tick.

import type { MassRateCause, MassWindowAmount, PlayerId, ZoneId } from '@evolution/shared';

/** One player cell's metabolism on the latest tick it ran, at full precision. */
export interface MassFlowRecord {
  /** Mass/s applied per cause (post-floor, post-cap; losses negative); every cause present, zeros included. */
  readonly ratesPerSecond: Readonly<Record<MassRateCause, number>>;
  /** The folded `decayMultiplier` − 1. */
  readonly decayTraitShare: number;
  readonly zone: ZoneId;
}

/** One player's one-off amounts in a broadcast window, at full precision; an amount never recorded is absent. */
export type MassWindowRecord = Partial<Record<MassWindowAmount, number>>;

export interface MassFlowLedger {
  /** The latest metabolism step's records; replaced whole by each step. */
  metabolismByPlayer: Partial<Record<PlayerId, MassFlowRecord>>;
  /** The one-off amounts recorded since the last broadcast drain. */
  pendingWindowByPlayer: Partial<Record<PlayerId, MassWindowRecord>>;
  /** What the last drain sealed: the broadcast window's amounts, which the snapshot reports. */
  sealedWindowByPlayer: Partial<Record<PlayerId, MassWindowRecord>>;
}

export function createMassFlowLedger(): MassFlowLedger {
  return { metabolismByPlayer: {}, pendingWindowByPlayer: {}, sealedWindowByPlayer: {} };
}

/** A metabolism step starts: the previous tick's records go, so only cells that metabolise this tick report. */
export function beginMetabolismRecords(ledger: MassFlowLedger): void {
  ledger.metabolismByPlayer = {};
}

export function recordMetabolism(ledger: MassFlowLedger, playerId: PlayerId, record: MassFlowRecord): void {
  ledger.metabolismByPlayer[playerId] = record;
}

/** Adds a one-off amount (a sprint start's cost, a no-draft bonus); the window's total is what the next drain seals. */
export function recordWindowAmount(
  ledger: MassFlowLedger,
  playerId: PlayerId,
  amount: MassWindowAmount,
  mass: number,
): void {
  const pending = (ledger.pendingWindowByPlayer[playerId] ??= {});
  pending[amount] = (pending[amount] ?? 0) + mass;
}

/** The drain (the broadcast, or a scenario's tick): the pending amounts become the reported window. */
export function sealMassWindow(ledger: MassFlowLedger): void {
  ledger.sealedWindowByPlayer = ledger.pendingWindowByPlayer;
  ledger.pendingWindowByPlayer = {};
}
