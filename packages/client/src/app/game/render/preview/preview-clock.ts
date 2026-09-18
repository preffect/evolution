// The preview's local time (docs/architecture/encyclopedia.md §12.7). Small enough to read in one go, and worth
// its own file because one rule governs everything in it:
//
// **The tick the renderer sees is monotonic and never wraps.** `GameRenderer` derives `nowMs` from `timeSeconds`,
// which is this tick, and the clip tracker, the ghost registry and the sprint-ring tracker all key on it. A clip
// started at `nowMs = 28_000` that then sees `nowMs = 0` never satisfies `nowMs - startMs >= duration`, so it is
// never pruned and never expires (`effects/motion-clip-player.ts`).
//
// So a scene swap restarts the loop by moving a **phase offset** forward, never by moving the clock back, and a
// pause re-bases the origin by exactly the span it held for. Both leave the render tick climbing.

import { MILLISECONDS_PER_SECOND, TICK_INTERVAL_S, type Clock } from '@evolution/shared';

export class PreviewLocalClock {
  /** The clock reading when the session started playing; only `resume` moves it, by the paused span. */
  private startedAtMs: number | null = null;
  /** The render tick the current scene's loop starts from: what a swap moves instead of the clock. */
  private sceneOriginTick = 0;
  /** When the clock was paused, so `resume` re-bases by exactly that span; `null` while running. */
  private pausedAtMs: number | null = null;

  constructor(private readonly clock: Clock) {}

  get isPaused(): boolean {
    return this.pausedAtMs !== null;
  }

  /** `true` once a scene has been shown: before that there is no origin and no tick to read. */
  get isStarted(): boolean {
    return this.startedAtMs !== null;
  }

  /** Starts the current scene's loop. The first call also sets the origin the render tick is counted from. */
  restartScene(): void {
    this.startedAtMs ??= this.nowMs();
    this.sceneOriginTick = this.renderTick();
    // A scene shown while paused starts when it is shown, so `resume` adds only the span since the swap.
    if (this.pausedAtMs !== null) this.pausedAtMs = this.nowMs();
  }

  pause(): void {
    if (this.pausedAtMs !== null) return;
    this.pausedAtMs = this.nowMs();
  }

  /** Re-bases the origin by the paused span, so the paused time never plays and the tick never jumps. */
  resume(): void {
    const { pausedAtMs } = this;
    if (pausedAtMs === null) return;
    this.pausedAtMs = null;
    if (this.startedAtMs !== null) this.startedAtMs += this.nowMs() - pausedAtMs;
  }

  /** The monotonic tick the renderer sees; 0 before the first scene is shown. */
  renderTick(): number {
    const { startedAtMs } = this;
    if (startedAtMs === null) return 0;
    return (this.nowMs() - startedAtMs) / MILLISECONDS_PER_SECOND / TICK_INTERVAL_S;
  }

  /** The current scene's own loop phase: the render tick since the last `restartScene`. */
  sceneTick(): number {
    return this.renderTick() - this.sceneOriginTick;
  }

  reset(): void {
    this.startedAtMs = null;
    this.sceneOriginTick = 0;
    this.pausedAtMs = null;
  }

  private nowMs(): number {
    return this.clock.nowMilliseconds();
  }
}
