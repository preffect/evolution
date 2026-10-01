// The shore's baked levels of detail, near the view (docs/rendering/opening-dive.md §4, ticket #801): the level the
// camera is in and the next few the way it is going bake a few milliseconds at a time; the rest are given back, so a
// level costs memory only while the dive is near it. A level the camera has left before its bake finished is dropped
// for the one it needs now. Until the level in view has baked, the nearest baked one stands in.

import { SHORE_LEVEL_CACHE } from '../../constants/dive-shore';
import type { StageSize } from './shore-lod';
import { SHORE_LEVEL_COUNT, shoreLevelAt, shoreLevelView } from './shore-lod';
import { SteppedQueue, type PumpStep } from './shore-pump';
import { bakeShoreSnapshot, type ShoreSnapshot, type ShoreSnapshotSources } from './shore-snapshot';

/** What a baked level becomes on the GPU, and how it is given back: the band's (`ShoreMesh`'s textures). */
export interface ShoreLevelUploader<Level> {
  upload(snapshot: ShoreSnapshot): Level;
  release(level: Level): void;
}

interface LevelBake {
  readonly level: number;
  readonly bake: Generator<void, ShoreSnapshot>;
}

/** The level in view and its next one, each `null` until baked. */
export interface ShoreLevelPair<Level> {
  readonly level: Level | null;
  readonly next: Level | null;
  /** Whether `level` is the level the zoom is in, not a stand-in. */
  readonly isExact: boolean;
}

export class ShoreLevels<Level> extends SteppedQueue {
  private readonly baked = new Map<number, Level>();
  /** Levels let go, given back only once nothing draws with them (`releaseRetired`). */
  private retired: Level[] = [];
  private job: LevelBake | null = null;
  private wanted: number[] = [];
  private stage: StageSize = { width: 0, height: 0 };
  private devicePixelRatio = 1;

  constructor(
    private readonly sources: ShoreSnapshotSources,
    private readonly uploader: ShoreLevelUploader<Level>,
  ) {
    super();
  }

  /** A new stage size or ratio drops every level: they are baked for one. */
  setStage(stage: StageSize, devicePixelRatio: number): void {
    if (
      stage.width === this.stage.width &&
      stage.height === this.stage.height &&
      devicePixelRatio === this.devicePixelRatio
    )
      return;
    this.stage = stage;
    this.devicePixelRatio = devicePixelRatio;
    this.clear();
  }

  /**
   * The camera is at `zoom`, going `direction` (+1 down the dive, −1 back up): the levels to keep and bake are its
   * own, the next few that way and one behind. Any other is given back.
   */
  focus(zoom: number, direction: number): void {
    const level = shoreLevelAt(zoom);
    const step = direction < 0 ? -1 : 1;
    const ahead = Array.from({ length: SHORE_LEVEL_CACHE.ahead }, (_unused, index) => level + step * (index + 1));
    this.wanted = [level, ...ahead, level - step].filter(
      (candidate) => candidate >= 0 && candidate < SHORE_LEVEL_COUNT,
    );
    for (const [candidate, baked] of this.baked) {
      if (this.wanted.includes(candidate)) continue;
      this.retired.push(baked);
      this.baked.delete(candidate);
    }
    if (this.job !== null && !this.wanted.includes(this.job.level)) this.job = null;
  }

  /** Whether a level still wants baking. */
  get hasWork(): boolean {
    return this.wanted.some((level) => !this.baked.has(level));
  }

  protected step(): PumpStep {
    if (this.job === null) {
      const level = this.wanted.find((candidate) => !this.baked.has(candidate));
      if (level === undefined || this.stage.width <= 0) return 'idle';
      this.job = {
        level,
        bake: bakeShoreSnapshot(shoreLevelView(level, this.stage, this.devicePixelRatio), this.sources),
      };
    }
    const step = this.job.bake.next();
    if (step.done !== true) return 'stepped';
    this.baked.set(this.job.level, this.uploader.upload(step.value));
    this.job = null;
    return 'finished';
  }

  /** The level `zoom` is in (or the nearest baked one, coarser first) and the next one down. */
  levelsAt(zoom: number): ShoreLevelPair<Level> {
    const level = shoreLevelAt(zoom);
    const next = this.baked.get(level + 1) ?? null;
    const exact = this.baked.get(level);
    if (exact !== undefined) return { level: exact, next, isExact: true };
    return { level: this.standIn(level), next: null, isExact: false };
  }

  private standIn(level: number): Level | null {
    for (let distance = 1; distance < SHORE_LEVEL_COUNT; distance += 1) {
      const coarser = this.baked.get(level - distance);
      if (coarser !== undefined) return coarser;
      const finer = this.baked.get(level + distance);
      if (finer !== undefined) return finer;
    }
    return null;
  }

  /** Whether the level `zoom` is in has baked. */
  isBakedAt(zoom: number): boolean {
    return this.baked.has(shoreLevelAt(zoom));
  }

  /** Lets every level go; they are given back on the next `releaseRetired`. */
  clear(): void {
    this.retired.push(...this.baked.values());
    this.baked.clear();
    this.job = null;
  }

  /** Gives back the levels let go, once the frame that might still have drawn with them has been drawn. */
  releaseRetired(): void {
    for (const level of this.retired) this.uploader.release(level);
    this.retired = [];
  }
}
