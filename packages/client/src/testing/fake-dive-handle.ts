// The recording `OPENING_DIVE` a component spec provides (docs/rendering/opening-dive.md §5): the lobby's dive
// panel asks for a `DiveHandle`, and no spec of the Angular side builds a `DiveSession` (it would need Pixi, a 2D
// canvas and the coastlines). The session's own behaviour is `dive-session.spec.ts`'s, over the fake Pixi app.

import type { Provider } from '@angular/core';
import type { DivePhaseStop } from '../app/game/render/constants';
import { diveViewAt } from '../app/game/render/dive/dive-view';
import {
  OPENING_DIVE,
  type DiveFrameState,
  type DiveHandle,
  type DiveHostOptions,
} from '../app/game/render/dive/dive-host';
import type { DiveFrameTimesReport } from '../app/game/render/dive/dive-frame-times';

const NO_FRAME_TIMES: DiveFrameTimesReport = {
  frames: 0,
  upperBandsMs: 0,
  planetMs: 0,
  shoreMs: 0,
  dishMs: 0,
  submitMs: 0,
};

export class RecordingDiveHandle implements DiveHandle {
  readonly played: { stop: DivePhaseStop; isMotionReduced: boolean }[] = [];
  readonly scrubs: number[] = [];
  readonly visibility: boolean[] = [];
  readonly stageSizes: { readonly width: number; readonly height: number }[] = [];
  startCount = 0;
  pauseToggles = 0;
  skipCount = 0;
  destroyCount = 0;
  /** What `skip` answers: whether an opening was playing. */
  isSkippable = false;
  /** What `start` settles with: `true`, `false` (it could not open) or a rejection. */
  startOutcome: boolean | Error = true;

  constructor(readonly options: DiveHostOptions) {}

  start(): Promise<boolean> {
    this.startCount += 1;
    const outcome = this.startOutcome;
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
  }

  playPhase(stop: DivePhaseStop, isMotionReduced: boolean): void {
    this.played.push({ stop, isMotionReduced });
  }

  togglePause(): void {
    this.pauseToggles += 1;
  }

  scrub(zoom: number): void {
    this.scrubs.push(zoom);
  }

  skip(): boolean {
    this.skipCount += 1;
    return this.isSkippable;
  }

  setIsVisible(isVisible: boolean): void {
    this.visibility.push(isVisible);
  }

  resizeStage(sizePx: { readonly width: number; readonly height: number }): void {
    this.stageSizes.push(sizePx);
  }

  takeFrameTimes(): DiveFrameTimesReport {
    return NO_FRAME_TIMES;
  }

  probeFrames(): DiveFrameTimesReport {
    return NO_FRAME_TIMES;
  }

  destroy(): void {
    this.destroyCount += 1;
  }

  /** Reports a frame at `zoom` as the session would, with the controls where the spec says. */
  emitFrame(zoom: number, controls: Partial<Omit<DiveFrameState, 'view'>> = {}): void {
    const view = diveViewAt({
      zoom,
      viewport: { width: 1200, height: 675 },
      timeSeconds: 0,
      isMoving: false,
      globeIdleSpinDegrees: 0,
    });
    this.options.onFrame({ view, isPlaying: false, isPaused: false, stopShown: null, hasArrived: false, ...controls });
  }
}

/** The provider and the handles it made, newest last. */
export function provideRecordingDive(startOutcome: boolean | Error = true): {
  readonly provider: Provider;
  readonly handles: RecordingDiveHandle[];
} {
  const handles: RecordingDiveHandle[] = [];
  return {
    handles,
    provider: {
      provide: OPENING_DIVE,
      useValue: (options: DiveHostOptions) => {
        const handle = new RecordingDiveHandle(options);
        handle.startOutcome = startOutcome;
        handles.push(handle);
        return handle;
      },
    },
  };
}
