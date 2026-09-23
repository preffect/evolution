// The preview's Pixi app, kept across opens (docs/architecture/encyclopedia.md §12.7, ticket #503). Destroying a
// Pixi app calls `WEBGL_lose_context.loseContext()`, which the browser logs as a lost context, and a fresh app per
// open also recompiles every program on its new context. So a closing `PreviewSession` hands its app back here
// instead: the canvas leaves the DOM and the ticker stops, and the next open with the same device pixel ratio and
// drawing-buffer mode takes the same app, context and canvas back. Only the renderer and its bundle are per open.
//
// It is `createPixiApp`-shaped (`acquire`), so a session never knows whether its app is new or kept.

import type { PixiAppHandle, PixiAppOptions } from '../pixi-app';

type CreatePixiApp = (options: PixiAppOptions) => Promise<PixiAppHandle>;

const SIZING = { fixed: 'fixed', host: 'host' } as const;

/**
 * The app's creation-time inputs — the pixel ratio, the drawing-buffer mode and the sizing mode (a `fixedSize` app
 * or one sized by `resizeTo` its host): an app is only reused for an open that would have created the same one.
 */
function poolKey(options: PixiAppOptions): string {
  const sizing = options.fixedSize === undefined ? SIZING.host : SIZING.fixed;
  return `${options.devicePixelRatio}|${options.shouldPreserveDrawingBuffer}|${sizing}`;
}

interface IdleApp {
  readonly handle: PixiAppHandle;
  readonly key: string;
}

export class PreviewAppPool {
  /** At most one app waits here: the preview shows one lens at a time. */
  private idle: IdleApp | null = null;
  private isDisposed = false;

  constructor(private readonly createPixiApp: CreatePixiApp) {}

  /** A kept app when one matches `options`, re-hosted, resized and ticking; a new one otherwise. */
  readonly acquire = async (options: PixiAppOptions): Promise<PixiAppHandle> => {
    const key = poolKey(options);
    const kept = this.takeIdle(key);
    if (kept === null) return this.lease(await this.createPixiApp(options), key);
    options.host.appendChild(kept.canvas);
    if (options.fixedSize !== undefined) kept.resize(options.fixedSize);
    kept.app.ticker.start();
    return this.lease(kept, key);
  };

  /** Destroys the waiting app, and every app handed back from here on: the pool's owner is going. */
  dispose(): void {
    this.isDisposed = true;
    this.idle?.handle.destroy();
    this.idle = null;
  }

  private takeIdle(key: string): PixiAppHandle | null {
    const idle = this.idle;
    this.idle = null;
    if (idle === null) return null;
    if (idle.key === key) return idle.handle;
    // A display change (another monitor's ratio) since the last open: the kept app would draw at the wrong one.
    idle.handle.destroy();
    return null;
  }

  /** The same handle, whose `destroy` hands the app back (once) rather than losing its context. */
  private lease(handle: PixiAppHandle, key: string): PixiAppHandle {
    let isReleased = false;
    return {
      app: handle.app,
      canvas: handle.canvas,
      textures: handle.textures,
      resize: (sizePx) => handle.resize(sizePx),
      unbindTextures: () => handle.unbindTextures(),
      destroy: () => {
        if (isReleased) return;
        isReleased = true;
        this.release(handle, key);
      },
    };
  }

  private release(handle: PixiAppHandle, key: string): void {
    const { app, canvas } = handle;
    app.ticker.stop();
    // The renderer destroys its own layers; anything a session left on the stage goes now, not into the next open.
    for (const child of app.stage.removeChildren()) child.destroy({ children: true });
    canvas.remove();
    if (this.isDisposed || this.idle !== null) {
      handle.destroy();
      return;
    }
    this.idle = { handle, key };
  }
}
