// The dive's resolution governor (docs/rendering/opening-dive.md §6, ticket #804): when its frames run over budget it
// steps the dive canvas's device px per css px down, and back up once there is headroom. Every band draws on that one
// canvas, so the drop's lens, the slime and the dish all shrink with it, and so does the detail the shaders judge in
// device px (the barnacles under half a device px, the strokes' coverage). Pure: the session hands it each drawn
// frame's time and CPU share, read off the injected clock.

import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import { HALF } from '../geometry';

/** A drawn frame, as the governor judges it. */
export interface DiveGovernedFrame {
  /** When it was drawn, on the injected clock. */
  readonly nowMs: number;
  /** Its CPU work no resolution can shorten: the dive's whole frame on the page's thread. */
  readonly cpuMs: number;
  /** The most it may render at this frame: the screen's ratio, or less while the dive falls. */
  readonly ceiling: number;
  /**
   * Whether the frame is one to judge: not while a bake runs on the page (the autoplay waits for them; their slices
   * slow the frames whatever the resolution) or the evidence probe draws frames back to back.
   */
  readonly isJudged: boolean;
}

/** The governor's ladder from `top` down: `stepRatio` a notch, ending on the floor (or `top` when that is lower). */
export function diveResolutionLadder(top: number): number[] {
  const { stepRatio, floorResolution } = DIVE_RESOLUTION_GOVERNOR;
  const ladder: number[] = [];
  for (let resolution = top; resolution > floorResolution; resolution *= stepRatio) ladder.push(resolution);
  ladder.push(Math.min(top, floorResolution));
  return ladder;
}

/** The median of a few numbers. */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length * HALF);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) * HALF;
}

/**
 * How many notches down a frame of `gapMs` (of which `cpuMs` is CPU work) must go to fit the target, when the rest is
 * the GPU's and scales with the pixels: at least one; none when the CPU alone is over budget (fewer pixels would not
 * help).
 */
export function diveNotchesDown(gapMs: number, cpuMs: number): number {
  const budgetMs = DIVE_TARGET_FRAME_MS - cpuMs;
  const gpuMs = gapMs - cpuMs;
  if (budgetMs <= 0 || gpuMs <= budgetMs) return 0;
  const pixelShare = budgetMs / gpuMs;
  // The scale shrinks both sides, so the pixels go by its square: a notch is stepRatio² of them.
  return Math.max(1, Math.ceil(Math.log(pixelShare) / (2 * Math.log(DIVE_RESOLUTION_GOVERNOR.stepRatio))));
}

export class DiveResolutionGovernor {
  private readonly ladder: number[];
  private level = 0;
  private lastFrameMs: number | null = null;
  private gapsMs: number[] = [];
  private cpusMs: number[] = [];
  private onBudgetSinceMs: number | null = null;
  private steppedUpAtMs: number | null = null;
  private stepUpAfterMs: number = DIVE_RESOLUTION_GOVERNOR.stepUpAfterMs;
  /** The last step down, until the window after it says whether it helped. */
  private stepToCheck: { readonly fromLevel: number; readonly gapMs: number } | null = null;
  private stepDownHeldUntilMs = Number.NEGATIVE_INFINITY;
  private uselessStepHoldMs: number = DIVE_RESOLUTION_GOVERNOR.uselessStepHoldMs;
  private ceiling: number;

  /** `top`: the dive's own device pixel ratio, the most it ever renders at. */
  constructor(top: number) {
    this.ladder = diveResolutionLadder(top);
    this.ceiling = top;
  }

  /** The device px per css px the canvas renders at now. */
  get resolution(): number {
    return Math.min(this.ceiling, this.ladder[this.level] ?? this.ceiling);
  }

  /** The notch it stands on, 0 the top: the evidence probe's reading. */
  get notch(): number {
    return this.level;
  }

  /** The next frame does not follow the last one drawn (nothing drew, the stage was off screen, a bake ran). */
  interrupt(): void {
    this.lastFrameMs = null;
    this.onBudgetSinceMs = null;
    this.restartWindow();
  }

  /** Notes a drawn frame; answers whether the resolution changed for the next one. */
  noteFrame(frame: DiveGovernedFrame): boolean {
    const before = this.resolution;
    const last = this.lastFrameMs;
    if (!frame.isJudged) {
      this.ceiling = frame.ceiling;
      this.interrupt();
      return this.resolution !== before;
    }
    if (frame.ceiling !== this.ceiling) {
      // The dive started or stopped falling: frames at the old ceiling say nothing of the new one.
      this.ceiling = frame.ceiling;
      this.restartWindow();
    } else if (last !== null && frame.nowMs - last <= DIVE_RESOLUTION_GOVERNOR.maxGapMs) {
      this.gapsMs.push(frame.nowMs - last);
      this.cpusMs.push(frame.cpuMs);
      if (this.isWindowFull()) this.judge(frame.nowMs);
    }
    // A step restarts the window with this frame unseen: the next one carries the canvas's resize.
    this.lastFrameMs = this.resolution === before ? frame.nowMs : null;
    return this.resolution !== before;
  }

