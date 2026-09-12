// Shelf packing for a sprite atlas (docs/RENDERING.md §6): the food `ParticleContainer` draws every
// mote from one texture source, so the mote and fragment bakes are placed side by side in one canvas
// and each sprite becomes a frame of it. Pure: sizes in, frames out; `pixi-textures.ts` paints it.

import { ATLAS_PADDING_PX } from '../constants';

export interface AtlasSize {
  readonly width: number;
  readonly height: number;
}

export interface AtlasFrame extends AtlasSize {
  readonly x: number;
  readonly y: number;
}

export interface AtlasLayout<Key extends string> extends AtlasSize {
  readonly frames: Readonly<Record<Key, AtlasFrame>>;
}

/** Tallest first, ties by key, so the same bakes always pack the same way. */
function packingOrder<Key extends string>(sizes: Readonly<Record<Key, AtlasSize>>): Key[] {
  return (Object.keys(sizes) as Key[]).sort((first, second) => {
    const byHeight = sizes[second].height - sizes[first].height;
    return byHeight !== 0 ? byHeight : first.localeCompare(second);
  });
}

/** A shelf width near the square root of the total area, never narrower than the widest sprite. */
function shelfWidth<Key extends string>(sizes: Readonly<Record<Key, AtlasSize>>, padding: number): number {
  let area = 0;
  let widest = 0;
  for (const size of Object.values<AtlasSize>(sizes)) {
    area += (size.width + padding) * (size.height + padding);
    widest = Math.max(widest, size.width + padding);
  }
  return Math.max(widest, Math.ceil(Math.sqrt(area)));
}

/** Lays `sizes` out on shelves, `padding` clear texels between neighbours; the atlas is as wide as its widest shelf. */
export function layoutAtlas<Key extends string>(
  sizes: Readonly<Record<Key, AtlasSize>>,
  padding: number = ATLAS_PADDING_PX,
): AtlasLayout<Key> {
  const limit = shelfWidth(sizes, padding);
  const frames = {} as Record<Key, AtlasFrame>;
  let cursorX = padding;
  let shelfTop = padding;
  let shelfHeight = 0;
  let width = 0;
  for (const key of packingOrder(sizes)) {
    const size = sizes[key];
    if (cursorX + size.width + padding > limit && cursorX > padding) {
      shelfTop += shelfHeight + padding;
      cursorX = padding;
      shelfHeight = 0;
    }
    frames[key] = { x: cursorX, y: shelfTop, width: size.width, height: size.height };
    cursorX += size.width + padding;
    shelfHeight = Math.max(shelfHeight, size.height);
    width = Math.max(width, cursorX);
  }
  return { width, height: shelfTop + shelfHeight + padding, frames };
}
