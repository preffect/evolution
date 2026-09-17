// The own cell's mass over the last `AFFECTING_MASS_HISTORY_SECONDS` (docs/ui/overlays.md §3.7): the sparkline the
// hold-Tab panel's mass element draws. A history is a question about the past, which a plain computed cannot
// answer, so the memory is carried from snapshot to snapshot by the caller (`GameStateService`) exactly as the mass
// trend's is (`mass-trend.ts`).
//
// Snapshots arrive far faster than a 120 px sparkline can draw, so a sample is kept only every
// `AFFECTING_MASS_SAMPLE_SECONDS`: the drawing is the same and the memory is bounded rather than growing with the
// broadcast rate. A new own cell id starts fresh, so a respawn never draws 312 falling to 20. Pure.

import { secondsToTicks, type EntityId } from '@evolution/shared';
import { AFFECTING_MASS_HISTORY_SECONDS, AFFECTING_MASS_SAMPLE_SECONDS } from '../hud/hud-constants';

/** One snapshot as the history reads it. */
export interface OwnMassSample {
  readonly cellId: EntityId;
  readonly tick: number;
  readonly mass: number;
}

/** One kept point of the sparkline. */
export interface OwnMassPoint {
  readonly tick: number;
  readonly mass: number;
}

export interface OwnMassHistory {
  readonly cellId: EntityId;
  /** Oldest first, none older than `AFFECTING_MASS_HISTORY_SECONDS` before the newest. */
  readonly points: readonly OwnMassPoint[];
}

const SAMPLE_INTERVAL_TICKS = secondsToTicks(AFFECTING_MASS_SAMPLE_SECONDS);
const WINDOW_TICKS = secondsToTicks(AFFECTING_MASS_HISTORY_SECONDS);

/** Whether `sample` is far enough past the newest kept point to be worth its own point. */
function isDueForSample(points: readonly OwnMassPoint[], tick: number): boolean {
  const newest = points.at(-1);
  return newest === undefined || tick - newest.tick >= SAMPLE_INTERVAL_TICKS;
}

/**
 * The history after `sample`. A new own cell id starts the history over; a tick already seen changes nothing, so a
 * recomputation never records a snapshot twice.
 */
export function ownMassHistoryFor(previous: OwnMassHistory | null, sample: OwnMassSample): OwnMassHistory {
  const carried = previous?.cellId === sample.cellId ? previous : null;
  if (carried === null) return { cellId: sample.cellId, points: [{ tick: sample.tick, mass: sample.mass }] };
  if (!isDueForSample(carried.points, sample.tick)) return carried;
  const kept = [...carried.points, { tick: sample.tick, mass: sample.mass }];
  return { cellId: sample.cellId, points: kept.filter((point) => sample.tick - point.tick <= WINDOW_TICKS) };
}

/** The masses the sparkline draws, oldest first; empty for a history of another cell or none at all. */
export function ownMassesFor(history: OwnMassHistory | null, cellId: EntityId): readonly number[] {
  if (history === null || history.cellId !== cellId) return [];
  return history.points.map((point) => point.mass);
}
