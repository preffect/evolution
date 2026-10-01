// The shore's bakes as GPU textures (docs/rendering/opening-dive.md §4, ticket #801): a level's colour (sampled,
// clamped) and its data texture (read texel by texel), and the live sea's tiles (repeating, mipmapped so they stay
// smooth as they shrink). Each level's are given back when the camera leaves it.

import { CanvasSource, type TextureSource } from 'pixi.js';
import { byteDataTexture } from '../../textures/pixi-textures';
import type { ShoreCanvas } from './shore-canvas';
import type { ShoreLevelUploader } from './shore-levels';
import type { ShoreLevelTextures, ShoreTileTextures } from './shore-mesh';
import type { ShoreTile, ShoreTileSource } from './shore-tiles';

function canvasSource(canvas: ShoreCanvas, isRepeating: boolean): TextureSource {
  return new CanvasSource({
    resource: canvas.image as HTMLCanvasElement,
    scaleMode: 'linear',
    addressMode: isRepeating ? 'repeat' : 'clamp-to-edge',
    autoGenerateMipmaps: isRepeating,
    mipmapFilter: 'linear',
  });
}

/** A level's textures from its snapshot; `release` destroys them. */
export const SHORE_LEVEL_UPLOADER: ShoreLevelUploader<ShoreLevelTextures> = {
  upload: (snapshot) => ({
    colour: canvasSource(snapshot.colour, false),
    distances: byteDataTexture(snapshot.sea.bytes, {
      width: snapshot.sea.width,
      height: snapshot.sea.height,
      isFiltered: false,
      isRepeating: false,
      hasMipmaps: false,
    }),
    stones: snapshot.stones === null ? null : canvasSource(snapshot.stones, false),
    ramp: byteDataTexture(snapshot.ramp.bytes, {
      width: snapshot.ramp.entries,
      height: 1,
      isFiltered: true,
      isRepeating: false,
      hasMipmaps: false,
    }),
    rampScale: { entries: snapshot.ramp.entries, stepM: snapshot.ramp.stepM },
    grid: { width: snapshot.sea.width, height: snapshot.sea.height, cellsPerMetre: snapshot.sea.cellsPerMetre },
    halfWidthM: snapshot.view.halfWidthM,
    halfHeightM: snapshot.view.halfHeightM,
  }),
  release: (level) => {
    level.colour.destroy();
    level.distances.destroy();
    level.stones?.destroy();
    level.ramp.destroy();
  },
};

const LIVE_TILES = ['caustic', 'swell', 'ripple', 'glint', 'foam', 'seabed'] as const;

/** The live sea's tiles once every one has baked; `null` before. */
export function liveTileTextures(tiles: ShoreTileSource): ShoreTileTextures | null {
  const baked = LIVE_TILES.map((name) => tiles.get(name));
  if (baked.some((tile) => tile === null)) return null;
  const [caustic, swell, ripple, glint, foam, floor] = baked as ShoreTile[];
  if (
    caustic === undefined ||
    swell === undefined ||
    ripple === undefined ||
    glint === undefined ||
    foam === undefined ||
    floor === undefined
  ) {
    return null;
  }
  return {
    caustic: canvasSource(caustic.canvas, true),
    swell: canvasSource(swell.canvas, true),
    ripple: canvasSource(ripple.canvas, true),
    glint: canvasSource(glint.canvas, true),
    foam: canvasSource(foam.canvas, true),
    floor: canvasSource(floor.canvas, true),
    foamMean: foam.averageRgba,
  };
}

/** Gives the live tiles' textures back. */
export function releaseTileTextures(textures: ShoreTileTextures): void {
  for (const source of [
    textures.caustic,
    textures.swell,
    textures.ripple,
    textures.glint,
    textures.foam,
    textures.floor,
  ]) {
    source.destroy();
  }
}
