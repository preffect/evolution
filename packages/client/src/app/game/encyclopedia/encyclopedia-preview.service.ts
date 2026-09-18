// The one `PreviewHandle` an open encyclopedia has (docs/ui/encyclopedia.md §11.4, architecture/encyclopedia.md
// §12.7). The panel provides it, so it opens with the panel and is destroyed with it; every lens that mounts while
// it is open borrows the same session, and the bundle is baked once per encyclopedia open rather than once per page
// the reader turns to (§12.7's cost table).
//
// **Why the canvas lives in an element of this service's own.** `createPixiApp` appends the canvas to the host it
// is given and a session cannot be re-hosted, so if the host were the lens's own stage the handle would die with
// the first landing the reader visits and the next entry would pay the whole bake again. Instead the host is made
// here, each lens takes it into its stage on init and gives it back on destroy, and the session never notices.
//
// It never builds a `PreviewSession` itself: it asks `ENCYCLOPEDIA_PREVIEW` for a handle, which is what lets a
// component spec provide a recording fake and never touch Pixi (`BitmapText` crashes jsdom, §12.7).

import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';
import type { CancelDeferredCall, ValueOf } from '@evolution/shared';
import { SCHEDULER } from '../clock-provider';
import { ENCYCLOPEDIA_PREVIEW, type PreviewHandle } from '../render/preview/preview-host';
import type { PreviewSpec } from '../render/preview/preview-spec';
import { EncyclopediaContextService } from './encyclopedia-context';
import { ENCYCLOPEDIA_LENS_DIAMETER_PX, ENCYCLOPEDIA_PREVIEW_SETTLE_MS } from './encyclopedia-constants';

/** What the lens draws, on `encyclopedia-preview[data-preview-state]` (docs/ui/encyclopedia.md §11.4). */
export const ENCYCLOPEDIA_PREVIEW_STATE = {
  /** Until the first frame: the dish field with one pulsing ring, no text. */
  loading: 'loading',
  live: 'live',
  /** The last frame held: a pane without a preview, or a landing. */
  paused: 'paused',
  /** The preview app could not start. There is no retry loop. */
  unavailable: 'unavailable',
} as const;
export type EncyclopediaPreviewState = ValueOf<typeof ENCYCLOPEDIA_PREVIEW_STATE>;

/**
 * The canvas's wrapper is styled from here rather than from a stylesheet because it is created outside any
 * template and so carries no component's style scope. One property, and it is layout rather than look: a canvas is
 * an inline box by default, which would sit the scene on a text baseline a few px down inside the circle.
 */
const HOST_DISPLAY = 'flex';

@Injectable()
export class EncyclopediaPreviewService {
  private readonly createPreview = inject(ENCYCLOPEDIA_PREVIEW);
  private readonly context = inject(EncyclopediaContextService);
  /** The settle's wait. Injected, because a delay in game code never comes from a timer global (§1). */
  private readonly scheduler = inject(SCHEDULER);

  /** The element the canvas is appended to, lent to whichever lens is mounted. */
  readonly hostElement: HTMLElement = inject(DOCUMENT).createElement('div');

  private readonly stateSignal = signal<EncyclopediaPreviewState>(ENCYCLOPEDIA_PREVIEW_STATE.loading);
  readonly state: Signal<EncyclopediaPreviewState> = this.stateSignal.asReadonly();

  private handle: PreviewHandle | null = null;
  private isOpening = false;
  /** The ticker's own state, which the lens's is derived from: it can be stopped before there is a state to show. */
  private isTickerPaused = false;
  /** Set once a lens has the host in its stage: nothing opens into a stage that is not on the page. */
  private isStageAttached = false;
  /** What the reader is on now, and what the handle was last told; they differ while a selection settles. */
  private currentSpec: PreviewSpec | null = null;
  private shownSpec: PreviewSpec | null = null;
  private cancelSettle: CancelDeferredCall | null = null;
  private uiScale = 1;

