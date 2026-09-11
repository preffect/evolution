// Test double (docs/TESTING.md §4): a `PixiAppHandle` with no WebGL behind it. The stage is a real
// `Container` so layers and views build as in the app; the ticker records its callbacks so a test
// runs frames by hand; `render` counts submits; the baker records its radial specs, hands out
// recording canvases (`fake-bake-canvas.ts`) and turns every bake into a 1×1 texture.
import { BufferImageSource, Container, Texture, type Application } from 'pixi.js';
import type { PixiAppHandle } from '../app/game/render/pixi-app';
import {
  createRenderTextures,
  type RadialBakeSpec,
  type RenderTextureOptions,
  type RenderTextures,
  type TextureBaker,
} from '../app/game/render/render-textures';
import type { BakeCanvas } from '../app/game/render/textures/texture-bake';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from './fake-bake-canvas';

export type TickerCallback = () => void;

export interface FakePixiApp extends PixiAppHandle {
  readonly stage: Container;
  readonly tickerCallbacks: TickerCallback[];
  readonly screen: { width: number; height: number };
  readonly renderCalls: { count: number };
  readonly bakedSpecs: RadialBakeSpec[];
  /** Every Canvas-2D bake the app asked for, in order. */
  readonly bakedCanvases: FakeBakeCanvas[];
  readonly lifecycle: { isDestroyed: boolean };
  /** Runs every ticker callback once: one frame. */
  tick(): void;
}

const DEFAULT_SCREEN = { width: 1280, height: 720 };
const DEFAULT_TEXTURE_SEED = 1;
const ONE_PIXEL = 1;
const RGBA_BYTES = 4;

/** A 1×1 RGBA texture a test can destroy freely (unlike the shared `Texture.WHITE`). */
export function createOnePixelTexture(): Texture {
  return new Texture({
    source: new BufferImageSource({ resource: new Uint8Array(RGBA_BYTES), width: ONE_PIXEL, height: ONE_PIXEL }),
  });
}

export interface FakeTextureBaker extends TextureBaker {
  readonly bakedSpecs: RadialBakeSpec[];
  readonly bakedCanvases: FakeBakeCanvas[];
  /** The bakes turned into textures, in order. */
  readonly texturedBakes: BakeCanvas[];
}

/** A `TextureBaker` that records every radial spec and canvas bake and returns fresh 1×1 textures. */
export function createFakeTextureBaker(): FakeTextureBaker {
  const bakedSpecs: RadialBakeSpec[] = [];
  const canvases = createFakeBakeCanvasFactory();
  const texturedBakes: BakeCanvas[] = [];
  return {
    bakedSpecs,
    bakedCanvases: canvases.canvases,
    texturedBakes,
    bakeRadial(spec) {
      bakedSpecs.push(spec);
      return createOnePixelTexture();
    },
    create: (width, height) => canvases.create(width, height),
    textureFromBake(bake) {
      texturedBakes.push(bake);
      return createOnePixelTexture();
    },
  };
}

/** The texture bundle over a fake baker: no gel patches and a 1× display unless the test says otherwise. */
export function createTestRenderTextures(overrides: Partial<RenderTextureOptions> = {}): RenderTextures {
  return createRenderTextures({
    seed: DEFAULT_TEXTURE_SEED,
    baker: createFakeTextureBaker(),
    gelPatches: [],
    devicePixelRatio: 1,
    ...overrides,
  });
}

interface FakeStageParts {
  readonly stage: Container;
  readonly tickerCallbacks: TickerCallback[];
  readonly renderCalls: { count: number };
  readonly screen: { width: number; height: number };
}

/** The slice of `Application` the session uses: the stage, the screen box, a hand-run ticker, a counted render. */
function createStageHandle(parts: FakeStageParts): Application {
  const { tickerCallbacks, renderCalls } = parts;
  const app = {
    stage: parts.stage,
    screen: parts.screen,
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
  return app as unknown as Application;
}

export function createFakePixiApp(screen = DEFAULT_SCREEN): FakePixiApp {
  const stage = new Container();
  const tickerCallbacks: TickerCallback[] = [];
  const renderCalls = { count: 0 };
  const baker = createFakeTextureBaker();
  const lifecycle = { isDestroyed: false };
  const screenBox = { ...screen };
  const app = createStageHandle({ stage, tickerCallbacks, renderCalls, screen: screenBox });
  const canvas = document.createElement('canvas');
  return {
    app,
    canvas,
    textures: baker,
    stage,
    tickerCallbacks,
    screen: screenBox,
    renderCalls,
    bakedSpecs: baker.bakedSpecs,
    bakedCanvases: baker.bakedCanvases,
    lifecycle,
    tick: () => {
      for (const callback of [...tickerCallbacks]) callback();
    },
    destroy: () => {
      lifecycle.isDestroyed = true;
    },
  };
}
