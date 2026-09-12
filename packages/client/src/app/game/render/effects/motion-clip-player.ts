// Plays the sheet-03 millisecond clips (docs/RENDERING.md §4) off the render tick: a clip is a
// start time and a table, the player samples every active track and prunes finished clips.
// Progress-domain clips (`engulf`) are never played here: `cells/cell-clips.ts` samples them from
// `engulfProgress` directly.

import { MOTION_DOMAIN, type MotionClip, type MotionClipId } from '@evolution/shared';
import { sampleClipTracks, type ClipTrackValues } from '../cells/cell-clips';

export interface ClipInstance {
  readonly clip: MotionClip;
  readonly startMs: number;
}

/** Unit progress through a millisecond clip started at `startMs`. */
export function clipProgress(instance: ClipInstance, nowMs: number): number {
  return (nowMs - instance.startMs) / instance.clip.duration;
}

export function isClipFinished(instance: ClipInstance, nowMs: number): boolean {
  return nowMs - instance.startMs >= instance.clip.duration;
}

export class MotionClipPlayer {
  private instances: ClipInstance[] = [];

  private runningOf(id: MotionClipId, nowMs: number): ClipInstance | undefined {
    return this.instances.find((instance) => instance.clip.id === id && !isClipFinished(instance, nowMs));
  }

  /**
   * Starts `clip` now. A running clip of the same id is restarted when it is interruptible;
   * while a non-interruptible one plays the start is refused (false), so a level-up finishes its burst.
   */
  play(clip: MotionClip, nowMs: number): boolean {
    if (clip.domain !== MOTION_DOMAIN.milliseconds) return false;
    const running = this.runningOf(clip.id, nowMs);
    if (running !== undefined && !running.clip.isInterruptible) return false;
    this.instances = this.instances.filter((instance) => instance !== running);
    this.instances.push({ clip, startMs: nowMs });
    return true;
  }

  isPlaying(id: MotionClipId, nowMs: number): boolean {
    return this.runningOf(id, nowMs) !== undefined;
  }

  /** The progress of the running clip `id`, or `null`. */
  progressOf(id: MotionClipId, nowMs: number): number | null {
    const instance = this.runningOf(id, nowMs);
    return instance === undefined ? null : clipProgress(instance, nowMs);
  }

  /** Every active track at `nowMs`; the most recently started clip wins a track two clips share. Finished clips are dropped. */
  sample(nowMs: number): ClipTrackValues {
    this.instances = this.instances.filter((instance) => !isClipFinished(instance, nowMs));
    const values: Record<string, number> = {};
    for (const instance of this.instances) {
      Object.assign(values, sampleClipTracks(instance.clip, nowMs - instance.startMs));
    }
    return values;
  }

  get activeCount(): number {
    return this.instances.length;
  }

  clear(): void {
    this.instances = [];
  }
}
