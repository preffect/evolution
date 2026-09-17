// The client's one injected Pixi factory, the pattern of `game/clock-provider.ts`'s `CLOCK`: the game host reads it
// through this token rather than importing `createPixiApp` directly, so a spec can mount the host without a WebGL
// context and pin what it hands the input seam (#449's review — that hop had no test, and `H` could have been dead
// in the shipped game behind a green gate).
//
// The default factory is the real one, so production wiring is unchanged and nothing but a test ever provides it.

import { InjectionToken } from '@angular/core';
import { createPixiApp } from './pixi-app';
import type { PixiAppHandle, PixiAppOptions } from './pixi-app';

export type CreatePixiApp = (options: PixiAppOptions) => Promise<PixiAppHandle>;

export const CREATE_PIXI_APP = new InjectionToken<CreatePixiApp>('CreatePixiApp', {
  providedIn: 'root',
  factory: () => createPixiApp,
});
