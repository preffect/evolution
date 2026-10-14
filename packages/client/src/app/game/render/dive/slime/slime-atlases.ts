// The slime's sprites, drawn once a page (docs/rendering/opening-dive.md §4, ticket #803): the diatoms' atlas (every
// rung of each diatom's ladder, in bright and dark field, and the mockup's small bright-field sprites), the bacteria's
// atlas (the three rods and the two specks), and the plankton's ladders, a canvas a rung. Each bake is a generator that yields after every picture, so the dive's pump slices them.

import { SLIME_SPRITE_LADDER } from '../../constants/dive-slime';
import {
  SLIME_MOTE_KINDS,
  SLIME_MOTE_SPRITE,
  SLIME_ROD_KINDS,
  SLIME_ROD_SPRITE,
} from '../../constants/dive-slime-bacteria';
import { SLIME_DIATOM_ATLAS_SLOT, SLIME_DIATOM_SPRITE } from '../../constants/dive-slime-diatoms';
import { HALF } from '../../geometry';
import type { ShoreCanvas, ShoreCanvasFactory } from '../shore/shore-canvas';
import { drawMote, drawRod } from './slime-bacteria-art';
import {
  DIATOM_PICTURES,
  PLANKTON_PICTURES,
  drawPictureInto,
  marginBox,
  pictureSize,
  type PictureBox,
  type PictureRung,
  type SlimePicture,
} from './slime-pictures';
import { ladderSizes, packAtlas, type AtlasRect } from './slime-sprite-ladder';

/** One picture in an atlas: where it is (atlas px) and the box it was drawn in (its unit). */
export interface AtlasEntry {
  readonly rect: AtlasRect;
  readonly box: PictureBox;
}

export interface DiatomAtlas {
  readonly canvas: ShoreCanvas;
  /** The ladder's rungs, css px of the diatom's length. */
  readonly sizes: readonly number[];
  /** By `DIATOM_ATLAS_SLOT`, then rung: `entries[slot × sizes.length + rung]`; the small sprites after them. */
  readonly entries: readonly AtlasEntry[];
}

export const DIATOM_ATLAS_SLOT = SLIME_DIATOM_ATLAS_SLOT;
export const DIATOM_ATLAS_SLOTS = Object.keys(DIATOM_ATLAS_SLOT).length;

/** The ladder slot of each floor diatom kind (cocconeis, pennate, licmophora) in bright field, and in dark field. */
export const DIATOM_KIND_SLOTS: readonly (readonly [number, number])[] = [
  [DIATOM_ATLAS_SLOT.cocconeis, DIATOM_ATLAS_SLOT.cocconeisDark],
  [DIATOM_ATLAS_SLOT.pennate, DIATOM_ATLAS_SLOT.pennateDark],
  [DIATOM_ATLAS_SLOT.licmophora, DIATOM_ATLAS_SLOT.licmophora],
];

const BRIGHT = 0;
const DARK = 1;

function diatomLadderPictures(): SlimePicture[] {
  return [
    DIATOM_PICTURES.cocconeis(BRIGHT),
    DIATOM_PICTURES.cocconeis(DARK),
    DIATOM_PICTURES.pennate(BRIGHT),
    DIATOM_PICTURES.pennate(DARK),
    DIATOM_PICTURES.licmophora,
  ];
}

/** The small bright-field sprites (`diatomSprite`): drawn as at `detailPx`, `sizePx` px over `span` lengths. */
function smallSpriteRung(): PictureRung {
  const { sizePx, span, detailPx } = SLIME_DIATOM_SPRITE;
  return { unitPx: detailPx, scale: sizePx / span / detailPx };
}

/** Every rung of every diatom, then the small sprites, packed: what goes where, in drawing order. */
export function diatomAtlasPlan(devicePixelRatio: number): {
  readonly sizes: readonly number[];
  readonly items: readonly { readonly picture: SlimePicture; readonly rung: PictureRung }[];
} {
  const sizes = ladderSizes(SLIME_SPRITE_LADDER.maxPx.diatoms);
  const ladders = diatomLadderPictures().flatMap((picture) =>
    sizes.map((unitPx) => ({ picture, rung: { unitPx, scale: devicePixelRatio } })),
  );
  const small = [DIATOM_PICTURES.cocconeis(BRIGHT), DIATOM_PICTURES.pennate(BRIGHT), DIATOM_PICTURES.licmophora].map(
    (picture) => ({ picture, rung: smallSpriteRung() }),
  );
  return { sizes, items: [...ladders, ...small] };
}

/** The diatoms' atlas, a picture a step. */
export function* bakeDiatomAtlas(factory: ShoreCanvasFactory, devicePixelRatio: number): Generator<void, DiatomAtlas> {
  const plan = diatomAtlasPlan(devicePixelRatio);
  const layout = packAtlas(plan.items.map(({ picture, rung }) => pictureSize(picture.box, rung)));
  const canvas = factory.create(layout.width, layout.height);
  const entries: AtlasEntry[] = [];
  for (const [index, { picture, rung }] of plan.items.entries()) {
    const rect = layout.rects[index] ?? { x: 0, y: 0, width: 0, height: 0 };
    drawPictureInto(canvas.context, picture, rung, rect);
    entries.push({ rect, box: marginBox(picture.box, rung.unitPx) });
    yield;
  }
  return { canvas, sizes: plan.sizes, entries };
}

