// Drives the bench scene through the real WorldStore on a ManualClock (docs/RENDERING.md §7): the
// snapshots up to a tick are fed at their wall times, then the clock is set so the store renders
// exactly that tick, so the bench route and a screenshot are parked on a reproducible frame.

import { DEFAULT_BALANCE, INTERPOLATION_DELAY_TICKS, ManualClock, TICK_INTERVAL_MS } from '@evolution/shared';
import { WorldStore, type RenderFrame } from '../../net/world-store';
import { RENDER_BENCH_SNAPSHOT_EVERY_TICKS } from '../constants';
import {
  BENCH_COUNTS,
  BENCH_OWN_PLAYER_ID,
  benchSnapshotAt,
  buildBenchWorld,
  type BenchCounts,
  type BenchWorld,
} from './bench-scene';

export class BenchDriver {
  readonly clock = new ManualClock(0);
  readonly store = new WorldStore(this.clock);
  private worldValue: BenchWorld;
  private tickValue = 0;
  private fedThroughTick = -1;

  constructor(
    seed: number,
    private readonly counts: BenchCounts = BENCH_COUNTS,
  ) {
    this.worldValue = buildBenchWorld(seed, counts);
    this.reset();
  }

  get world(): BenchWorld {
    return this.worldValue;
  }

  get tick(): number {
    return this.tickValue;
  }

  private reset(): void {
    this.fedThroughTick = -1;
    this.tickValue = 0;
    this.clock.setMilliseconds(0);
    this.store.applyGameState({
      snapshot: benchSnapshotAt(this.worldValue, 0),
      balance: DEFAULT_BALANCE,
      playerId: BENCH_OWN_PLAYER_ID,
      avatarAssignments: {},
    });
    this.fedThroughTick = 0;
  }

  setSeed(seed: number): void {
    this.worldValue = buildBenchWorld(seed, this.counts);
    this.store.reset();
    this.reset();
  }

  /** Feeds every snapshot up to `tick` at its wall time and parks the render tick on `tick`. */
  goToTick(tick: number): void {
    const target = Math.max(0, Math.floor(tick));
    if (target < this.fedThroughTick) this.reset();
    for (
      let next = this.fedThroughTick + RENDER_BENCH_SNAPSHOT_EVERY_TICKS;
      next <= target;
      next += RENDER_BENCH_SNAPSHOT_EVERY_TICKS
    ) {
      this.clock.setMilliseconds(next * TICK_INTERVAL_MS);
      this.store.applySnapshot(benchSnapshotAt(this.worldValue, next));
      this.fedThroughTick = next;
    }
    this.tickValue = target;
    this.clock.setMilliseconds((target + INTERPOLATION_DELAY_TICKS) * TICK_INTERVAL_MS);
  }

  step(ticks: number): void {
    this.goToTick(this.tickValue + Math.max(1, Math.floor(ticks)));
  }

  frame(): RenderFrame | null {
    return this.store.frame();
  }
}