  /** `windowFrames` gaps, or fewer slow ones that already span `windowMs` (software GL's frames take seconds). */
  private isWindowFull(): boolean {
    const { windowFrames, minWindowFrames, windowMs } = DIVE_RESOLUTION_GOVERNOR;
    const count = this.gapsMs.length;
    if (count >= windowFrames) return true;
    return count >= minWindowFrames && this.gapsMs.reduce((total, gapMs) => total + gapMs, 0) >= windowMs;
  }

  /** A full window: step down when over budget, else count the time on budget toward a notch up. */
  private judge(nowMs: number): void {
    const gapMs = medianOf(this.gapsMs);
    const cpuMs = medianOf(this.cpusMs);
    this.gapsMs.shift();
    this.cpusMs.shift();
    if (this.isUselessStepUndone(nowMs, gapMs)) return;
    if (gapMs > DIVE_TARGET_FRAME_MS * DIVE_RESOLUTION_GOVERNOR.slowFrameRatio) {
      this.onBudgetSinceMs = null;
      if (nowMs >= this.stepDownHeldUntilMs) this.stepDown(nowMs, diveNotchesDown(gapMs, cpuMs), gapMs);
      return;
    }
    this.onBudgetSinceMs ??= nowMs;
    if (this.steppedUpAtMs !== null && nowMs - this.steppedUpAtMs > DIVE_RESOLUTION_GOVERNOR.probeFailMs) {
      // The notch up held: the next one is tried after the first wait again.
      this.steppedUpAtMs = null;
      this.stepUpAfterMs = DIVE_RESOLUTION_GOVERNOR.stepUpAfterMs;
    }
    if (nowMs - this.onBudgetSinceMs >= this.stepUpAfterMs) this.stepUp(nowMs);
  }

  /**
   * The first window after a step down: when its frames came no quicker, the step was not the GPU's to fix. It is
   * undone, and steps down wait a while, longer each time in a row; one that helped puts that wait back.
   */
  private isUselessStepUndone(nowMs: number, gapMs: number): boolean {
    const step = this.stepToCheck;
    if (step === null) return false;
    this.stepToCheck = null;
    if (gapMs <= step.gapMs * DIVE_RESOLUTION_GOVERNOR.helpRatio) {
      this.uselessStepHoldMs = DIVE_RESOLUTION_GOVERNOR.uselessStepHoldMs;
      return false;
    }
    this.level = step.fromLevel;
    this.stepDownHeldUntilMs = nowMs + this.uselessStepHoldMs;
    this.uselessStepHoldMs = Math.min(DIVE_RESOLUTION_GOVERNOR.maxStepUpAfterMs, this.uselessStepHoldMs * 2);
    this.restartWindow();
    return true;
  }

  private stepDown(nowMs: number, notches: number, gapMs: number): void {
    if (notches === 0) return;
    // The first notch is the first rung under what renders now: under a lower ceiling the rungs above it change nothing.
    let level = this.level;
    while (level < this.ladder.length - 1 && (this.ladder[level] ?? 0) >= this.resolution) level += 1;
    const target = Math.min(this.ladder.length - 1, level + notches - 1);
    if (target === this.level) return;
    if (this.steppedUpAtMs !== null && nowMs - this.steppedUpAtMs <= DIVE_RESOLUTION_GOVERNOR.probeFailMs) {
      this.stepUpAfterMs = Math.min(DIVE_RESOLUTION_GOVERNOR.maxStepUpAfterMs, this.stepUpAfterMs * 2);
    }
    this.steppedUpAtMs = null;
    this.stepToCheck = { fromLevel: this.level, gapMs };
    this.level = target;
    this.restartWindow();
  }

  /** One notch up, when the rung above would render more than now (not past the ceiling). */
  private stepUp(nowMs: number): void {
    this.onBudgetSinceMs = null;
    if (this.level === 0 || (this.ladder[this.level] ?? 0) >= this.ceiling) return;
    this.level -= 1;
    this.steppedUpAtMs = nowMs;
    this.restartWindow();
  }

  /** Frames drawn at the old resolution say nothing of the new one. */
  private restartWindow(): void {
    this.gapsMs = [];
    this.cpusMs = [];
  }
}