  constructor() {
    this.hostElement.style.display = HOST_DISPLAY;
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  /** A lens took the host into its stage. */
  attachStage(): void {
    this.isStageAttached = true;
    this.applyCurrentSpec();
  }

  /** The lens is going: the session stays, its ticker does not (§11.4 pauses on a pane without a preview). */
  detachStage(): void {
    this.isStageAttached = false;
    this.pause();
  }

  /**
   * The entry page's current preview. It reaches the handle once the selection has rested
   * `ENCYCLOPEDIA_PREVIEW_SETTLE_MS`, so holding an arrow down the list does not restart a scene per row.
   */
  show(spec: PreviewSpec): void {
    // The same spec again is the page re-rendering, not the reader moving: a `ResolvedEntry` is rebuilt whenever the
    // round's progress changes, and restarting the settle timer on each of those would leave the lens never settling.
    // A replay (§11.4's action scenes) is the one caller that means "again" and will need its own path.
    if (spec === this.currentSpec) return;
    this.currentSpec = spec;
    this.clearSettleTimer();
    this.cancelSettle = this.scheduler.after(ENCYCLOPEDIA_PREVIEW_SETTLE_MS, () => {
      this.cancelSettle = null;
      this.applyCurrentSpec();
    });
  }

  /** The `--ui-scale` the panel is drawn at: the canvas follows it, and nothing is rebaked (§12.7). */
  setUiScale(scale: number): void {
    if (scale === this.uiScale) return;
    this.uiScale = scale;
    this.handle?.resize(this.canvasSizePx());
  }

  /**
   * The ticker stops, and the state follows it once there is a frame to hold. A pause during the open is a panel
   * the reader has already left: the session honours it (`start` still draws the one frame the timings are measured
   * on), and the open resolves into `paused` rather than into a `live` lens nobody is looking at.
   */
  pause(): void {
    if (this.handle === null) return;
    this.handle.pause();
    this.isTickerPaused = true;
    if (this.stateSignal() === ENCYCLOPEDIA_PREVIEW_STATE.live) {
      this.stateSignal.set(ENCYCLOPEDIA_PREVIEW_STATE.paused);
    }
  }

  private resume(): void {
    if (this.handle === null || !this.isTickerPaused) return;
    this.handle.resume();
    this.isTickerPaused = false;
    if (this.stateSignal() === ENCYCLOPEDIA_PREVIEW_STATE.paused) {
      this.stateSignal.set(ENCYCLOPEDIA_PREVIEW_STATE.live);
    }
  }

  /**
   * Opens on the first spec and swaps the scene on every one after it. While the open is in flight nothing is
   * shown: `open` re-applies whatever the reader has landed on once it resolves, so a page turned during the bake
   * is not lost and `show` is never called on a session that has no renderer yet.
   *
   * An `unavailable` preview stops here. §11.4 gives it no retry loop, and without this line a failed open would be
   * retried by the very re-apply that follows it — once per entry the reader opens, for as long as the panel is up.
   */
  private applyCurrentSpec(): void {
    const spec = this.currentSpec;
    if (spec === null || !this.isStageAttached || this.isOpening) return;
    if (this.stateSignal() === ENCYCLOPEDIA_PREVIEW_STATE.unavailable) return;
    if (this.handle === null) {
      void this.open(spec);
      return;
    }
    if (spec !== this.shownSpec) {
      this.shownSpec = spec;
      this.handle.show(spec);
    }
    this.resume();
  }

  private async open(spec: PreviewSpec): Promise<void> {
    this.isOpening = true;
    try {
      const handle = this.createPreview({
        host: this.hostElement,
        sizePx: this.canvasSizePx(),
        balance: () => this.context.context().balance,
      });
      this.handle = handle;
      this.shownSpec = spec;
      // `null` is a `destroy` that landed first, which is a panel that has closed rather than a preview that failed.
      const timings = await handle.start(spec);
      if (timings !== null) {
        // The session reads its canvas size once, as `start` is called, so a `--ui-scale` change that landed while
        // the bundle baked would otherwise leave a canvas of the previous size inside a lens of the new one.
        handle.resize(this.canvasSizePx());
        this.stateSignal.set(this.isTickerPaused ? ENCYCLOPEDIA_PREVIEW_STATE.paused : ENCYCLOPEDIA_PREVIEW_STATE.live);
      }
    } catch {
      this.handle?.destroy();
      this.handle = null;
      this.shownSpec = null;
      this.stateSignal.set(ENCYCLOPEDIA_PREVIEW_STATE.unavailable);
    } finally {
      this.isOpening = false;
    }
    this.applyCurrentSpec();
  }

  /** The lens's bounding square in CSS px: the diameter as the panel is currently scaled (§12.7). */
  private canvasSizePx(): { readonly width: number; readonly height: number } {
    const side = ENCYCLOPEDIA_LENS_DIAMETER_PX * this.uiScale;
    return { width: side, height: side };
  }

  private clearSettleTimer(): void {
    this.cancelSettle?.();
    this.cancelSettle = null;
  }

  private destroy(): void {
    this.clearSettleTimer();
    this.handle?.destroy();
    this.handle = null;
    this.currentSpec = null;
    this.shownSpec = null;
  }
}
