// The recording `ENCYCLOPEDIA_PREVIEW` a component spec provides (docs/architecture/encyclopedia.md §12.7).
//
// **No spec of the Angular side builds a `PreviewSession`.** It would need Pixi, and any `BitmapText` crashes jsdom;
// the seam exists so a spec can watch what the encyclopedia *asks* of a preview instead. The real session's own
// behaviour — one bake per session, the late-app destroy, the clock re-base — is `preview-session.spec.ts`'s, over
// the fake Pixi app.
//
// The open is deliberately **not** resolved for you: `completeOpen` and `failOpen` are how a spec holds a lens in
// `loading` for as long as it needs to, and how it reaches `unavailable` at all.

import { ENCYCLOPEDIA_PREVIEW } from '../app/game/render/preview/preview-host';
import type { PreviewHandle, PreviewHostFactory, PreviewHostOptions } from '../app/game/render/preview/preview-host';
import type { PreviewSizePx } from '../app/game/render/preview/preview-canvas';
import type { PreviewSpec } from '../app/game/render/preview/preview-spec';
import type { PreviewOpenTimings } from '../app/game/render/preview/preview-timings';

/**
 * A resolved promise only *queues* the code awaiting it, so `completeOpen` and `failOpen` hand back a promise that
 * has been through enough microtask ticks for the service's own `await` to have run by the time a spec sees it.
 */
const MICROTASK_FLUSHES = 3;

async function flushMicrotasks(): Promise<void> {
  for (let flush = 0; flush < MICROTASK_FLUSHES; flush += 1) await Promise.resolve();
}

/** Numbers a spec never judges: a caller that wants a miss against the budget passes its own. */
export const FAKE_PREVIEW_OPEN_TIMINGS: PreviewOpenTimings = {
  initMs: 1,
  bakeMs: 2,
  firstSubmitMs: 3,
  openedToFirstFrameMs: 6,
};

export class RecordingPreviewHandle implements PreviewHandle {
  /** Every spec the handle was given, the one `start` opened on first: `start` shows its spec too. */
  readonly shownSpecs: PreviewSpec[] = [];
  readonly resizes: PreviewSizePx[] = [];
  pauseCount = 0;
  resumeCount = 0;
  destroyCount = 0;

  private settleOpen: ((timings: PreviewOpenTimings | null) => void) | null = null;
  private failOpenWith: ((error: Error) => void) | null = null;

  start(spec: PreviewSpec): Promise<PreviewOpenTimings | null> {
    this.shownSpecs.push(spec);
    return new Promise((resolve, reject) => {
      this.settleOpen = resolve;
      this.failOpenWith = reject;
    });
  }

  show(spec: PreviewSpec): void {
    this.shownSpecs.push(spec);
  }

  pause(): void {
    this.pauseCount += 1;
  }

  resume(): void {
    this.resumeCount += 1;
  }

  resize(sizePx: PreviewSizePx): void {
    this.resizes.push(sizePx);
  }

  destroy(): void {
    this.destroyCount += 1;
  }

  /** The first frame is on the canvas. `null` is the real session's "destroy ran first". */
  completeOpen(timings: PreviewOpenTimings | null = FAKE_PREVIEW_OPEN_TIMINGS): Promise<void> {
    this.settleOpen?.(timings);
    return flushMicrotasks();
  }

  /** The preview app could not start: no WebGL2 context, or Pixi threw during init. */
  failOpen(error = new Error('no WebGL2 context')): Promise<void> {
    this.failOpenWith?.(error);
    return flushMicrotasks();
  }
}

export interface RecordingPreviewHost {
  readonly factory: PreviewHostFactory;
  /** One per `ENCYCLOPEDIA_PREVIEW` call, in order; a second one means a second session was opened. */
  readonly handles: RecordingPreviewHandle[];
  readonly options: PreviewHostOptions[];
}

export function recordingPreviewHost(): RecordingPreviewHost {
  const handles: RecordingPreviewHandle[] = [];
  const options: PreviewHostOptions[] = [];
  return {
    handles,
    options,
    factory: (given) => {
      options.push(given);
      const handle = new RecordingPreviewHandle();
      handles.push(handle);
      return handle;
    },
  };
}

/**
 * The provider for a spec that only needs the panel to **open** — the HUD's, the panel's own, the keyboard's. It
 * keeps its handles to itself: a spec that wants to watch what the encyclopedia asks of a preview builds the host
 * itself and holds on to it (`encyclopedia-preview.service.spec.ts`).
 */
export function recordingPreviewProvider(): { provide: typeof ENCYCLOPEDIA_PREVIEW; useValue: PreviewHostFactory } {
  return { provide: ENCYCLOPEDIA_PREVIEW, useValue: recordingPreviewHost().factory };
}
