// Where the render tick comes from and how views are lerped between two snapshots
// (docs/ARCHITECTURE.md §5): the one module that owns the delay and the lerp; nothing under
// `render/` computes it. The server tick is estimated from snapshot arrival times through the
// injected clock, so the render tick advances smoothly between the 20 Hz snapshots.

import {
  INTERPOLATION_DELAY_TICKS,
  MAX_EXTRAPOLATION_TICKS,
  SERVER_TICK_ESTIMATE_SMOOTHING,
  TICK_INTERVAL_MS,
  TICK_INTERVAL_S,
  lerp,
  type CellView,
  type DnaFragmentView,
  type MotePositionView,
} from '@evolution/shared';

/** Where the server's tick counter stands against the client clock, smoothed over arrivals. */
export class ServerTickEstimator {
  private offsetTicks: number | null = null;

  /** A snapshot at `tick` arrived when the clock read `nowMs`. */
  observe(tick: number, nowMs: number): void {
    const measured = tick - nowMs / TICK_INTERVAL_MS;
    this.offsetTicks =
      this.offsetTicks === null
        ? measured
        : this.offsetTicks + (measured - this.offsetTicks) * SERVER_TICK_ESTIMATE_SMOOTHING;
  }

  /** The server's fractional tick now, or `null` before the first snapshot. */
  serverTickAt(nowMs: number): number | null {
    return this.offsetTicks === null ? null : nowMs / TICK_INTERVAL_MS + this.offsetTicks;
  }

  reset(): void {
    this.offsetTicks = null;
  }
}

/**
 * The tick to draw: the estimate minus the interpolation delay, never before the oldest snapshot
 * and never more than the extrapolation cap past the newest, so a paused room holds the frame.
 */
export function renderTickFor(serverTick: number, oldestTick: number, latestTick: number): number {
  const wanted = serverTick - INTERPOLATION_DELAY_TICKS;
  return Math.min(latestTick + MAX_EXTRAPOLATION_TICKS, Math.max(oldestTick, wanted));
}

/** 0 at `olderTick`, 1 at `newerTick`; 1 when the two coincide. */
export function interpolationWeight(olderTick: number, newerTick: number, renderTick: number): number {
  const span = newerTick - olderTick;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (renderTick - olderTick) / span));
}

/** Position, velocity and radius lerp; every other field is the newer snapshot's. */
export function interpolateCell(older: CellView, newer: CellView, weight: number): CellView {
  return {
    ...newer,
    x: lerp(older.x, newer.x, weight),
    y: lerp(older.y, newer.y, weight),
    velocityX: lerp(older.velocityX, newer.velocityX, weight),
    velocityY: lerp(older.velocityY, newer.velocityY, weight),
    radius: lerp(older.radius, newer.radius, weight),
  };
}

/** Carries a cell forward with its velocity for at most `MAX_EXTRAPOLATION_TICKS`. */
export function extrapolateCell(cell: CellView, ticksAhead: number): CellView {
  const ticks = Math.min(MAX_EXTRAPOLATION_TICKS, Math.max(0, ticksAhead));
  const seconds = ticks * TICK_INTERVAL_S;
  return { ...cell, x: cell.x + cell.velocityX * seconds, y: cell.y + cell.velocityY * seconds };
}

export function extrapolateCells(cells: readonly CellView[], ticksAhead: number): CellView[] {
  return cells.map((cell) => extrapolateCell(cell, ticksAhead));
}

/** Cells matched by id; a cell only in the newer snapshot appears as is, one only in the older is gone. */
export function interpolateCells(older: readonly CellView[], newer: readonly CellView[], weight: number): CellView[] {
  const olderById = new Map(older.map((cell) => [cell.id, cell]));
  return newer.map((cell) => {
    const previous = olderById.get(cell.id);
    return previous === undefined ? cell : interpolateCell(previous, cell, weight);
  });
}

export function interpolateFragments(
  older: readonly DnaFragmentView[],
  newer: readonly DnaFragmentView[],
  weight: number,
): DnaFragmentView[] {
  const olderById = new Map(older.map((fragment) => [fragment.id, fragment]));
  return newer.map((fragment) => {
    const previous = olderById.get(fragment.id);
    if (previous === undefined) return fragment;
    return { ...fragment, x: lerp(previous.x, fragment.x, weight), y: lerp(previous.y, fragment.y, weight) };
  });
}

/** A bacterium's position between its last two reported positions. */
export function interpolatePosition(
  older: MotePositionView,
  newer: MotePositionView,
  weight: number,
): MotePositionView {
  return { id: newer.id, x: lerp(older.x, newer.x, weight), y: lerp(older.y, newer.y, weight) };
}
