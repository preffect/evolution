// A recording stand-in for the page's observers (`IntersectionObserver`, `ResizeObserver`), for component specs:
// jsdom has neither. Installed on `window` for one spec and put back after it; each observer made is recorded with
// its callback, what it observes and whether it was disconnected, so the spec can fire it by hand.

export interface RecordedObserver<Callback> {
  readonly callback: Callback;
  readonly observed: Element[];
  isDisconnected: boolean;
}

type ObserverName = 'IntersectionObserver' | 'ResizeObserver';

/** Runs `body` with `window[name]` recording every observer made; the real one is put back after it, whatever happens. */
export function withRecordingObserver<Callback>(
  name: ObserverName,
  body: (observers: readonly RecordedObserver<Callback>[]) => void,
): void {
  const observers: RecordedObserver<Callback>[] = [];
  class RecordingObserver {
    private readonly record: RecordedObserver<Callback>;
    constructor(callback: Callback) {
      this.record = { callback, observed: [], isDisconnected: false };
      observers.push(this.record);
    }
    observe(target: Element): void {
      this.record.observed.push(target);
    }
    disconnect(): void {
      this.record.isDisconnected = true;
    }
  }
  const previous = window[name];
  window[name] = RecordingObserver as unknown as (typeof window)[ObserverName] as never;
  try {
    body(observers);
  } finally {
    window[name] = previous as never;
  }
}
