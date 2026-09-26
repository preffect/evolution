// The bench route's engine (docs/rendering/budget.md §7), framework-free: parses the query, drives the
// `BenchDriver` and a `GameRenderer` on the app's ticker, and once the report window has run
// hands the frame-budget report to the component. Frames re-render the parked tick, so the report
// measures a steady frame and a screenshot never changes between frames; the debug hook's `step`
// advances the tick and `setSeed` rebuilds the scene.

import type { ClientPerformanceReport, Clock, ValueOf } from '@evolution/shared';
import type { Container } from 'pixi.js';
import { EVOLUTION_DEBUG_MODE, type EvolutionDebugApi } from '../../debug/evolution-debug';
import type { RenderFrame } from '../../net/world-store';
import {
  RENDER_BENCH_DEFAULT_TICK,
  RENDER_BENCH_DEFAULT_ZOOM,
  RENDER_BENCH_REPORT_FRAMES,
  RENDER_BENCH_SEED,
  RENDER_BENCH_VIEWPORT_PX,
  RENDER_BENCH_WARMUP_FRAMES,
} from '../constants';
import { numberParameter, positiveParameter } from '../../route-query';
import { FrameLoopSession } from '../frame-loop-session';
import type { GameRenderer } from '../game-renderer';
import { NO_HUD_INPUTS, type RenderInputs, type RenderOutputs } from '../render-io';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import { benchCueFrame } from './bench-cues';
import { BenchDriver } from './bench-driver';
import { BENCH_PARAMETER } from './bench-route';
import { attachIndicatorSheet } from './indicator-sheet';
import type { BenchCounts } from './bench-scene';
import type { GpuTimerStatus } from './gpu-timer';
import { NO_HEAP_PROBE, type HeapProbe } from './heap-probe';
import { benchGate, parseExpectedUnjudged, type BenchGate } from './bench-gate';
import { budgetVerdict, type BudgetRowName, type BudgetVerdict } from './render-benchmark';

export interface BenchQuery {
  readonly seed: number;
  readonly tick: number;
  /** Always positive: a zero or negative `zoom=` falls back to the default rather than dividing by it. */
  readonly zoom: number;
  /** Frames the report's window covers after the warm-up: `RENDER_BENCH_REPORT_FRAMES` unless `window=` shortens it (a slow software GPU). */
  readonly windowFrames: number;
  /**
   * `advance=1`: step the scene one tick per frame, so the snapshot apply and the registry churn §7 budgets as
   * `net` happen inside the window. Off by default — a parked tick is the steady frame a screenshot needs.
   */
  readonly shouldAdvanceTick: boolean;
  /**
   * `preserve=1`: keep the WebGL backbuffer, which `canvas.toDataURL` needs. Off by default, because production
   * does not set it and it costs a full-framebuffer copy a frame on a real GPU (docs/rendering/budget.md §7).
   */
  readonly shouldPreserveDrawingBuffer: boolean;
  /** `cues=1`: draw the own cell's legibility cues at their worst case (`bench-cues.ts`, #385). */
  readonly shouldDrawCues: boolean;
  /** `sheet=indicators`: the own-cell indicator textures' contact sheet over the scene (`indicator-sheet.ts`). */
  readonly sheet: BenchSheet | null;
  /** `expectUnjudged=gpu,…`: the rows this run expects the verdict to leave unjudged (`bench-gate.ts`, #264). */
  readonly expectedUnjudged: readonly BudgetRowName[];
}

export const BENCH_SHEET = { indicators: 'indicators' } as const;
export type BenchSheet = ValueOf<typeof BENCH_SHEET>;

const SHEET_PARAMETER = 'sheet';
const TICK_PARAMETER = 'tick';
const ZOOM_PARAMETER = 'zoom';
const WINDOW_PARAMETER = 'window';
const ADVANCE_PARAMETER = 'advance';
const PRESERVE_PARAMETER = 'preserve';
const CUES_PARAMETER = 'cues';
const EXPECT_UNJUDGED_PARAMETER = 'expectUnjudged';
const FLAG_ON = '1';

