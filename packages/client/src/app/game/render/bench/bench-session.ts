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
import { NO_HEAP_PROBE, type HeapProbe } from './heap-probe';
import { budgetVerdict, type BudgetVerdict } from './render-benchmark';

export interface BenchQuery {
  readonly seed: number;
  readonly tick: number;
  readonly zoom: number;
}

const BENCH_PARAMETER = 'bench';
const TICK_PARAMETER = 'tick';
const ZOOM_PARAMETER = 'zoom';

function numberParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const value = parameters.get(key);
  const parsed = value === null ? Number.NaN : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `?bench=<seed>&tick=<n>&zoom=<z>`, each with its default; `bench` alone selects the route. */
export function parseBenchQuery(search: string): BenchQuery {
  const parameters = new URLSearchParams(search);
  return {
    seed: Math.trunc(numberParameter(parameters, BENCH_PARAMETER, RENDER_BENCH_SEED)),
    tick: Math.trunc(numberParameter(parameters, TICK_PARAMETER, RENDER_BENCH_DEFAULT_TICK)),
    zoom: numberParameter(parameters, ZOOM_PARAMETER, RENDER_BENCH_DEFAULT_ZOOM),
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
  /** Heap growth over the window after a collection, per frame; `null` without a heap probe. */
  readonly allocatedBytesPerFrame: number | null;
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
    super(dependencies.clock, RENDER_BENCH_REPORT_FRAMES);
    this.heap = dependencies.heap ?? NO_HEAP_PROBE;
    this.driver = new BenchDriver(query.seed, dependencies.counts);
    this.driver.goToTick(query.tick);
  }

  async start(): Promise<void> {
    const pixi = await this.dependencies.createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      fixedSize: RENDER_BENCH_VIEWPORT_PX,
      shouldPreserveDrawingBuffer: true,
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

  /** Every frame re-renders the parked tick. */
  protected nextFrame(): RenderFrame | null {
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
    } else if (frames === RENDER_BENCH_WARMUP_FRAMES + RENDER_BENCH_REPORT_FRAMES) {
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
      frames: RENDER_BENCH_REPORT_FRAMES,
      allocatedBytesPerFrame: grownBytes === null ? null : grownBytes / RENDER_BENCH_REPORT_FRAMES,
      verdict: budgetVerdict(report),
    };
  }

  debugApi(): EvolutionDebugApi {
    return {
      ...this.gateDebugMembers(),
      mode: EVOLUTION_DEBUG_MODE.bench,
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
