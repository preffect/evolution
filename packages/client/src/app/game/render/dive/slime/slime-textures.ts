// The slime band's textures (docs/rendering/opening-dive.md §4, ticket #803): the kelp's two cell tiles (repeating,
// mipmapped so they stay smooth as they shrink), the diatoms' and the bacteria's atlases, and
// each rung of the plankton's ladders, every one its own GPU copy. Made once the bakes have landed, given back with
// the band. The halos' glow is drawn when the band opens, so a scrub before the bakes still shows the plankton.

import { Texture, type TextureSource } from 'pixi.js';
import { WHITE } from '../../constants';
import { SLIME_GLOW } from '../../constants/dive-slime';
import { HALF } from '../../geometry';
import type { ShoreCanvasFactory } from '../shore/shore-canvas';
import { canvasSource } from '../shore/shore-textures';
import type { PlanktonLayerName } from './slime-atlases';
import type { SlimeBaked } from './slime-bakes';
import { drawGlow } from './slime-glass';
import type { PlanktonRungTexture, PlanktonTextures } from './slime-organisms';

export interface SlimeTextures {
  readonly cells: TextureSource;
  readonly cellsDark: TextureSource;
  readonly diatoms: TextureSource;
  readonly bacteria: TextureSource;
  readonly plankton: PlanktonTextures;
}

/** The band's textures from its bakes. */
export function slimeTextures(baked: SlimeBaked): SlimeTextures {
  const plankton = {} as Record<PlanktonLayerName, readonly PlanktonRungTexture[]>;
  for (const [name, rungs] of Object.entries(baked.plankton) as [
    PlanktonLayerName,
    SlimeBaked['plankton']['nauplius'],
  ][]) {
    plankton[name] = rungs.map((rung) => ({
      rung,
      texture: new Texture({ source: canvasSource(rung.canvas, false) }),
    }));
  }
  return {
    cells: canvasSource(baked.cells.bright, true),
    cellsDark: canvasSource(baked.cells.dark, true),
    diatoms: canvasSource(baked.diatoms.canvas, false),
    bacteria: canvasSource(baked.bacteria.canvas, false),
    plankton,
  };
}

/** Gives every texture back. */
export function releaseSlimeTextures(textures: SlimeTextures): void {
  for (const source of [textures.cells, textures.cellsDark, textures.diatoms, textures.bacteria]) {
    source.destroy();
  }
  for (const rungs of Object.values(textures.plankton)) for (const { texture } of rungs) texture.destroy(true);
}

/** The white glow the halos are tinted from (`glowSprite`), drawn now on a canvas of `factory`'s. */
export function glowTexture(factory: ShoreCanvasFactory): Texture {
  const size = SLIME_GLOW.sizePx;
  const canvas = factory.create(size, size);
  const radius = size * HALF;
  drawGlow(canvas.context, { x: radius, y: radius, radius }, WHITE, 1);
  return new Texture({ source: canvasSource(canvas, false) });
}
