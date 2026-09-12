// The bench route's engine (docs/RENDERING.md §7), framework-free: parses the query, drives the
// `BenchDriver` and a `GameRenderer` on the app's ticker, and once the report window has run
// hands the frame-budget report to the component. Frames re-render the parked tick, so the report
// measures a steady frame and a screenshot never changes between frames; the debug hook's `step`
// advances the tick and `setSeed` rebuilds the scene.

import type { ClientPerformanceReport, Clock } from '@evolution/shared';
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
import { FrameLoopSession } from '../frame-loop-session';
import { NO_RETICLE, type GameRenderer, type RenderInputs, type RenderOutputs } from '../game-renderer';
import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';
import { BenchDriver } from './bench-driver';
import type { BenchCounts } from './bench-scene';
import type { GpuTimerStatus } from './gpu-timer';
import { NO_HEAP_PROBE, type HeapProbe } from './heap-probe';
import { budgetVerdict, type BudgetVerdict } from './render-benchmark';

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
   * does not set it and it costs a full-framebuffer copy a frame on a real GPU (docs/RENDERING.md §7).
   */
  readonly shouldPreserveDrawingBuffer: boolean;
}

const BENCH_PARAMETER = 'bench';
const TICK_PARAMETER = 'tick';
const ZOOM_PARAMETER = 'zoom';
const WINDOW_PARAMETER = 'window';
const ADVANCE_PARAMETER = 'advance';
const PRESERVE_PARAMETER = 'preserve';
const FLAG_ON = '1';

function numberParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const value = parameters.get(key);
  const parsed = value === null ? Number.NaN : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const parsed = numberParameter(parameters, key, fallback);
  return parsed > 0 ? parsed : fallback;
}

/**
 * `?bench=<seed>&tick=<n>&zoom=<z>&window=<frames>&advance=1&preserve=1`, each with its default; `bench`
 * alone selects the route.
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
  };
}

export function isBenchRoute(search: string): boolean {
  return new URLSearchParams(search).has(BENCH_PARAMETER);
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
   * as one figure (docs/RENDERING.md §7). `null` without a heap probe.
   */
  readonly heapGrowthBytesPerFrame: number | null;
  /** Why `gpuMs` is a number or `null` (docs/RENDERING.md §7). */
  readonly gpuStatus: GpuTimerStatus;
  readonly verdict: BudgetVerdict;
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
}

const BENCH_INPUTS: RenderInputs = { previewTraitId: null, reticle: NO_RETICLE };

export class BenchSession extends FrameLoopSession {
  readonly driver: BenchDriver;
  private readonly heap: HeapProbe;
  private heapAtWindowStart: number | null = null;
  private lastReport: RenderBenchReport | null = null;

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
    this.buildRenderer({
      seed: this.driver.world.seed,
      gelPatches: this.driver.store.latestSnapshot()?.gelPatches ?? [],
      devicePixelRatio: this.dependencies.devicePixelRatio,
      noiseTileSizePx: this.dependencies.noiseTileSizePx,
    })?.setFixedZoom(this.query.zoom);
  }

  /** Every frame re-renders the parked tick, unless `advance=1` steps the scene a tick first. */
  protected nextFrame(): RenderFrame | null {
    if (this.query.shouldAdvanceTick) this.driver.step(1);
    return this.driver.frame();
  }

  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    return renderer.render(frame, this.driver.store.ownPlayerId, BENCH_INPUTS, submit);
  }

  /** Collects at the end of the warm-up and reports once the window has run. */
  protected afterFrame(outputs: RenderOutputs): void {
    const frames = this.instrumentation.frameCount;
    if (frames === RENDER_BENCH_WARMUP_FRAMES) {
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
    return {
      ...report,
      seed: this.driver.world.seed,
      tick: this.driver.tick,
      zoom: outputs.zoom,
      frames: this.query.windowFrames,
      isTickAdvancing: this.query.shouldAdvanceTick,
      heapGrowthBytesPerFrame: grownBytes === null ? null : grownBytes / this.query.windowFrames,
      gpuStatus: this.instrumentation.gpuStatus,
      verdict: budgetVerdict(report, this.instrumentation.evidence()),
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
    this.disposeLoop();
  }
}
