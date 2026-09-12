// The dev-only bench route (docs/RENDERING.md §7): `/?bench=<seed>&tick=<n>&zoom=<z>` renders the
// fixed-seed scene through the real WorldStore on a ManualClock, parked at tick `n`, and after the
// warm-up writes the frame-budget report into `data-testid="render-bench-report"`. The debug
// hook's `step` and `setSeed` drive the bench, so a screenshot can walk the scene tick by tick.

import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, isDevMode, viewChild, type OnDestroy, type OnInit } from '@angular/core';
import { CLOCK } from '../../clock-provider';
import { installEvolutionDebug } from '../../debug/evolution-debug';
import { RENDER_BENCH_VIEWPORT_PX } from '../constants';
import { createPixiApp } from '../pixi-app';
import { BenchSession, parseBenchQuery } from './bench-session';
import { createBrowserHeapProbe, type HeapProbeWindow } from './heap-probe';

export const RENDER_BENCH_TEST_ID = 'render-bench';
export const RENDER_BENCH_REPORT_TEST_ID = 'render-bench-report';

@Component({
  selector: 'app-render-bench',
  standalone: true,
  template: `
    <div #host class="bench-host" data-testid="${RENDER_BENCH_TEST_ID}"></div>
    <pre #report class="bench-report" data-testid="${RENDER_BENCH_REPORT_TEST_ID}"></pre>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .bench-host {
        width: ${RENDER_BENCH_VIEWPORT_PX.width}px;
        height: ${RENDER_BENCH_VIEWPORT_PX.height}px;
        overflow: hidden;
      }
      .bench-report {
        position: absolute;
        left: 0;
        top: 0;
        margin: 0;
        opacity: 0;
        pointer-events: none;
      }
    `,
  ],
})
export class RenderBenchComponent implements OnInit, OnDestroy {
  private readonly clock = inject(CLOCK);
  private readonly document = inject(DOCUMENT);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly report = viewChild.required<ElementRef<HTMLElement>>('report');
  private session: BenchSession | null = null;
  private uninstallDebug: (() => void) | null = null;

  ngOnInit(): void {
    const windowLike = this.document.defaultView;
    const query = parseBenchQuery(windowLike?.location.search ?? '');
    this.session = new BenchSession(query, {
      host: this.host().nativeElement,
      clock: this.clock,
      devicePixelRatio: windowLike?.devicePixelRatio ?? 1,
      createPixiApp,
      heap: createBrowserHeapProbe((windowLike ?? {}) as HeapProbeWindow),
      onReport: (report) => {
        this.report().nativeElement.textContent = JSON.stringify(report);
      },
    });
    if (windowLike !== null)
      this.uninstallDebug = installEvolutionDebug(windowLike, this.session.debugApi(), isDevMode());
    this.session.start().catch((error: unknown) => console.error('The bench could not start.', error));
  }

  ngOnDestroy(): void {
    this.uninstallDebug?.();
    this.session?.destroy();
    this.session = null;
  }
}
