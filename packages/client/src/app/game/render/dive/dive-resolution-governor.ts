// The dive's resolution governor (docs/rendering/opening-dive.md §6, tickets #804 and #816): when its frames run over
// budget it steps the dive canvas's device px per css px down, and back up once there is headroom. Every band draws on that one
// canvas, so the drop's lens, the slime and the dish all shrink with it, and so does the detail the shaders judge in
// device px (the barnacles under half a device px, the strokes' coverage). Pure: the session hands it each drawn
// frame's time and CPU share, read off the injected clock.

import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import {
  DiveFrameSpan,
  LEAP_FRAME_MS,
  SLIGHTLY_SLOW_FRAME_MS,
  SLOW_FRAME_MS,
  sumOf,
  windowVerdict,
} from './dive-governor-window';

/** The frames the page's own work may average for a span's trial: past it, the page misses its vsyncs itself. */
const TRIAL_CPU_MS = DIVE_TARGET_FRAME_MS * DIVE_RESOLUTION_GOVERNOR.trialCpuShare;

/** A step down to check: the notch it left, and the gap the frames after it must come under for it to stay. */
interface StepCheck {
  readonly fromLevel: number;
  readonly helpedUnderMs: number;
  /** A span's trial, checked by the next span; else checked by the next window. */
  readonly isTrial: boolean;
}

/** How a step's frames are judged, whatever notch it left. */
type StepCheckRule = Omit<StepCheck, 'fromLevel'>;

/** A drawn frame, as the governor judges it. */
export interface DiveGovernedFrame {
  /** When it was drawn, on the injected clock. */
  readonly nowMs: number;
  /** Its CPU work no resolution can shorten: the dive's whole frame on the page's thread. */
  readonly cpuMs: number;
  /** The most it may render at this frame: the screen's ratio, or less while the dive falls. */
  readonly ceiling: number;
  /**
   * The page's time in bake slices since the frame before (`DiveBakeTime`): a slice slows a frame whatever the
   * resolution, so it is left out of the gap.
   */
  readonly bakeMs: number;
  /**
   * Whether the frame is one to judge: drawn, and not while the renderer builds or the GPU is on the bands' warm-up
   * (their draws, uploads and mipmaps slow the frames whatever the resolution).
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

/**
 * How many notches down a frame of `gapMs` (of which `cpuMs` is CPU work) goes: none when it fits or the CPU alone is
 * over budget (fewer pixels would not help); one when it is a little over; past `leapRatio` times the target, as many
 * as the pixels must shrink by for the GPU's share, the rest, to fit.
 */
export function diveNotchesDown(gapMs: number, cpuMs: number): number {
  const budgetMs = DIVE_TARGET_FRAME_MS - cpuMs;
  const gpuMs = gapMs - cpuMs;
  if (budgetMs <= 0 || gpuMs <= budgetMs) return 0;
  if (gapMs < LEAP_FRAME_MS) return 1;
  const pixelShare = budgetMs / gpuMs;
  // The scale shrinks both sides, so the pixels go by its square: a notch is stepRatio² of them.
  const { stepRatio } = DIVE_RESOLUTION_GOVERNOR;
  return Math.max(1, Math.ceil(Math.log(pixelShare) / Math.log(stepRatio * stepRatio)));
}

export class DiveResolutionGovernor {
  private readonly ladder: number[];
  private level = 0;
  private lastFrameMs: number | null = null;
  private gapsMs: number[] = [];
  private cpusMs: number[] = [];
  private onBudgetSinceMs: number | null = null;
  /** Since when every window judged has been over budget throughout. */
  private overBudgetSinceMs: number | null = null;
  private steppedUpAtMs: number | null = null;
  private stepUpAfterMs: number = DIVE_RESOLUTION_GOVERNOR.stepUpAfterMs;
  /** The last step down, until the window (or span) after it says whether it helped. */
  private stepToCheck: StepCheck | null = null;
  /** The frames since the last span, for a GPU a little too slow (ticket #816). */
  private readonly span = new DiveFrameSpan();
  /** When a frame last had bake slices in its gap. */
  private bakedAtMs = Number.NEGATIVE_INFINITY;
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

  /** The notch it stands on, 0 the top. */
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
      // The slices ran between the two frames, on the same thread and clock: never more than the gap.
      const gapMs = frame.nowMs - last - frame.bakeMs;
      this.gapsMs.push(gapMs);
      if (frame.bakeMs > 0) this.bakedAtMs = frame.nowMs;
      this.cpusMs.push(frame.cpuMs);
      this.span.add(gapMs, frame.cpuMs);
      if (this.isWindowFull()) this.judge(frame.nowMs);
      if (this.span.isFull) this.judgeSpan(frame.nowMs);
    } else if (last !== null) {
      this.restartWindow();
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
    return count >= minWindowFrames && sumOf(this.gapsMs) >= windowMs;
  }

  /**
   * A full window: step down when over budget, else count the time on budget toward a notch up. A step only the mean
   * decided, in a window with no bake running, is checked like a one-notch step: stalls of the page's among quick
   * frames (no bake slice, no GPU behind) are no quicker with fewer pixels, and that step is undone.
   */
  private judge(nowMs: number): void {
    const { gapMs, cpuMs, isSustained, isMeanOnly } = windowVerdict(this.gapsMs, this.cpusMs);
    const isChecked = isMeanOnly && this.hasNoBakeInWindow(nowMs);
    this.gapsMs.shift();
    this.cpusMs.shift();
    if (this.isUselessStepUndone(nowMs, gapMs, false)) return;
    if (gapMs > SLOW_FRAME_MS) {
      // Over budget: a step only when nearly every frame is; scattered missed vsyncs are the page's, and wait it out.
      this.onBudgetSinceMs = null;
      this.overBudgetSinceMs = isSustained ? (this.overBudgetSinceMs ?? nowMs) : null;
      if (!this.isOverBudgetLongEnough(nowMs)) return;
      const notches = diveNotchesDown(gapMs, cpuMs);
      const isWindowChecked = notches === 1 || isChecked;
      this.stepDown(nowMs, notches, isWindowChecked ? windowCheck(gapMs) : null);
      return;
    }
    this.noteOnBudget(nowMs);
  }

