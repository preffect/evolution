// The lobby's autoplay held past the bands' warm-up (docs/rendering/opening-dive.md §6, ticket #814): on the first
// frame drawn once every bake has landed, the kelp and the slime make their textures and draw each program once,
// unseen; under software GL that work (the programs, the uploads and their mipmaps) keeps the GPU seconds behind. A
// fence goes after that frame, and the fall starts only once the GPU is past it, so the wait is the orbit's, never
// the fall's first frame; or once `DIVE_WARM_UP_MAX_WAIT_MS` has passed since, whatever the fence says.

import { DIVE_WARM_UP_MAX_WAIT_MS } from '../constants';
import type { GpuFenceCheck } from '../gpu-fence';

/** The fence after the warm-up's frame, and when it was set. */
interface WarmUpFence {
  readonly check: GpuFenceCheck;
  readonly atMs: number;
}

export class DiveWarmUpGate {
  private fence: WarmUpFence | null = null;

  /** `nowMs`: the session's clock, which the wait is timed on. */
  constructor(private readonly nowMs: () => number) {}

  /** After a frame: the first one drawn with every bake landed warmed the bands up, and `fenceGpuWork` fences it. */
  afterFrame(isBaked: boolean, fenceGpuWork: () => GpuFenceCheck): void {
    if (this.fence === null && isBaked) this.fence = { check: fenceGpuWork(), atMs: this.nowMs() };
  }

  /** The warm-up is fenced and the GPU not past it yet, nor the wait over: its frames are slowed by it. */
  get isWarmingUp(): boolean {
    const fence = this.fence;
    return fence !== null && !this.isPast(fence);
  }

  /** Every bake has landed (a level dropped since bakes again), and the GPU is past the warm-up or the wait is over. */
  isOpen(isBaked: boolean): boolean {
    const fence = this.fence;
    return isBaked && fence !== null && this.isPast(fence);
  }

  private isPast(fence: WarmUpFence): boolean {
    return fence.check() || this.nowMs() - fence.atMs >= DIVE_WARM_UP_MAX_WAIT_MS;
  }
}