/**
 * `?bench=<seed>&tick=<n>&zoom=<z>&window=<frames>&advance=1&preserve=1&cues=1&expectUnjudged=<rows>`, each with its
 * default; `bench` alone selects the route.
 */
export function parseBenchQuery(search: string): BenchQuery {
  const parameters = new URLSearchParams(search);
  return {
    seed: Math.trunc(numberParameter(parameters, BENCH_PARAMETER, RENDER_BENCH_SEED)),
    tick: Math.trunc(numberParameter(parameters, TICK_PARAMETER, RENDER_BENCH_DEFAULT_TICK)),
    zoom: positiveParameter(parameters, ZOOM_PARAMETER, RENDER_BENCH_DEFAULT_ZOOM),
    windowFrames: Math.max(1, Math.trunc(numberParameter(parameters, WINDOW_PARAMETER, RENDER_BENCH_REPORT_FRAMES))),
    shouldAdvanceTick: parameters.get(ADVANCE_PARAMETER) === FLAG_ON,
    shouldPreserveDrawingBuffer: parameters.get(PRESERVE_PARAMETER) === FLAG_ON,
    shouldDrawCues: parameters.get(CUES_PARAMETER) === FLAG_ON,
    sheet: parameters.get(SHEET_PARAMETER) === BENCH_SHEET.indicators ? BENCH_SHEET.indicators : null,
    expectedUnjudged: parseExpectedUnjudged(parameters.get(EXPECT_UNJUDGED_PARAMETER)),
  };
}

/** The wire report plus what only the bench knows: the scene, the window and the verdict. */
export interface RenderBenchReport extends ClientPerformanceReport {
  readonly seed: number;
  readonly tick: number;
  readonly zoom: number;
  /** Frames the report's window covers. */
  readonly frames: number;
  /** Whether the scene advanced a tick per frame (`advance=1`) or the window re-rendered one parked tick. */
  readonly isTickAdvancing: boolean;
  /**
   * Heap **residency** growth over the window after a forced collection, divided by the frames: not an
   * allocation count. A collection inside the window subtracts most of it and nothing here detects that, so
   * the number varies severalfold between runs of the same scene — read it as a range over several runs, never
   * as one figure (docs/rendering/budget.md §7). `null` without a heap probe.
   */
  readonly heapGrowthBytesPerFrame: number | null;
  /** Why `gpuMs` is a number or `null` (docs/rendering/budget.md §7). */
  readonly gpuStatus: GpuTimerStatus;
  readonly verdict: BudgetVerdict;
  /** Whether the run is evidence a PR may quote: the verdict, the expected unjudged rows and `advance=1` (#264). */
  readonly gate: BenchGate;
}

export interface BenchSessionDependencies {
  readonly host: HTMLElement;
  /** The wall clock the stage timer reads; the scene's time is the driver's `ManualClock`. */
  readonly clock: Clock;
  readonly devicePixelRatio: number;
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
  readonly heap?: HeapProbe;
  readonly noiseTileSizePx?: number;
  /** The bench load unless a test shrinks it. */
  readonly counts?: BenchCounts;
  readonly onReport: (report: RenderBenchReport) => void;
  /** Builds the `sheet=indicators` contact sheet; `attachIndicatorSheet` unless a test stands in (BitmapText needs a canvas). */
  readonly attachSheet?: typeof attachIndicatorSheet;
}

const BENCH_INPUTS: RenderInputs = NO_HUD_INPUTS;

export class BenchSession extends FrameLoopSession {
  readonly driver: BenchDriver;
  private readonly heap: HeapProbe;
  private heapAtWindowStart: number | null = null;
  private lastReport: RenderBenchReport | null = null;
  private sheet: Container | null = null;

  constructor(
    private readonly query: BenchQuery,
    private readonly dependencies: BenchSessionDependencies,
  ) {
    super(dependencies.clock, query.windowFrames);
    this.heap = dependencies.heap ?? NO_HEAP_PROBE;
    this.driver = new BenchDriver(query.seed, dependencies.counts);
    this.driver.goToTick(query.tick);
  }

