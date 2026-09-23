// The dev-only preview evidence page (docs/architecture/encyclopedia.md §12.7): it opens `opens` preview sessions
// on one `ManualClock`, walks each to `?t=` and parks it, and publishes the report the way the bench route does —
// into `data-testid="encyclopedia-preview-report"` for the smoke and to the browser console for whoever opened the
// URL (#492) — so a hardware run is one URL.
//
// The stage element carries the encyclopedia's own crop — `border-radius: 50%; overflow: hidden`, never a Pixi
// mask and never a `clip-path` — so graphics-qa's element screenshots show the lens the player sees. The pixel
// checks read the canvas buffer through `toDataURL`, which a CSS clip does not touch.

import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, isDevMode, viewChild, type OnDestroy, type OnInit } from '@angular/core';
import { ManualClock } from '@evolution/shared';
import { CLOCK } from '../clock-provider';
import { DebugHookHolder } from '../debug/debug-hook-holder';
import { EncyclopediaContextService } from './encyclopedia-context';
import { RENDER_P95_MIN_SAMPLE_FRAMES } from '../render/constants';
import { createPixiApp } from '../render/pixi-app';
import { PreviewAppPool } from '../render/preview/preview-app-pool';
import { PreviewSession } from '../render/preview/preview-session';
import type { PreviewSpec } from '../render/preview/preview-spec';
import {
  PREVIEW_BUDGETS,
  PREVIEW_WALK_STEP_MS,
  previewBudgetVerdict,
  previewOpenP95Ms,
  previewWalkFrameCount,
  type PreviewOpenTimings,
} from '../render/preview/preview-timings';
import { publishPreviewFailure, publishPreviewReport } from './preview-report-log';
import {
  PREVIEW_ROUTE_FAILURE,
  parsePreviewQuery,
  previewSpecForAnchor,
  type PreviewQuery,
  type PreviewRouteFailure,
  type PreviewRouteReport,
} from './preview-route';

export const PREVIEW_ROUTE_TEST_ID = 'encyclopedia-preview';
export const PREVIEW_ROUTE_REPORT_TEST_ID = 'encyclopedia-preview-report';

/** The lens the evidence page draws at: the largest square the container's viewport always has room for. */
export const PREVIEW_ROUTE_LENS_PX = 360;

/** A page with no window to ask: a 1x display, as `pixi-app.ts` would have been given. */
const DEFAULT_DEVICE_PIXEL_RATIO = 1;

