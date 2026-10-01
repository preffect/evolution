// A stand-in for the browser's Pointer Lock API (docs/ui/input-and-onboarding.md §4.1, #794), which jsdom does not
// have. It installs `requestPointerLock` on one element and `pointerLockElement` / `exitPointerLock` / `hasFocus` /
// `elementFromPoint` on its document, and lets a spec play the browser's part in the browser's order:
// - `requestPointerLock` returns a promise that stays pending until the spec answers it with `grant()` or `refuse()`;
// - a refusal rejects that promise (a microtask) and then fires `pointerlockerror` (a task), as Chrome does;
// - `exitPointerLock` only asks: the lock holds, and `pointerlockchange` fires when the spec calls `settle()`.

import { vi } from 'vitest';

export interface FakePointerLock {
  /** Every `requestPointerLock` call, with the options it passed. */
  readonly requests: ReturnType<typeof vi.fn>;
  readonly exits: ReturnType<typeof vi.fn>;
  /** The browser grants the newest request: the element is locked, its promise resolves, `pointerlockchange` fires. */
  grant(): void;
  /**
   * The browser refuses the newest request: its promise rejects with a `DOMException` named `errorName`, then
   * `pointerlockerror` fires after the microtasks, as a queued task would. Await it to see both.
   */
  refuse(errorName?: string): Promise<void>;
  /** The release `exitPointerLock` asked for happens: the lock goes and `pointerlockchange` fires. */
  settle(): void;
  /** The browser drops the lock itself: Escape (the document keeps focus) or a focus loss (it does not). */
  unlock(options: { readonly hasDocumentFocus: boolean }): void;
  /** What `elementFromPoint` answers from now on; the locked element until set. */
  setElementAtPoint(element: Element | null): void;
  restore(): void;
}

const DOCUMENT_STUBS = ['pointerLockElement', 'exitPointerLock', 'elementFromPoint'] as const;
const DEFAULT_REFUSAL = 'SecurityError';

interface PendingRequest {
  readonly promise: Promise<void>;
  readonly reject: (error: DOMException) => void;
  readonly resolve: () => void;
}

class FakePointerLockBrowser implements FakePointerLock {
  readonly requests = vi.fn((): Promise<void> => this.newRequest());
  readonly exits = vi.fn((): void => {
    this.isExitPending = this.locked !== null;
  });
  private readonly ownerDocument: Document;
  private locked: Element | null = null;
  private hasFocus = true;
  private isExitPending = false;
  private elementAtPoint: Element | null;
  private pending: PendingRequest | null = null;
  private readonly hasFocusSpy;

  constructor(private readonly element: HTMLElement) {
    this.ownerDocument = element.ownerDocument;
    this.elementAtPoint = element;
    Object.defineProperty(element, 'requestPointerLock', { configurable: true, value: this.requests });
    Object.defineProperty(this.ownerDocument, 'pointerLockElement', { configurable: true, get: () => this.locked });
    Object.defineProperty(this.ownerDocument, 'exitPointerLock', { configurable: true, value: this.exits });
    Object.defineProperty(this.ownerDocument, 'elementFromPoint', {
      configurable: true,
      value: () => this.elementAtPoint,
    });
    this.hasFocusSpy = vi.spyOn(this.ownerDocument, 'hasFocus').mockImplementation(() => this.hasFocus);
  }

  grant(): void {
    this.pending?.resolve();
    this.pending = null;
    this.setLocked(this.element);
  }

  async refuse(errorName = DEFAULT_REFUSAL): Promise<void> {
    const refused = this.pending;
    this.pending = null;
    refused?.reject(new DOMException('refused', errorName));
    // The page's own handlers on the rejection run first (they were attached first); the event is a later task.
    await refused?.promise.catch(() => undefined);
    this.ownerDocument.dispatchEvent(new Event('pointerlockerror'));
  }

  settle(): void {
    if (!this.isExitPending) return;
    this.isExitPending = false;
    this.setLocked(null);
  }

  unlock(options: { readonly hasDocumentFocus: boolean }): void {
    this.hasFocus = options.hasDocumentFocus;
    this.isExitPending = false;
    this.setLocked(null);
    this.hasFocus = true;
  }

  setElementAtPoint(element: Element | null): void {
    this.elementAtPoint = element;
  }

  restore(): void {
    Reflect.deleteProperty(this.element, 'requestPointerLock');
    for (const name of DOCUMENT_STUBS) Reflect.deleteProperty(this.ownerDocument, name);
    this.hasFocusSpy.mockRestore();
  }

  private newRequest(): Promise<void> {
    let resolve: () => void = () => undefined;
    let reject: (error: DOMException) => void = () => undefined;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    this.pending = { promise, resolve, reject };
    return promise;
  }

  private setLocked(next: Element | null): void {
    this.locked = next;
    this.ownerDocument.dispatchEvent(new Event('pointerlockchange'));
  }
}

export function installFakePointerLock(element: HTMLElement): FakePointerLock {
  return new FakePointerLockBrowser(element);
}