  async start(): Promise<void> {
    const pixi = await this.dependencies.createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      fixedSize: RENDER_BENCH_VIEWPORT_PX,
      shouldPreserveDrawingBuffer: this.query.shouldPreserveDrawingBuffer,
    });
    this.adoptPixiApp(pixi);
    this.rebuildRenderer();
  }

  private rebuildRenderer(): void {
    this.detachSheet();
    const renderer = this.buildRenderer({
      seed: this.driver.world.seed,
      gelPatches: this.driver.store.latestSnapshot()?.gelPatches ?? [],
      devicePixelRatio: this.dependencies.devicePixelRatio,
      noiseTileSizePx: this.dependencies.noiseTileSizePx,
    });
    renderer?.setFixedZoom(this.query.zoom);
    if (renderer !== null && this.pixi !== null && this.query.sheet === BENCH_SHEET.indicators) {
      const attachSheet = this.dependencies.attachSheet ?? attachIndicatorSheet;
      this.sheet = attachSheet(this.pixi.app.stage, renderer.indicatorTextures, RENDER_BENCH_VIEWPORT_PX);
    }
  }

  /** The sheet's sprites go before the textures they draw are rebuilt or disposed. */
  private detachSheet(): void {
    this.sheet?.destroy({ children: true });
    this.sheet = null;
  }

  /** Every frame re-renders the parked tick, unless `advance=1` steps the scene a tick first. */
  protected nextFrame(): RenderFrame | null {
    if (this.query.shouldAdvanceTick) this.driver.step(1);
    return this.driver.frame();
  }

  /** `cues=1` draws the worst-case cues on the own cell, their one-off changes landing on the frame count's cadence. */
  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    const { ownPlayerId } = this.driver.store;
    if (!this.query.shouldDrawCues) return renderer.render(frame, ownPlayerId, BENCH_INPUTS, submit);
    const cued = benchCueFrame(frame, ownPlayerId, this.instrumentation.frameCount);
    return renderer.render(cued.frame, ownPlayerId, cued.inputs, submit);
  }

  /** Opens the window at the end of the warm-up (the GPU timer, the heap) and reports once the window has run. */
  protected afterFrame(outputs: RenderOutputs): void {
    const frames = this.instrumentation.frameCount;
    if (frames === RENDER_BENCH_WARMUP_FRAMES) {
      this.instrumentation.openWindow();
      this.heap.collectGarbage();
      this.heapAtWindowStart = this.heap.readHeapBytes();
    } else if (frames === RENDER_BENCH_WARMUP_FRAMES + this.query.windowFrames) {
      this.lastReport = this.buildReport(outputs);
      this.dependencies.onReport(this.lastReport);
    }
  }

  private buildReport(outputs: RenderOutputs): RenderBenchReport {
    const heapBytes = this.heap.readHeapBytes();
    const report = this.instrumentation.report(outputs, heapBytes);
    const grownBytes =
      heapBytes === null || this.heapAtWindowStart === null ? null : heapBytes - this.heapAtWindowStart;
    const verdict = budgetVerdict(report, this.instrumentation.evidence());
    return {
      ...report,
      seed: this.driver.world.seed,
      tick: this.driver.tick,
      zoom: outputs.zoom,
      frames: this.query.windowFrames,
      isTickAdvancing: this.query.shouldAdvanceTick,
      heapGrowthBytesPerFrame: grownBytes === null ? null : grownBytes / this.query.windowFrames,
      gpuStatus: this.instrumentation.gpuStatus,
      verdict,
      gate: benchGate(verdict, this.query.shouldAdvanceTick, this.query.expectedUnjudged),
    };
  }

  debugApi(): EvolutionDebugApi {
    return {
      ...this.loopDebugMembers(),
      mode: EVOLUTION_DEBUG_MODE.bench,
      // `step(n)` advances the scene `n` ticks and renders one frame; `step(0)` re-renders the parked tick.
      step: (ticks) => {
        this.driver.step(ticks ?? 1);
        this.gate.step(1);
      },
      setSeed: (seed) => {
        this.driver.setSeed(Math.trunc(seed));
        this.driver.goToTick(this.query.tick);
        this.rebuildRenderer();
        return true;
      },
      performanceReport: () => this.lastReport,
    };
  }

  destroy(): void {
    this.detachSheet();
    this.disposeLoop();
  }
}
