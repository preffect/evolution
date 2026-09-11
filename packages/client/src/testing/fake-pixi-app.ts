// Test double (docs/TESTING.md §4): a `PixiAppHandle` with no WebGL behind it. The stage is a real
// `Container` so layers and views build as in the app; the ticker records its callbacks so a test
// runs frames by hand; `render` counts submits; the baker records its specs and hands back 1×1 textures.
import { BufferImageSource, Container, Texture, type Application } from 'pixi.js';
import type { PixiAppHandle } from '../app/game/render/pixi-app';
import type { RadialBakeSpec, TextureBaker } from '../app/game/render/render-textures';

export type TickerCallback = () => void;

export interface FakePixiApp extends PixiAppHandle {
  readonly stage: Container;
  readonly tickerCallbacks: TickerCallback[];
  readonly screen: { width: number; height: number };
  readonly renderCalls: { count: number };
  readonly bakedSpecs: RadialBakeSpec[];
  readonly lifecycle: { isDestroyed: boolean };
  /** Runs every ticker callback once: one frame. */
  tick(): void;
}

const DEFAULT_SCREEN = { width: 1280, height: 720 };
const ONE_PIXEL = 1;
const RGBA_BYTES = 4;

/** A 1×1 RGBA texture a test can destroy freely (unlike the shared `Texture.WHITE`). */
export function createOnePixelTexture(): Texture {
  return new Texture({
    source: new BufferImageSource({ resource: new Uint8Array(RGBA_BYTES), width: ONE_PIXEL, height: ONE_PIXEL }),
  });
}

/** A `TextureBaker` that records every spec and returns a fresh 1×1 texture. */
export function createFakeTextureBaker(): TextureBaker & { readonly bakedSpecs: RadialBakeSpec[] } {
  const bakedSpecs: RadialBakeSpec[] = [];
  return {
    bakedSpecs,
    bakeRadial(spec) {
      bakedSpecs.push(spec);
      return createOnePixelTexture();
    },
  };
}

export function createFakePixiApp(screen = DEFAULT_SCREEN): FakePixiApp {
  const stage = new Container();
  const tickerCallbacks: TickerCallback[] = [];
  const renderCalls = { count: 0 };
  const baker = createFakeTextureBaker();
  const lifecycle = { isDestroyed: false };
  const screenBox = { ...screen };
  const app = {
    stage,
    screen: screenBox,
    ticker: {
      add: (callback: TickerCallback) => tickerCallbacks.push(callback),
      remove: (callback: TickerCallback) => {
        const index = tickerCallbacks.indexOf(callback);
        if (index >= 0) tickerCallbacks.splice(index, 1);
      },
    },
    render: () => {
      renderCalls.count += 1;
    },
  };
  const canvas = document.createElement('canvas');
  return {
    app: app as unknown as Application,
    canvas,
    textures: baker,
    stage,
    tickerCallbacks,
    screen: screenBox,
    renderCalls,
    bakedSpecs: baker.bakedSpecs,
    lifecycle,
    tick: () => {
      for (const callback of [...tickerCallbacks]) callback();
    },
    destroy: () => {
      lifecycle.isDestroyed = true;
    },
  };
}
