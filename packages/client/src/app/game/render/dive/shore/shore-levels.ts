// The shore's baked levels of detail, near the view (docs/rendering/opening-dive.md §4, ticket #801): the level the
// camera is in and the next few the way it is going bake a few milliseconds at a time; the rest are given back, so a
// level costs memory only while the dive is near it. A bake the camera has turned away from is dropped for the one it
// needs now. Until the level in view has baked, the nearest coarser baked one stands in: it covers the whole view,
// where a finer one would cover only its middle. The widest level is kept for that always, and the stand-in in use is
// kept until the level in view lands. A fall waits above any level with no stand-in close enough (`fallFloorZoom`).

import { SHORE_LEVEL_CACHE } from '../../constants/dive-shore';
import type { StageSize } from './shore-lod';
import { SHORE_LEVEL_COUNT, shoreLevelAt, shoreLevelView, shoreLevelZoom } from './shore-lod';
import type { ShoreView } from './shore-paint';
import { SteppedQueue, type PumpStep } from './shore-pump';
import { bakeShoreSnapshot, type ShoreSnapshot, type ShoreSnapshotSources } from './shore-snapshot';

/** What a baked level becomes on the GPU, and how it is given back: the band's (`ShoreMesh`'s textures). */
export interface ShoreLevelUploader<Level> {
  upload(snapshot: ShoreSnapshot): Level;
  release(level: Level): void;
}

/** How a level's snapshot is baked: `bakeShoreSnapshot`, or a spec's timed stand-in. */
export type ShoreLevelBaker = (view: ShoreView, sources: ShoreSnapshotSources) => Generator<void, ShoreSnapshot>;

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
  /** Where the camera is; above every level until the first `focus`. */
  private focusZoom = Number.POSITIVE_INFINITY;

  constructor(
    private readonly sources: ShoreSnapshotSources,
    private readonly uploader: ShoreLevelUploader<Level>,
    private readonly bakeLevel: ShoreLevelBaker = bakeShoreSnapshot,
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
   * The camera is at `zoom`, going `direction` (+1 down the dive, −1 back up): the levels to bake are its own, the
   * next few that way, one behind and the anchor. Those, and the stand-in in use, are kept; any other is given back.
   */
  focus(zoom: number, direction: number): void {
    this.focusZoom = zoom;
    const level = shoreLevelAt(zoom);
    const step = direction < 0 ? -1 : 1;
    const ahead = Array.from({ length: SHORE_LEVEL_CACHE.ahead }, (_unused, index) => level + step * (index + 1));
    this.wanted = [level, ...ahead, level - step, SHORE_LEVEL_CACHE.anchor].filter(
      (candidate, index, all) => candidate >= 0 && candidate < SHORE_LEVEL_COUNT && all.indexOf(candidate) === index,
    );
    const standIn = this.baked.has(level) ? null : this.coarserBaked(level);
    for (const [candidate, baked] of this.baked) {
      if (this.wanted.includes(candidate) || candidate === standIn) continue;
      this.retired.push(baked);
      this.baked.delete(candidate);
    }
    if (this.job !== null && !this.wanted.includes(this.job.level)) this.job = null;
  }

  /**
   * The zoom a fall must stay above: the first level ahead of the camera with no baked level at most
   * `SHORE_LEVEL_CACHE.standInSteps` coarser, or −∞ when every level ahead has one.
   */
  get fallFloorZoom(): number {
    for (let level = 0; level < SHORE_LEVEL_COUNT; level += 1) {
      if (shoreLevelZoom(level) >= this.focusZoom) continue;
      const nearest = this.coarserBaked(level, 0);
      if (nearest === null || level - nearest > SHORE_LEVEL_CACHE.standInSteps) return shoreLevelZoom(level);
    }
    return Number.NEGATIVE_INFINITY;
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
        bake: this.bakeLevel(shoreLevelView(level, this.stage, this.devicePixelRatio), this.sources),
      };
    }
    const step = this.job.bake.next();
    if (step.done !== true) return 'stepped';
    this.baked.set(this.job.level, this.uploader.upload(step.value));
    this.job = null;
    return 'finished';
  }

  /** The level `zoom` is in (or the nearest coarser baked one) and the next one down. */
  levelsAt(zoom: number): ShoreLevelPair<Level> {
    const level = shoreLevelAt(zoom);
    const next = this.baked.get(level + 1) ?? null;
    const exact = this.baked.get(level);
    if (exact !== undefined) return { level: exact, next, isExact: true };
    const standIn = this.coarserBaked(level);
    return { level: standIn === null ? null : (this.baked.get(standIn) ?? null), next: null, isExact: false };
  }

  /** The finest baked level coarser than `level` (or `level` itself from `fromDistance` 0), or `null`. */
  private coarserBaked(level: number, fromDistance = 1): number | null {
    for (let candidate = level - fromDistance; candidate >= 0; candidate -= 1) {
      if (this.baked.has(candidate)) return candidate;
    }
    return null;
  }

  /** Which level stands in at `zoom` (the level itself once baked), or `null`: for the specs and the band's checks. */
  standInLevelAt(zoom: number): number | null {
    return this.coarserBaked(shoreLevelAt(zoom), 0);
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
