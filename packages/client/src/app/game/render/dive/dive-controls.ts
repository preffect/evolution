// The dive's controls (docs/rendering/opening-dive.md §5): play a phase's opening, pause and resume it, scrub, and
// skip to the stop. Pure: every call takes the time it happens at, read by the caller off the injected clock, so a
// spec drives it with plain numbers. One clock drives the zoom; the ambient motion is the session's.

import {
  DIVE_MS_PER_ZOOM_STEP,
  DIVE_PHASE_STOPS,
  DIVE_PLAY_HOLD_MS,
  DIVE_ZOOM_TOP,
  type DivePhaseStop,
} from '../constants';
import { HALF, clamp01 } from '../geometry';
import { clampDiveZoom } from './dive-camera';

/** The phase whose opening the lobby plays: the first, the whole dive down to the dish. */
export const DIVE_FIRST_PHASE: DivePhaseStop = DIVE_PHASE_STOPS[0] as DivePhaseStop;

const CUBIC = 3;
const CUBIC_IN_SCALE = 4;
const CUBIC_OUT_SCALE = 2;

/** The dive's ease (`ease` in the mockup): a cubic in-out, slow off the top and slow into the stop. */
export function diveEase(unit: number): number {
  const clamped = clamp01(unit);
  if (clamped < HALF) return CUBIC_IN_SCALE * clamped * clamped * clamped;
  return 1 - Math.pow(CUBIC_OUT_SCALE - CUBIC_OUT_SCALE * clamped, CUBIC) / CUBIC_OUT_SCALE;
}

/** How long a phase's opening falls for, after the hold: `DIVE_MS_PER_ZOOM_STEP` per power of ten. */
export function diveFallMs(stop: DivePhaseStop): number {
  return (DIVE_ZOOM_TOP - stop.zoom) * DIVE_MS_PER_ZOOM_STEP;
}

interface DivePlay {
  readonly stop: DivePhaseStop;
  /** When the play started, moved on by every paused span so the paused time never plays. */
  readonly startedAtMs: number;
  readonly pausedAtMs: number | null;
}

export class DiveControls {
  private zoomValue = DIVE_ZOOM_TOP;
  private play: DivePlay | null = null;
  private arrivedStop: DivePhaseStop | null = null;
  /** When phase 1's opening plays on its own; `null` once it has, or once the reader took the controls. */
  private autoplayAtMs: number | null = null;

  get zoom(): number {
    return this.zoomValue;
  }

  get isPlaying(): boolean {
    return this.play !== null;
  }

  get isPaused(): boolean {
    return (this.play?.pausedAtMs ?? null) !== null;
  }

  /** The stop the last play reached, for the phase flag; cleared by a new play or a scrub. */
  get stopReached(): DivePhaseStop | null {
    return this.arrivedStop;
  }

  /** The stop the dive is playing toward or reached last; the flag's text and colour. */
  get stopShown(): DivePhaseStop | null {
    return this.play?.stop ?? this.arrivedStop;
  }

  /** Plays `stop`'s opening from the top; with reduced motion it jumps straight to the stop. */
  playPhase(stop: DivePhaseStop, nowMs: number, isMotionReduced: boolean): void {
    this.arrivedStop = null;
    if (isMotionReduced) {
      this.arrive(stop);
      return;
    }
    this.zoomValue = DIVE_ZOOM_TOP;
    this.play = { stop, startedAtMs: nowMs, pausedAtMs: null };
  }

  /** Pause, or resume where it paused; nothing while no opening is playing. */
  togglePause(nowMs: number): void {
    const play = this.play;
    if (play === null) return;
    if (play.pausedAtMs === null) {
      this.play = { ...play, pausedAtMs: nowMs };
      return;
    }
    this.play = { ...play, startedAtMs: play.startedAtMs + (nowMs - play.pausedAtMs), pausedAtMs: null };
  }

  /** Space or Esc: a playing opening jumps to its stop. A paused one is left alone, as is a still dive. */
  skip(): boolean {
    const play = this.play;
    if (play === null || play.pausedAtMs !== null) return false;
    this.arrive(play.stop);
    return true;
  }

  /** The reader drags the slider: the opening stops where it is and the zoom follows the hand. */
  scrub(zoom: number): void {
    this.play = null;
    this.arrivedStop = null;
    this.zoomValue = clampDiveZoom(zoom);
  }

  /** Advances a playing opening to `nowMs` and answers the zoom to draw. */
  tick(nowMs: number): number {
    const play = this.play;
    if (play === null || play.pausedAtMs !== null) return this.zoomValue;
    const unit = clamp01((nowMs - play.startedAtMs - DIVE_PLAY_HOLD_MS) / diveFallMs(play.stop));
    this.zoomValue = DIVE_ZOOM_TOP + (play.stop.zoom - DIVE_ZOOM_TOP) * diveEase(unit);
    if (unit >= 1) this.arrive(play.stop);
    return this.zoomValue;
  }

  /** The lobby plays phase 1's opening on its own at `atMs`, unless the reader moves first. */
  scheduleAutoplay(atMs: number): void {
    this.autoplayAtMs = atMs;
  }

  /** The reader took the controls: the lobby no longer plays the opening on its own. */
  cancelAutoplay(): void {
    this.autoplayAtMs = null;
  }

  /**
   * Phase 1's opening, once, when its time comes and the bands it falls through are ready (`isReady`: their tiles
   * baked, so it never falls into a band still drawing its placeholder); never under reduced motion or once the dive
   * has left the top.
   */
  autoplay(nowMs: number, isMotionReduced: boolean, isReady: boolean): void {
    if (this.autoplayAtMs === null || nowMs < this.autoplayAtMs || !isReady) return;
    this.autoplayAtMs = null;
    if (isMotionReduced || this.isPlaying || this.zoomValue !== DIVE_ZOOM_TOP) return;
    this.playPhase(DIVE_FIRST_PHASE, nowMs, false);
  }

  /** Reduced motion asked for mid-opening: a playing opening, paused or not, is at its stop at once. */
  finishPlay(): void {
    if (this.play !== null) this.arrive(this.play.stop);
  }

  private arrive(stop: DivePhaseStop): void {
    this.play = null;
    this.zoomValue = stop.zoom;
    this.arrivedStop = stop;
  }
}