  /** A window on budget: the time on budget counts toward a notch up. */
  private noteOnBudget(nowMs: number): void {
    this.overBudgetSinceMs = null;
    this.onBudgetSinceMs ??= nowMs;
    if (this.steppedUpAtMs !== null && nowMs - this.steppedUpAtMs > DIVE_RESOLUTION_GOVERNOR.probeFailMs) {
      // The notch up held: the next one is tried after the first wait again.
      this.steppedUpAtMs = null;
      this.stepUpAfterMs = DIVE_RESOLUTION_GOVERNOR.stepUpAfterMs;
    }
    if (nowMs - this.onBudgetSinceMs >= this.stepUpAfterMs) this.stepUp(nowMs);
  }

  /**
   * A full span (ticket #816): a little too slow, and the page's own work light, tries one notch down, checked by the
   * next span; the time on budget starts again.
   */
  private judgeSpan(nowMs: number): void {
    const verdict = this.span.take();
    if (verdict === null || this.isUselessStepUndone(nowMs, verdict.gapMs, true)) return;
    if (verdict.gapMs <= SLIGHTLY_SLOW_FRAME_MS) return;
    this.onBudgetSinceMs = null;
    if (verdict.cpuMs >= TRIAL_CPU_MS || nowMs < this.stepDownHeldUntilMs) return;
    this.stepDown(nowMs, 1, trialCheck(verdict.gapMs));
  }

  /** Whether no frame of the window, which ends `nowMs`, had bake slices in its gap. */
  private hasNoBakeInWindow(nowMs: number): boolean {
    return this.bakedAtMs < nowMs - sumOf(this.gapsMs);
  }

  /** Over budget throughout for `sustainedMs`, and not holding off after a step that did not help. */
  private isOverBudgetLongEnough(nowMs: number): boolean {
    const since = this.overBudgetSinceMs;
    if (since === null || nowMs < this.stepDownHeldUntilMs) return false;
    return nowMs - since >= DIVE_RESOLUTION_GOVERNOR.sustainedMs;
  }

  /**
   * The first window (a trial's: span) after a step down: when its frames came no quicker, the step was not the GPU's
   * to fix. It is undone, and steps down wait a while, longer each time in a row; one that helped puts that wait back.
   */
  private isUselessStepUndone(nowMs: number, gapMs: number, isSpan: boolean): boolean {
    const step = this.stepToCheck;
    if (step?.isTrial !== isSpan) return false;
    this.stepToCheck = null;
    if (gapMs <= step.helpedUnderMs) {
      this.uselessStepHoldMs = DIVE_RESOLUTION_GOVERNOR.uselessStepHoldMs;
      return false;
    }
    this.level = step.fromLevel;
    this.stepDownHeldUntilMs = nowMs + this.uselessStepHoldMs;
    this.uselessStepHoldMs = Math.min(
      DIVE_RESOLUTION_GOVERNOR.maxStepUpAfterMs,
      this.uselessStepHoldMs * DIVE_RESOLUTION_GOVERNOR.backoffFactor,
    );
    this.restartWindow();
    return true;
  }

  /** `notches` down; `check`, how the frames after it say whether it helped (none for a leap, which always stays). */
  private stepDown(nowMs: number, notches: number, check: StepCheckRule | null): void {
    if (notches === 0) return;
    // The first notch is the first rung under what renders now: under a lower ceiling the rungs above it change nothing.
    let level = this.level;
    while (level < this.ladder.length - 1 && (this.ladder[level] ?? 0) >= this.resolution) level += 1;
    const target = Math.min(this.ladder.length - 1, level + notches - 1);
    if (target === this.level) return;
    if (this.steppedUpAtMs !== null && nowMs - this.steppedUpAtMs <= DIVE_RESOLUTION_GOVERNOR.probeFailMs) {
      // Down again soon after a notch up: that notch did not fit.
      this.stepUpAfterMs = Math.min(
        DIVE_RESOLUTION_GOVERNOR.maxStepUpAfterMs,
        this.stepUpAfterMs * DIVE_RESOLUTION_GOVERNOR.backoffFactor,
      );
    }
    this.steppedUpAtMs = null;
    this.stepToCheck = check === null ? null : { fromLevel: this.level, ...check };
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
    this.span.clear();
    this.overBudgetSinceMs = null;
  }
}

/** A window's step: the next window's median must come under this one's by `helpRatio`. */
function windowCheck(gapMs: number): StepCheckRule {
  return { helpedUnderMs: gapMs * DIVE_RESOLUTION_GOVERNOR.helpRatio, isTrial: false };
}

/** A span's trial: the next span's mean must come under this one's by `helpRatio`, or be a little too slow no more. */
function trialCheck(gapMs: number): StepCheckRule {
  const helpedUnderMs = Math.max(gapMs * DIVE_RESOLUTION_GOVERNOR.helpRatio, SLIGHTLY_SLOW_FRAME_MS);
  return { helpedUnderMs, isTrial: true };
}
