// The bench's heap probe (docs/RENDERING.md §7, `allocatedBytesPerFrame`): Chrome's
// `performance.memory` and the `--js-flags=--expose-gc` collector when the page has them, so the
// bench can collect, render its report window and read how much the window allocated. Any other
// browser reads `null` and the bench reports the allocation as unmeasured.

export interface HeapProbe {
  /** The JS heap in use, bytes; `null` where the browser does not expose it. */
  readHeapBytes(): number | null;
  /** Runs a full collection when the page exposes one; a no-op otherwise. */
  collectGarbage(): void;
}

export const NO_HEAP_PROBE: HeapProbe = { readHeapBytes: () => null, collectGarbage: () => undefined };

/** The window members the probe reads: Chrome's non-standard heap counter and the exposed collector. */
export interface HeapProbeWindow {
  readonly performance?: { readonly memory?: { readonly usedJSHeapSize: number } };
  readonly gc?: () => void;
}

export function createBrowserHeapProbe(windowLike: HeapProbeWindow): HeapProbe {
  return {
    readHeapBytes: () => windowLike.performance?.memory?.usedJSHeapSize ?? null,
    collectGarbage: () => windowLike.gc?.(),
  };
}
