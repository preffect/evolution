// What a dive frame costs, per band (docs/rendering/opening-dive.md §6): the upper bands (the planet's forest test),
// the planet (its uniforms and its draw into its render texture), the shore band (its uniforms, ticket #801), the kelp
// band (its uniforms, ticket #802), the slime band (its uniforms, sprites and strokes, ticket #803), the game
// renderer's dish (its CPU work outside the submit) and the submit itself (the dive canvas's draw calls: every band
// draws on it). Script milliseconds on the injected clock, the number the bands are compared by on a box whose GPU is
// software (ticket #208's rule). A reader takes the means since its last take.

import type { Clock } from '@evolution/shared';

export interface DiveFrameTimesReport {
  readonly frames: number;
  readonly upperBandsMs: number;
  readonly planetMs: number;
  readonly shoreMs: number;
  readonly kelpMs: number;
  readonly slimeMs: number;
  readonly dishMs: number;
  readonly submitMs: number;
}

type Column = Exclude<keyof DiveFrameTimesReport, 'frames'>;

const COLUMNS: readonly Column[] = ['upperBandsMs', 'planetMs', 'shoreMs', 'kelpMs', 'slimeMs', 'dishMs', 'submitMs'];
/**
 * The columns that hand work to the GPU process (the planet's draw into its texture, the submit). A GPU behind blocks
 * them once its queue is full, so that time is the GPU's, not the page's: the resolution governor leaves it out of a
 * frame's CPU work.
 */
const GPU_ISSUE_COLUMNS: ReadonlySet<Column> = new Set(['planetMs', 'submitMs']);

function zeroTotals(): Record<Column, number> {
  return Object.fromEntries(COLUMNS.map((column) => [column, 0])) as Record<Column, number>;
}

export class DiveFrameTimes {
  private frames = 0;
  private totals = zeroTotals();
  private frameIssueMs = 0;
  private lastFrameIssueMsValue = 0;

  constructor(private readonly clock: Clock) {}

  private timed(work: () => void): number {
    const startedMs = this.clock.nowMilliseconds();
    work();
    return this.clock.nowMilliseconds() - startedMs;
  }

  private measure(column: Column, work: () => void): void {
    const elapsedMs = this.timed(work);
    this.totals[column] += elapsedMs;
    if (GPU_ISSUE_COLUMNS.has(column)) this.frameIssueMs += elapsedMs;
  }

  measureUpperBands(work: () => void): void {
    this.measure('upperBandsMs', work);
  }

  measurePlanet(work: () => void): void {
    this.measure('planetMs', work);
  }

  measureShore(work: () => void): void {
    this.measure('shoreMs', work);
  }

  measureKelp(work: () => void): void {
    this.measure('kelpMs', work);
  }

  measureSlime(work: () => void): void {
    this.measure('slimeMs', work);
  }

  measureSubmit(work: () => void): void {
    this.measure('submitMs', work);
  }

  /** The renderer's frame, less any submit measured inside it. */
  measureDish<T>(work: () => T): T {
    const submitBeforeMs = this.totals.submitMs;
    let result: T | undefined;
    const elapsedMs = this.timed(() => {
      result = work();
    });
    this.totals.dishMs += elapsedMs - (this.totals.submitMs - submitBeforeMs);
    return result as T;
  }

  endFrame(): void {
    this.frames += 1;
    this.lastFrameIssueMsValue = this.frameIssueMs;
    this.frameIssueMs = 0;
  }

  /** The last frame's time handing work to the GPU (`GPU_ISSUE_COLUMNS`). */
  get lastFrameIssueMs(): number {
    return this.lastFrameIssueMsValue;
  }

  /** The mean per frame of each since the last take; zeros when no frame was drawn. */
  take(): DiveFrameTimesReport {
    const frames = this.frames;
    const report = { frames } as Record<keyof DiveFrameTimesReport, number>;
    for (const column of COLUMNS) report[column] = frames === 0 ? 0 : this.totals[column] / frames;
    this.frames = 0;
    this.totals = zeroTotals();
    return report as DiveFrameTimesReport;
  }
}
