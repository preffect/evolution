// The slime's sprite ladders and atlases (docs/rendering/opening-dive.md §4, ticket #803): each plankton and diatom
// picture is drawn once a page at a ladder of sizes `√2` apart, as the mockup drew it at that size, and a frame picks
// the smallest rung at least as big as the object (`SLIME_SPRITE_LADDER`). Small pictures share an atlas, packed in
// shelves with a gutter round each so a filtered sample never reads a neighbour.

import { SLIME_SPRITE_LADDER } from '../../constants/dive-slime';

/** The rungs from the ladder's least size up to and including the first at or past `maxPx`, in css px. */
export function ladderSizes(maxPx: number): number[] {
  const sizes: number[] = [];
  for (let size = SLIME_SPRITE_LADDER.minPx; ; size *= SLIME_SPRITE_LADDER.step) {
    sizes.push(size);
    if (size >= maxPx) return sizes;
  }
}

/** The rung a picture `sizePx` css px long is drawn from: the smallest at least that big, or the top one. */
export function rungFor(sizes: readonly number[], sizePx: number): number {
  const rung = sizes.findIndex((size) => size >= sizePx);
  return rung === -1 ? sizes.length - 1 : rung;
}

/** A place in an atlas, in its px. */
export interface AtlasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where each picture goes, and the atlas's size. */
export interface AtlasLayout {
  readonly width: number;
  readonly height: number;
  readonly rects: readonly AtlasRect[];
}

function nextPowerOfTwo(value: number): number {
  return 1 << Math.ceil(Math.log2(Math.max(1, value)));
}

/** Packs `sizes` (each `[width, height]` in px) into shelves of an atlas `SLIME_SPRITE_LADDER.atlasWidthPx` wide. */
export function packAtlas(sizes: readonly (readonly [number, number])[]): AtlasLayout {
  const { atlasWidthPx: width, gutterPx: gutter } = SLIME_SPRITE_LADDER;
  const rects: AtlasRect[] = [];
  let x = gutter;
  let y = gutter;
  let shelf = 0;
  for (const [itemWidth, itemHeight] of sizes) {
    if (x + itemWidth + gutter > width) {
      x = gutter;
      y += shelf + gutter;
      shelf = 0;
    }
    rects.push({ x, y, width: itemWidth, height: itemHeight });
    x += itemWidth + gutter;
    shelf = Math.max(shelf, itemHeight);
  }
  return { width, height: nextPowerOfTwo(y + shelf + gutter), rects };
}
