// The bench route's engine (docs/RENDERING.md §7), framework-free: parses the query, drives the
// `BenchDriver` and a `GameRenderer` on the app's ticker, and after the warm-up frames hands the
// budget report to the component. Frames re-render the parked tick, so the report measures a
// steady frame and the screenshot never changes between frames.

import type { ClientPerformanceReport, Clock } from '@evolution/shared';
import { EVOLUTION_DEBUG_MODE, FrameGate, type EvolutionDebugApi } from '../../debug/evolution-debug';
import {
  RENDER_BENCH_DEFAULT_TICK,
  RENDER_BENCH_DEFAULT_ZOOM,
  RENDER_BENCH_REPORT_FRAMES,
  RENDER_BENCH_SEED,
  RENDER_BENCH_VIEWPORT_PX,
  RENDER_BENCH_WARMUP_FRAMES,
} from '../constants';
import { GameRenderer } from '../game-renderer';
import { createPixiApp, type PixiAppHandle } from '../pixi-app';
import { createRenderTextures } from '../render-textures';
import { createDomBakeCanvasFactory } from '../textures/texture-bake';
import { BenchDriver } from './bench-driver';
import { buildPerformanceReport, createDrawCallCounter, type DrawCallCounter } from './render-benchmark';

export interface BenchQuery {
  readonly seed: number;
  readonly tick: number;
  readonly zoom: number;
}

export interface BenchSessionDependencies {
  readonly host: HTMLElement;
  readonly clock: Clock;
  readonly documentReference: Document;
  readonly devicePixelRatio: number;
  readonly onReport: (report: ClientPerformanceReport) => void;
}

function numberParameter(parameters: URLSearchParams, key: string, fallback: number): number {
  const value = parameters.get(key);
  const parsed = value === null ? Number.NaN : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `?bench=<seed>&tick=<n>&zoom=<z>`, each with its default; `bench` alone selects the route. */
export function parseBenchQuery(search: string): BenchQuery {
  const parameters = new URLSearchParams(search);
  return {
    seed: Math.trunc(numberParameter(parameters, 'bench', RENDER_BENCH_SEED)),
    tick: Math.trunc(numberParameter(parameters, 'tick', RENDER_BENCH_DEFAULT_TICK)),
    zoom: numberParameter(parameters, 'zoom', RENDER_BENCH_DEFAULT_ZOOM),
  };
}

export function isBenchRoute(search: string): boolean {
  return new URLSearchParams(search).has('bench');
}

export class BenchSession {
  readonly driver: BenchDriver;
  readonly gate = new FrameGate();
  private pixi: PixiAppHandle | null = null;
  private renderer: GameRenderer | null = null;
  private drawCalls: DrawCallCounter | null = null;
  private frames = 0;
  private lastReport: ClientPerformanceReport | null = null;

  constructor(
    private readonly query: BenchQuery,
    private readonly dependencies: BenchSessionDependencies,
  ) {
    this.driver = new BenchDriver(query.seed);
    this.driver.goToTick(query.tick);
  }

  async start(): Promise<void> {
    this.pixi = await createPixiApp({
      host: this.dependencies.host,
      devicePixelRatio: this.dependencies.devicePixelRatio,
      fixedSize: RENDER_BENCH_VIEWPORT_PX,
    });
    const context = this.pixi.canvas.getContext('webgl2');
    this.drawCalls = context === null ? null : createDrawCallCounter(context);
    this.pixi.app.ticker.remove(this.pixi.app.render, this.pixi.app);
    this.pixi.app.ticker.add(() => this.frame());
    this.rebuildRenderer();
  }

  private rebuildRenderer(): void {
    if (this.pixi === null) return;
    this.renderer?.destroy();
    const snapshot = this.driver.store.latestSnapshot();
    const textures = createRenderTextures({
      seed: this.driver.world.seed,
      gelPatches: snapshot?.gelPatches ?? [],
      devicePixelRatio: this.dependencies.devicePixelRatio,
      factory: createDomBakeCanvasFactory(this.dependencies.documentReference),
    });
    this.renderer = new GameRenderer(this.pixi.app.stage, textures, this.dependencies.clock, this.pixi.app.screen);
    this.renderer.setFixedZoom(this.query.zoom);
    this.frames = 0;
  }

  private frame(): void {
    if (this.pixi === null || this.renderer === null || !this.gate.claimFrame()) return;
    const frame = this.driver.frame();
    if (frame === null) return;
    const { app } = this.pixi;
    this.drawCalls?.reset();
    const outputs = this.renderer.render(
      frame,
      this.driver.store.ownPlayerId,
      { previewTraitId: null, reticle: { isVisible: false, x: 0, y: 0 } },
      () => app.render(),
    );
    this.frames += 1;
    if (this.frames === RENDER_BENCH_WARMUP_FRAMES + RENDER_BENCH_REPORT_FRAMES) {
      this.lastReport = buildPerformanceReport(this.renderer.timer.report(), {
        drawCalls: this.drawCalls?.count() ?? 0,
        visibleCells: outputs.visibleCells,
        visibleMotes: outputs.visibleMotes,
        gpuMs: null,
        heapBytes: null,
      });
      this.dependencies.onReport(this.lastReport);
    }
  }

  debugApi(): EvolutionDebugApi {
    return {
      mode: EVOLUTION_DEBUG_MODE.bench,
      pause: () => this.gate.pause(),
      resume: () => this.gate.resume(),
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
      isPaused: () => this.gate.isPaused(),
      renderTick: () => this.driver.frame()?.renderTick ?? null,
      performanceReport: () => this.lastReport,
    };
  }

  destroy(): void {
    this.renderer?.destroy();
    this.pixi?.destroy();
    this.renderer = null;
    this.pixi = null;
  }
}
