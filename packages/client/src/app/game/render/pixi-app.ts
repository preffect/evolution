// The Pixi application (docs/architecture/client.md §6): one canvas in the host, resolution = device
// pixel ratio, the dark field as the clear colour, sized to the host. The one file that creates
// a Pixi `Application`; the ticker is the frame source, the orchestrator does the rest.

import { Application, Texture } from 'pixi.js';
import { BG_DEEP } from './constants';
import { createPixiTextureBaker } from './pixi-texture-baker';
import type { TextureBaker } from './render-textures';
import { createDomBakeCanvasFactory } from './textures/texture-bake';

export interface PixiAppOptions {
  readonly host: HTMLElement;
  readonly devicePixelRatio: number;
  /** A fixed canvas size for the bench and screenshots; the host's size otherwise. */
  readonly fixedSize?: { readonly width: number; readonly height: number };
  /** Keeps the back buffer readable (`canvas.toDataURL` in the smoke); a copy per frame, so dev builds only. */
  readonly shouldPreserveDrawingBuffer: boolean;
}

export interface PixiAppHandle {
  readonly app: Application;
  readonly canvas: HTMLCanvasElement;
  /** The app's texture baker; the session hands it to `createRenderTextures`. */
  readonly textures: TextureBaker;
  /**
   * Resizes a `fixedSize` canvas in CSS px (the encyclopedia lens on a `--ui-scale` change,
   * docs/architecture/encyclopedia.md §12.7). Nothing is rebaked: the renderer picks the new screen box up on its
   * next frame. An app sized by `resizeTo` never needs it.
   */
  resize(sizePx: { readonly width: number; readonly height: number }): void;
  /**
   * Points the shaders Pixi keeps for the app's lifetime back at a built-in texture. The particle pipe's one shader
   * still holds the last `ParticleContainer`'s texture after the container is gone, so destroying that texture
   * first logs `[BindGroup] a 'textureSource' was destroyed while still bound` (ticket #503). Runs before a bundle
   * is destroyed. **It writes a Pixi internal** (`renderPipes.particle.defaultShader`), checked against Pixi 8.20:
   * after a Pixi upgrade, re-check `?preview=…&opens=20` for the warning before trusting it.
   */
  unbindTextures(): void;
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
    preserveDrawingBuffer: options.shouldPreserveDrawingBuffer,
  });
  const canvas = app.canvas;
  canvas.dataset['testid'] = GAME_CANVAS_TEST_ID;
  options.host.appendChild(canvas);
  return {
    app,
    canvas,
    textures: createPixiTextureBaker(createDomBakeCanvasFactory(options.host.ownerDocument)),
    resize: (sizePx) => {
      app.renderer.resize(sizePx.width, sizePx.height);
    },
    unbindTextures: () => {
      app.renderer.renderPipes.particle.defaultShader.resources['uTexture'] = Texture.WHITE.source;
    },
    destroy: () => {
      app.destroy({ removeView: true }, { children: true, texture: true });
    },
  };
}
