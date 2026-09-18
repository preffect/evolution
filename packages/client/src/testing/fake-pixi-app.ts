// Test double (docs/testing/tiers-and-builders.md §4): a `PixiAppHandle` with no WebGL behind it. The stage is a real
// `Container` so layers and views build as in the app; the ticker records its callbacks so a test
// runs frames by hand; `render` counts submits; the baker records its radial specs, hands out
// recording canvases (`fake-bake-canvas.ts`) and turns every bake into a 1×1 texture.
import { BufferImageSource, Container, Texture, type Application } from 'pixi.js';
import type { PixiAppHandle } from '../app/game/render/pixi-app';
import {
  createRenderTextures,
  type RenderTextureOptions,
  type RenderTextures,
  type TextureBaker,
} from '../app/game/render/render-textures';
import type { BitmapFontInstall } from '../app/game/render/textures/bitmap-fonts';
import type { SpriteAtlas } from '../app/game/render/textures/pixi-textures';
import type { BakeCanvas } from '../app/game/render/textures/texture-bake';
import type { RadialBakeSpec } from '../app/game/render/textures/radial-bake';
import { createFakeBakeCanvasFactory, type FakeBakeCanvas } from './fake-bake-canvas';

export type TickerCallback = () => void;

export interface FakePixiApp extends PixiAppHandle {
  /** The recording baker behind `textures`: a spec reads its bakes, font installs and uninstalls. */
  readonly textures: FakeTextureBaker;
  readonly stage: Container;
  readonly tickerCallbacks: TickerCallback[];
  /** `false` between `ticker.stop()` and the next `ticker.start()`; `tick()` draws nothing while it is. */
  readonly ticking: { isRunning: boolean };
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
/**
 * The cytoplasm tile a test bundle bakes: the production 256² tile is the bundle's one CPU-heavy
 * step (#226) and no unit test samples its bytes, so a session or a layer under test asks for this.
 */
export const TEST_NOISE_TILE_SIZE_PX = 8;
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
  /** The BitmapFont installs, in order, and the names uninstalled. */
  readonly installedFonts: BitmapFontInstall[];
  readonly uninstalledFonts: string[];
}

/** A `TextureBaker` that records every radial spec and canvas bake and returns fresh 1×1 textures. */
export function createFakeTextureBaker(): FakeTextureBaker {
  const bakedSpecs: RadialBakeSpec[] = [];
  const canvases = createFakeBakeCanvasFactory();
  const texturedBakes: BakeCanvas[] = [];
  const installedFonts: BitmapFontInstall[] = [];
  const uninstalledFonts: string[] = [];
  return {
    bakedSpecs,
    bakedCanvases: canvases.canvases,
    texturedBakes,
    installedFonts,
    uninstalledFonts,
    installBitmapFont: (install) => installedFonts.push(install),
    uninstallBitmapFont: (name) => uninstalledFonts.push(name),
    bakeRadial(spec) {
      bakedSpecs.push(spec);
      return createOnePixelTexture();
    },
    create: (width, height) => canvases.create(width, height),
    textureFromBake(bake) {
      texturedBakes.push(bake);
      return createOnePixelTexture();
    },
    atlasFromBakes: <Key extends string>(bakes: Readonly<Record<Key, BakeCanvas>>): SpriteAtlas<Key> => {
      const { source } = createOnePixelTexture();
      const textures = {} as Record<Key, Texture>;
      for (const key of Object.keys(bakes) as Key[]) {
        texturedBakes.push(bakes[key]);
        textures[key] = new Texture({ source });
      }
      return { source, textures };
    },
  };
}

/** The texture bundle over a fake baker: no gel patches, a 1× display and the tiny tile unless the test says otherwise. */
export function createTestRenderTextures(overrides: Partial<RenderTextureOptions> = {}): RenderTextures {
  return createRenderTextures({
    seed: DEFAULT_TEXTURE_SEED,
    baker: createFakeTextureBaker(),
    gelPatches: [],
    devicePixelRatio: 1,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  });
}

interface FakeStageParts {
  readonly stage: Container;
  readonly tickerCallbacks: TickerCallback[];
  readonly renderCalls: { count: number };
  readonly screen: { width: number; height: number };
  readonly ticking: { isRunning: boolean };
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
      start: () => {
        parts.ticking.isRunning = true;
      },
      stop: () => {
        parts.ticking.isRunning = false;
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
  const ticking = { isRunning: true };
  const app = createStageHandle({ stage, tickerCallbacks, renderCalls, screen: screenBox, ticking });
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
    ticking,
    // A stopped Pixi ticker runs no callback at all; a `tick()` while stopped must draw nothing here either,
    // or a spec that pauses a session would still see frames and pass without the pause working.
    tick: () => {
      if (!ticking.isRunning) return;
      for (const callback of [...tickerCallbacks]) callback();
    },
    resize: (sizePx) => {
      screenBox.width = sizePx.width;
      screenBox.height = sizePx.height;
    },
    destroy: () => {
      lifecycle.isDestroyed = true;
    },
  };
}