@Component({
  selector: 'app-encyclopedia-preview-route',
  standalone: true,
  template: `
    <div #stage class="preview-stage" data-testid="${PREVIEW_ROUTE_TEST_ID}"></div>
    <pre #report class="preview-report" data-testid="${PREVIEW_ROUTE_REPORT_TEST_ID}"></pre>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* The lens's crop (§12.7): a rounded overflow clip on the stage, applied while the canvas quad is drawn. */
      .preview-stage {
        width: ${PREVIEW_ROUTE_LENS_PX}px;
        height: ${PREVIEW_ROUTE_LENS_PX}px;
        border-radius: 50%;
        overflow: hidden;
      }
      .preview-report {
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
export class EncyclopediaPreviewRouteComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  /** The wall clock the open timings and the frame report are measured on; the scene's is the walk's own. */
  private readonly clock = inject(CLOCK);
  /** The one balance source the encyclopedia has: the room's while in one, the shipped one outside (§12.2). */
  private readonly encyclopedia = inject(EncyclopediaContextService);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly report = viewChild.required<ElementRef<HTMLElement>>('report');
  /** The session left on screen at the end of the run, parked on `?t=`: what a screenshot and the report read. */
  private parkedSession: PreviewSession | null = null;
  private readonly debugHook = new DebugHookHolder();
  /** Every open in the page takes the same app back, as the encyclopedia's do: the leak loop counts no lost context. */
  private readonly appPool = new PreviewAppPool(createPixiApp);

  ngOnInit(): void {
    const view = this.document.defaultView;
    this.run(
      parsePreviewQuery(view?.location.search ?? ''),
      view?.devicePixelRatio ?? DEFAULT_DEVICE_PIXEL_RATIO,
    ).catch((error: unknown) =>
      console.error('The preview evidence route could not start: no report will be produced.', error),
    );
  }

  private async run(query: PreviewQuery, devicePixelRatio: number): Promise<void> {
    const spec = previewSpecForAnchor(query.anchor);
    const sceneClock = new ManualClock(0);
    const opens: PreviewOpenTimings[] = [];
    // Every cycle but the last is opened and closed for the measurement and the context-leak loop; the last one
    // stays on screen, parked, so a screenshot and the pixel checks have a frame to read.
    for (let open = 0; open < query.opens; open += 1) {
      const isLast = open === query.opens - 1;
      const session = this.createSession(sceneClock, devicePixelRatio);
      const timings = await session.start(spec);
      if (timings !== null) opens.push(timings);
      this.walkTo(session, sceneClock, query.parkAtSeconds);
      if (isLast) this.parkedSession = session;
      else session.destroy();
    }
    const parked = this.parkedSession;
    // The one place a preview installs the hook (§12.7): the encyclopedia itself never does.
    if (parked !== null) this.debugHook.install(this.document.defaultView, parked.debugApi(), isDevMode());
    // The parked frame re-renders on the ticker with the scene clock frozen, so the window measures a steady
    // frame, exactly as the bench's parked tick does. Below `RENDER_P95_MIN_SAMPLE_FRAMES` no p95 is estimable.
    await parked?.awaitFrames(RENDER_P95_MIN_SAMPLE_FRAMES);
    this.writeReport(query, spec, opens);
  }

  private createSession(sceneClock: ManualClock, devicePixelRatio: number): PreviewSession {
    return new PreviewSession({
      host: this.stage().nativeElement,
      clock: this.clock,
      sceneClock,
      devicePixelRatio,
      sizePx: { width: PREVIEW_ROUTE_LENS_PX, height: PREVIEW_ROUTE_LENS_PX },
      createPixiApp: this.appPool.acquire,
      balance: () => this.encyclopedia.context().balance,
      // The one place the preview asks for it: `canvas.toDataURL` in the smoke needs the backbuffer kept.
      shouldPreserveDrawingBuffer: true,
    });
  }

  /**
   * Walks the clock to `parkAtSeconds` one tick at a time, each walk frame rendered with a **no-op submit** so the
   * clips, the ghost registry and the sprint-ring tracker advance without a draw, then submits the parked frame.
   */
  private walkTo(session: PreviewSession, sceneClock: ManualClock, parkAtSeconds: number): void {
    for (let frame = 0; frame < previewWalkFrameCount(parkAtSeconds); frame += 1) {
      sceneClock.advanceMilliseconds(PREVIEW_WALK_STEP_MS);
      session.walkFrame();
    }
    session.frame();
  }

  private writeReport(query: PreviewQuery, spec: PreviewSpec, opens: readonly PreviewOpenTimings[]): void {
    const [coldOpen, ...warmOpens] = opens;
    const parked = this.parkedSession;
    const frame = parked?.performanceReport() ?? null;
    // Never leave the element empty: the smoke waits on it, and a silent failure is a half-hour timeout with no
    // diagnosis on a route whose whole job is to make a hardware run one URL.
    if (coldOpen === undefined) return this.writeFailure(PREVIEW_ROUTE_FAILURE.noOpenCompleted);
    if (parked === null || frame === null) return this.writeFailure(PREVIEW_ROUTE_FAILURE.noFrameDrawn);
    const openP95Ms = previewOpenP95Ms(warmOpens);
    const frameWork = parked.frameWork();
    const report: PreviewRouteReport = {
      anchor: query.anchor,
      scene: spec.scene,
      parkAtSeconds: query.parkAtSeconds,
      walkFrames: previewWalkFrameCount(query.parkAtSeconds),
      opens: query.opens,
      coldOpen,
      warmOpens,
      openP95Ms,
      frame,
      frameWork,
      budgets: PREVIEW_BUDGETS,
      verdict: previewBudgetVerdict(openP95Ms, frameWork),
    };
    publishPreviewReport(this.report().nativeElement, report);
  }

  private writeFailure(error: string): void {
    const failure: PreviewRouteFailure = { error };
    publishPreviewFailure(this.report().nativeElement, failure);
  }

  ngOnDestroy(): void {
    this.debugHook.remove();
    this.parkedSession?.destroy();
    this.parkedSession = null;
    this.appPool.dispose();
  }
}
