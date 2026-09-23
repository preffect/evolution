// The seam the encyclopedia's Angular side sees (docs/architecture/encyclopedia.md §12.7): a `PreviewHandle`,
// asked for through the `ENCYCLOPEDIA_PREVIEW` token the way `clock-provider.ts` hands out the clock.
//
// It exists because `BitmapText` crashes jsdom: a component spec provides a recording fake and never builds a
// `PreviewSession`, so no component spec ever touches Pixi. The handle exposes no zoom (so #354 draws no scale
// bar) and no `playLoop` — `show` is also the replay, because it restarts the scene's loop.

import { InjectionToken, inject } from '@angular/core';
import type { BalanceConfig, Clock } from '@evolution/shared';
import { CLOCK } from '../../clock-provider';
import { createPixiApp, type PixiAppHandle, type PixiAppOptions } from '../pixi-app';
import { PreviewAppPool } from './preview-app-pool';
import type { PreviewSizePx } from './preview-canvas';
import { PreviewSession } from './preview-session';
import type { PreviewOpenTimings } from './preview-timings';
import type { PreviewSpec } from './preview-spec';

export interface PreviewHandle {
  /**
   * Opens on `spec`, resolving with the open's cost once its first frame is drawn, or `null` when `destroy` ran
   * first. Later calls to `show` swap the scene with no bake.
   */
  start(spec: PreviewSpec): Promise<PreviewOpenTimings | null>;
  /** Swaps the scene and restarts its loop; also the replay. */
  show(spec: PreviewSpec): void;
  pause(): void;
  resume(): void;
  /** A `--ui-scale` change: the canvas resizes, nothing is rebaked. */
  resize(sizePx: PreviewSizePx): void;
  destroy(): void;
}

export interface PreviewHostOptions {
  /** The stage element the canvas goes into: `border-radius: 50%; overflow: hidden` is the lens's crop (§12.7). */
  readonly host: HTMLElement;
  /** The lens's bounding square in CSS px. */
  readonly sizePx: PreviewSizePx;
  /** Read every frame: the room's live balance, or `DEFAULT_BALANCE` outside a room. */
  readonly balance: () => BalanceConfig;
  /** `true` on the evidence route only. */
  readonly shouldPreserveDrawingBuffer?: boolean;
}

export type PreviewHostFactory = (options: PreviewHostOptions) => PreviewHandle;

export interface PreviewHandleDependencies {
  readonly clock: Clock;
  /** The display's raw ratio; the session caps it at `PREVIEW_MAX_DEVICE_PIXEL_RATIO`. */
  readonly devicePixelRatio: number;
  /** Where the session's Pixi app comes from: the page's `PreviewAppPool`, so opens share one context (#503). */
  readonly createPixiApp: (options: PixiAppOptions) => Promise<PixiAppHandle>;
}

/** The real seam: one `PreviewSession` on the pooled app and the injected clock. */
export function createPreviewHandle(
  options: PreviewHostOptions,
  dependencies: PreviewHandleDependencies,
): PreviewHandle {
  const session = new PreviewSession({
    host: options.host,
    clock: dependencies.clock,
    devicePixelRatio: dependencies.devicePixelRatio,
    sizePx: options.sizePx,
    createPixiApp: dependencies.createPixiApp,
    balance: options.balance,
    shouldPreserveDrawingBuffer: options.shouldPreserveDrawingBuffer ?? false,
  });
  return {
    start: (spec) => session.start(spec),
    show: (spec) => session.show(spec),
    pause: () => session.pause(),
    resume: () => session.resume(),
    resize: (sizePx) => session.resize(sizePx),
    destroy: () => session.destroy(),
  };
}

const DEFAULT_DEVICE_PIXEL_RATIO = 1;

export const ENCYCLOPEDIA_PREVIEW = new InjectionToken<PreviewHostFactory>('EncyclopediaPreview', {
  providedIn: 'root',
  factory: () => {
    const clock = inject(CLOCK);
    // One pool for the page: the encyclopedia's every open reuses the one preview context. It lives as long as the
    // page, so a closed encyclopedia holds that context and its canvas buffers, never the bundle.
    const pool = new PreviewAppPool(createPixiApp);
    return (options) =>
      createPreviewHandle(options, {
        clock,
        createPixiApp: pool.acquire,
        devicePixelRatio: options.host.ownerDocument.defaultView?.devicePixelRatio ?? DEFAULT_DEVICE_PIXEL_RATIO,
      });
  },
});
