// The Pixi application (docs/ARCHITECTURE.md §6): one canvas in the host, resolution = device
// pixel ratio, the dark field as the clear colour, sized to the host. The one file that creates
// a Pixi `Application`; the ticker is the frame source, the orchestrator does the rest.

import { Application } from 'pixi.js';
import { BG_DEEP } from './constants';
import { createPixiTextureBaker } from './pixi-texture-baker';
import type { TextureBaker } from './render-textures';

export interface PixiAppOptions {
  readonly host: HTMLElement;
  readonly devicePixelRatio: number;
  /** A fixed canvas size for the bench and screenshots; the host's size otherwise. */
  readonly fixedSize?: { readonly width: number; readonly height: number };
}

export interface PixiAppHandle {
  readonly app: Application;
  readonly canvas: HTMLCanvasElement;
  /** Bakes through this app's renderer; the session hands it to `createRenderTextures`. */
  readonly textures: TextureBaker;
  destroy(): void;
}

export const GAME_CANVAS_TEST_ID = 'game-canvas';

export async function createPixiApp(options: PixiAppOptions): Promise<PixiAppHandle> {
  const app = new Application();
  await app.init({
    background: BG_DEEP,
    resolution: options.devicePixelRatio,
    autoDensity: true,
    antialias: false,
    preference: 'webgl',
    resizeTo: options.fixedSize === undefined ? options.host : undefined,
    width: options.fixedSize?.width,
    height: options.fixedSize?.height,
    preserveDrawingBuffer: true,
  });
  const canvas = app.canvas;
  canvas.dataset['testid'] = GAME_CANVAS_TEST_ID;
  options.host.appendChild(canvas);
  return {
    app,
    canvas,
    textures: createPixiTextureBaker(app.renderer),
    destroy: () => {
      app.destroy({ removeView: true }, { children: true, texture: true });
    },
  };
}
