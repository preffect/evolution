// The lobby's autoplay held past the bands' warm-up (docs/rendering/opening-dive.md §6, ticket #814): on the first
// frame drawn once every bake has landed, the kelp and the slime make their textures and draw each program once,
// unseen; under software GL that work (the programs, the uploads and their mipmaps) keeps the GPU seconds behind. A
// fence goes after that frame, and the fall starts only once the GPU is past it, so the wait is the orbit's, never
// the fall's first frame.

import type { GpuFenceCheck } from '../gpu-fence';

export class DiveWarmUpGate {
  private fence: GpuFenceCheck | null = null;

  /** After a frame: the first one drawn with every bake landed warmed the bands up, and `fenceGpuWork` fences it. */
  afterFrame(isBaked: boolean, fenceGpuWork: () => GpuFenceCheck): void {
    if (this.fence === null && isBaked) this.fence = fenceGpuWork();
  }

  /** Every bake has landed (a level dropped since bakes again) and the GPU is past the warm-up. */
  isOpen(isBaked: boolean): boolean {
    return isBaked && (this.fence?.() ?? false);
  }
}