/** The bacteria's atlas: the rods and the specks, each in its own cell. */
export interface BacteriaAtlas {
  readonly canvas: ShoreCanvas;
  readonly rods: readonly AtlasRect[];
  readonly motes: readonly AtlasRect[];
}

/** Where the bacteria's sprites go: the rods along the top, the specks under them. */
export function bacteriaAtlasLayout(): Omit<BacteriaAtlas, 'canvas'> & {
  readonly width: number;
  readonly height: number;
} {
  const { canvas: rodCell } = SLIME_ROD_SPRITE;
  const moteSize = SLIME_MOTE_SPRITE.size;
  const rods = SLIME_ROD_KINDS.map((_kind, index) => ({ x: index * rodCell.width, y: 0, ...rodCell }));
  const motes = SLIME_MOTE_KINDS.map((_kind, index) => ({
    x: index * moteSize,
    y: rodCell.height,
    width: moteSize,
    height: moteSize,
  }));
  return { rods, motes, width: rods.length * rodCell.width, height: rodCell.height + moteSize };
}

function centredIn(canvas: ShoreCanvas, rect: AtlasRect, draw: () => void): void {
  const { context } = canvas;
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.translate(rect.x + rect.width * HALF, rect.y + rect.height * HALF);
  draw();
  context.restore();
}

/** The bacteria's atlas, at its sprites' own px whatever the screen (the mockup's sprites were fixed-size too). */
export function* bakeBacteriaAtlas(factory: ShoreCanvasFactory): Generator<void, BacteriaAtlas> {
  const layout = bacteriaAtlasLayout();
  const canvas = factory.create(layout.width, layout.height);
  layout.rods.forEach((rect, index) => {
    const kind = SLIME_ROD_KINDS[index];
    if (kind !== undefined) centredIn(canvas, rect, () => drawRod(canvas.context, kind));
  });
  yield;
  layout.motes.forEach((rect, index) => {
    const kind = SLIME_MOTE_KINDS[index];
    if (kind !== undefined) centredIn(canvas, rect, () => drawMote(canvas.context, kind));
  });
  return { canvas, rods: layout.rods, motes: layout.motes };
}

/** One rung of a plankton layer: its canvas and the box it was drawn in. */
export interface PlanktonRung {
  readonly unitPx: number;
  readonly canvas: ShoreCanvas;
  readonly box: PictureBox;
}

export type PlanktonLayerName = keyof typeof PLANKTON_PICTURES | 'pennate' | 'pennateDark';
export type PlanktonLadders = Readonly<Record<PlanktonLayerName, readonly PlanktonRung[]>>;

/** Each plankton layer's picture and the top of its ladder. */
function planktonLayers(): readonly (readonly [PlanktonLayerName, SlimePicture, number])[] {
  const top = SLIME_SPRITE_LADDER.maxPx;
  return [
    ['nauplius', PLANKTON_PICTURES.nauplius, top.nauplius],
    ['ciliateBody', PLANKTON_PICTURES.ciliateBody, top.ciliate],
    ['ciliateRim', PLANKTON_PICTURES.ciliateRim, top.ciliate],
    ['dinoBody', PLANKTON_PICTURES.dinoBody, top.dino],
    ['dinoRim', PLANKTON_PICTURES.dinoRim, top.dino],
    ['pennate', DIATOM_PICTURES.pennate(BRIGHT), top.pennate],
    ['pennateDark', DIATOM_PICTURES.pennate(DARK), top.pennate],
  ];
}

/** Every plankton layer's ladder, smallest rungs first across the layers, a rung a step. */
export function* bakePlanktonLadders(
  factory: ShoreCanvasFactory,
  devicePixelRatio: number,
): Generator<void, PlanktonLadders> {
  const layers = planktonLayers();
  const ladders = {} as Record<PlanktonLayerName, PlanktonRung[]>;
  for (const [name] of layers) ladders[name] = [];
  const plans = layers.map(([name, picture, top]) => ({ name, picture, sizes: ladderSizes(top) }));
  const rungs = Math.max(...plans.map((plan) => plan.sizes.length));
  for (let rung = 0; rung < rungs; rung += 1) {
    for (const { name, picture, sizes } of plans) {
      const unitPx = sizes[rung];
      if (unitPx === undefined) continue;
      const step = { unitPx, scale: devicePixelRatio };
      const [width, height] = pictureSize(picture.box, step);
      const canvas = factory.create(width, height);
      drawPictureInto(canvas.context, picture, step, { x: 0, y: 0, width, height });
      ladders[name].push({ unitPx, canvas, box: marginBox(picture.box, unitPx) });
      yield;
    }
  }
  return ladders;
}
