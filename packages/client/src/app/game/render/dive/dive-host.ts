// The seam the lobby's dive panel sees (docs/rendering/opening-dive.md §1): a `DiveHandle`, asked for through the
// `OPENING_DIVE` token the way the encyclopedia asks for its preview (`preview/preview-host.ts`). A component spec
// provides a recording fake and never builds a `DiveSession`, so no component spec touches Pixi.

import { InjectionToken, inject } from '@angular/core';
import type { BalanceConfig, Clock, Scheduler } from '@evolution/shared';
import { CLOCK, SCHEDULER } from '../../clock-provider';
import type { DivePhaseStop } from '../constants';
import { createPixiApp } from '../pixi-app';
import type { DiveControls } from './dive-controls';
import type { DiveFrameTimesReport } from './dive-frame-times';
import { loadDiveUpperBands, type DiveUpperBandsLoader } from './dive-band-loader';
import { DiveSession, type DiveSessionDependencies } from './dive-session';
import type { DiveView } from './dive-view';

/** What the panel shows each frame: the view, and where the controls stand. */
export interface DiveFrameState {
  readonly view: DiveView;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  /** The stop being played toward or last reached: the phase flag's text and colour. */
  readonly stopShown: DivePhaseStop | null;
  /** Set once the dive has arrived at that stop: the flag shows. */
  readonly hasArrived: boolean;
}

export interface DiveHandle {
  /** Opens the dive; `false` when `destroy` ran first. */
  start(): Promise<boolean>;
  playPhase(stop: DivePhaseStop, isMotionReduced: boolean): void;
  togglePause(): void;
  scrub(zoom: number): void;
  /** Space or Esc: `true` when a playing opening jumped to its stop. */
  skip(): boolean;
  setIsVisible(isVisible: boolean): void;
  /** The stage's new size in CSS px: the canvases follow it. */
  resizeStage(sizePx: { readonly width: number; readonly height: number }): void;
  /** The mean script ms per frame of each band since the last take. */
  takeFrameTimes(): DiveFrameTimesReport;
  /** The evidence probe: `frames` frames at `zoom` back to back, and their mean script ms per band. */
  probeFrames(zoom: number, frames: number): DiveFrameTimesReport;
  destroy(): void;
}

export interface DiveHostOptions {
  /** The stage element the canvas fills. */
  readonly host: HTMLElement;
  readonly balance: () => BalanceConfig;
  readonly isMotionReduced: () => boolean;
  readonly onFrame: (state: DiveFrameState) => void;
}

export type DiveHostFactory = (options: DiveHostOptions) => DiveHandle;

export interface DiveHandleDependencies {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly devicePixelRatio: number;
  /** The real Pixi app and upper bands unless a spec passes its fakes, and the cytoplasm tile a spec shrinks. */
  readonly createPixiApp?: DiveSessionDependencies['createPixiApp'];
  readonly loadUpperBands?: DiveUpperBandsLoader;
  readonly noiseTileSizePx?: number;
}

/** What the panel is told of a frame: the view, and the controls as they stand after it. */
export function diveFrameStateOf(view: DiveView, controls: DiveControls): DiveFrameState {
  return {
    view,
    isPlaying: controls.isPlaying,
    isPaused: controls.isPaused,
    stopShown: controls.stopShown,
    hasArrived: controls.stopReached !== null,
  };
}

/** The real seam: one `DiveSession` on its own Pixi app, the injected clock and the lazily loaded upper bands. */
export function createDiveHandle(options: DiveHostOptions, dependencies: DiveHandleDependencies): DiveHandle {
  const session: DiveSession = new DiveSession({
    host: options.host,
    clock: dependencies.clock,
    scheduler: dependencies.scheduler,
    devicePixelRatio: dependencies.devicePixelRatio,
    createPixiApp: dependencies.createPixiApp ?? createPixiApp,
    loadUpperBands: dependencies.loadUpperBands ?? loadDiveUpperBands,
    noiseTileSizePx: dependencies.noiseTileSizePx,
    balance: options.balance,
    isMotionReduced: options.isMotionReduced,
    onView: (view) => options.onFrame(diveFrameStateOf(view, session.controls)),
  });
  const nowMs = (): number => dependencies.clock.nowMilliseconds();
  /** Every control: the reader has taken over, and a still dive draws the change. */
  const control = <T>(act: () => T): T => {
    session.controls.cancelAutoplay();
    const result = act();
    session.requestFrame();
    return result;
  };
  return {
    start: () => session.start(),
    playPhase: (stop, isMotionReduced) => control(() => session.controls.playPhase(stop, nowMs(), isMotionReduced)),
    togglePause: () => control(() => session.controls.togglePause(nowMs())),
    scrub: (zoom) => control(() => session.controls.scrub(zoom)),
    // Only a skip that happened is the reader taking over: Space typed into a still lobby changes nothing.
    skip: () => {
      const hasSkipped = session.controls.skip();
      if (hasSkipped) session.requestFrame();
      return hasSkipped;
    },
    setIsVisible: (isVisible) => session.setIsVisible(isVisible),
    resizeStage: (sizePx) => session.resizeStage(sizePx),
    takeFrameTimes: () => session.frameTimes.take(),
    probeFrames: (zoom, frames) => session.probeFrames(zoom, frames),
    destroy: () => session.destroy(),
  };
}

const DEFAULT_DEVICE_PIXEL_RATIO = 1;

export const OPENING_DIVE = new InjectionToken<DiveHostFactory>('OpeningDive', {
  providedIn: 'root',
  factory: () => {
    const clock = inject(CLOCK);
    const scheduler = inject(SCHEDULER);
    return (options) =>
      createDiveHandle(options, {
        clock,
        scheduler,
        devicePixelRatio: options.host.ownerDocument.defaultView?.devicePixelRatio ?? DEFAULT_DEVICE_PIXEL_RATIO,
      });
  },
});
