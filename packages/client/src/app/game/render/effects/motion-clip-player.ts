// Plays the sheet-03 clips (docs/RENDERING.md §4) off the render tick: a clip is a start time
// and a table, the player samples every active track and prunes finished clips. Progress-domain
// clips (`engulf`) are sampled directly from `engulfProgress` through `sampleClip`; the player
// only holds millisecond clips.

import { MOTION_DOMAIN, sampleTrack, type MotionClip, type MotionClipId } from '@evolution/shared';
import { ease } from '../easing';

export type ClipTrackValues = Readonly<Record<string, number>>;

export interface ClipInstance {
  readonly clip: MotionClip;
  readonly startMs: number;
}

/** Every track of `clip` at `position` (ms or progress, per the clip's domain). */
export function sampleClip(clip: MotionClip, position: number): ClipTrackValues {
  const values: Record<string, number> = {};
  for (const [name, track] of Object.entries(clip.tracks)) values[name] = sampleTrack(track, position, ease);
  return values;
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

  /**
   * Starts `clip` now. A running clip of the same id is replaced when it is interruptible and
   * refused (returns false) while a non-interruptible one plays, so a level-up finishes its burst.
   */
  play(clip: MotionClip, nowMs: number): boolean {
    if (clip.domain !== MOTION_DOMAIN.milliseconds) return false;
    const running = this.instances.find((instance) => instance.clip.id === clip.id && !isClipFinished(instance, nowMs));
    if (running !== undefined && !running.clip.isInterruptible) return false;
    this.instances = this.instances.filter((instance) => instance !== running);
    this.instances.push({ clip, startMs: nowMs });
    return true;
  }

  isPlaying(id: MotionClipId, nowMs: number): boolean {
    return this.instances.some((instance) => instance.clip.id === id && !isClipFinished(instance, nowMs));
  }

  /** The progress of the running clip `id`, or `null`. */
  progressOf(id: MotionClipId, nowMs: number): number | null {
    const instance = this.instances.find((candidate) => candidate.clip.id === id && !isClipFinished(candidate, nowMs));
    return instance === undefined ? null : clipProgress(instance, nowMs);
  }

  /** Every active track at `nowMs`; the most recently started clip wins a track two clips share. Finished clips are dropped. */
  sample(nowMs: number): ClipTrackValues {
    this.instances = this.instances.filter((instance) => !isClipFinished(instance, nowMs));
    const values: Record<string, number> = {};
    for (const instance of this.instances) {
      Object.assign(values, sampleClip(instance.clip, nowMs - instance.startMs));
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
