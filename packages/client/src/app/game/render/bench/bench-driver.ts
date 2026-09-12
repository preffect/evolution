// Drives the bench scene through the real WorldStore on a ManualClock (docs/RENDERING.md §7): the
// snapshots up to a tick are fed at their wall times, then the clock is set so the store renders
// exactly that tick, so the bench route and a screenshot are parked on a reproducible frame. Only
// the snapshots the store's buffer can hold are replayed on a jump, plus the tick-0 `game_state`
// that carries the motes.

import {
  DEFAULT_BALANCE,
  INTERPOLATION_DELAY_TICKS,
  ManualClock,
  SNAPSHOT_BUFFER_SIZE,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
} from '@evolution/shared';
import { WorldStore, type RenderFrame } from '../../net/world-store';
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
  private fedThroughTick = 0;

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
    this.clock.setMilliseconds(0);
    this.store.applyGameState({
      snapshot: benchSnapshotAt(this.worldValue, 0),
      balance: DEFAULT_BALANCE,
      playerId: BENCH_OWN_PLAYER_ID,
      avatarAssignments: {},
    });
    this.fedThroughTick = 0;
    this.tickValue = 0;
  }

  setSeed(seed: number): void {
    this.worldValue = buildBenchWorld(seed, this.counts);
    this.reset();
  }

  /** Feeds the snapshots up to `tick` at their wall times and parks the render tick on `tick`. */
  goToTick(tick: number): void {
    const target = Math.max(0, Math.floor(tick));
    if (target < this.fedThroughTick) this.reset();
    // A jump past the buffer replays only the snapshots it can hold: the ones before would be dropped anyway.
    const firstNeeded = Math.max(this.fedThroughTick, target - SNAPSHOT_BUFFER_SIZE * SNAPSHOT_EVERY_TICKS);
    for (let next = firstNeeded + SNAPSHOT_EVERY_TICKS; next <= target; next += SNAPSHOT_EVERY_TICKS) {
      this.clock.setMilliseconds(next * TICK_INTERVAL_MS);
      this.store.applySnapshot(benchSnapshotAt(this.worldValue, next));
      this.fedThroughTick = next;
    }
    this.tickValue = target;
    this.clock.setMilliseconds((target + INTERPOLATION_DELAY_TICKS) * TICK_INTERVAL_MS);
  }

  /** Advances `ticks` (0 holds the parked tick, so a re-render of the same frame is a step of 0). */
  step(ticks: number): void {
    this.goToTick(this.tickValue + Math.max(0, Math.floor(ticks)));
  }

  /** The store's frame at the parked tick; the effects due are consumed, as the session would. */
  frame(): RenderFrame | null {
    return this.store.nextFrame();
  }
}
