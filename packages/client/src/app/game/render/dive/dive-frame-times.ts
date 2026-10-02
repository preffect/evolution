// What a dive frame costs, per band (docs/rendering/opening-dive.md §6): the upper bands' canvas drawing, the planet
// (its uniforms and its draw into its render texture), the shore band (its uniforms and its one draw call, ticket
// #801), the game renderer's dish (its CPU work outside the submit) and the submit itself (the game canvas's draw
// calls; the upper bands' canvas is composited by the browser, never uploaded). Script milliseconds on the injected
// clock: the evidence box has no GPU, so this is the number
// the bands are compared by. A reader takes the means since its last take.

import type { Clock } from '@evolution/shared';

export interface DiveFrameTimesReport {
  readonly frames: number;
  readonly upperBandsMs: number;
  readonly planetMs: number;
  readonly shoreMs: number;
  readonly dishMs: number;
  readonly submitMs: number;
}

export class DiveFrameTimes {
  private frames = 0;
  private upperBandsTotalMs = 0;
  private planetTotalMs = 0;
  private shoreTotalMs = 0;
  private dishTotalMs = 0;
  private submitTotalMs = 0;

  constructor(private readonly clock: Clock) {}

  private timed(work: () => void): number {
    const startedMs = this.clock.nowMilliseconds();
    work();
    return this.clock.nowMilliseconds() - startedMs;
  }

  measureUpperBands(work: () => void): void {
    this.upperBandsTotalMs += this.timed(work);
  }

  measurePlanet(work: () => void): void {
    this.planetTotalMs += this.timed(work);
  }

  measureShore(work: () => void): void {
    this.shoreTotalMs += this.timed(work);
  }

  measureSubmit(work: () => void): void {
    this.submitTotalMs += this.timed(work);
  }

  /** The renderer's frame, less any submit measured inside it. */
  measureDish<T>(work: () => T): T {
    const submitBeforeMs = this.submitTotalMs;
    let result: T | undefined;
    const elapsedMs = this.timed(() => {
      result = work();
    });
    this.dishTotalMs += elapsedMs - (this.submitTotalMs - submitBeforeMs);
    return result as T;
  }

  endFrame(): void {
    this.frames += 1;
  }

  /** The mean per frame of each since the last take; zeros when no frame was drawn. */
  take(): DiveFrameTimesReport {
    const perFrame = (totalMs: number): number => (this.frames === 0 ? 0 : totalMs / this.frames);
    const report = {
      frames: this.frames,
      upperBandsMs: perFrame(this.upperBandsTotalMs),
      planetMs: perFrame(this.planetTotalMs),
      shoreMs: perFrame(this.shoreTotalMs),
      dishMs: perFrame(this.dishTotalMs),
      submitMs: perFrame(this.submitTotalMs),
    };
    this.frames = 0;
    this.upperBandsTotalMs = 0;
    this.planetTotalMs = 0;
    this.shoreTotalMs = 0;
    this.dishTotalMs = 0;
    this.submitTotalMs = 0;
    return report;
  }
}
