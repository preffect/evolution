// The slime's still pictures (docs/rendering/opening-dive.md §4, ticket #803): each diatom and each plankton layer that
// does not move, with the box round its origin that holds it, and how one is drawn at a rung of its ladder — in its
// own unit, `unitPx` css px to the unit, at the dive's device pixel ratio — into a canvas or a cell of an atlas.

import { SLIME_PICTURE_BOXES, SLIME_PICTURE_MARGIN_PX } from '../../constants/dive-slime-diatoms';
import type { ShoreContext2D } from '../shore/shore-canvas';
import { drawCocconeis, drawLicmophora, drawPennate } from './slime-diatom-art';
import type { GlassPen } from './slime-glass';
import { drawCiliateBody, drawCiliateRim, drawDinoBody, drawDinoRim, drawNaupliusBody } from './slime-plankton-art';

/** A box round a picture's origin, in its unit. */
export interface PictureBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A still picture: its box, and how it draws in its unit. */
export interface SlimePicture {
  readonly box: PictureBox;
  draw(pen: GlassPen): void;
}

const BOX = SLIME_PICTURE_BOXES;

/** The diatoms, in bright field and in the dark field (where their glass shows more), and licmophora (the same in both). */
export const DIATOM_PICTURES = {
  cocconeis: (darkField: number): SlimePicture => ({
    box: BOX.cocconeis,
    draw: (pen) => drawCocconeis(pen, darkField),
  }),
  pennate: (darkField: number): SlimePicture => ({ box: BOX.pennate, draw: (pen) => drawPennate(pen, darkField) }),
  licmophora: { box: BOX.licmophora, draw: drawLicmophora } satisfies SlimePicture,
} as const;

/** The plankton's still layers: the larva whole, the ciliate's and the dinoflagellate's bodies and rims. */
export const PLANKTON_PICTURES = {
  nauplius: { box: BOX.nauplius, draw: (pen) => drawNaupliusBody(pen, 0) } satisfies SlimePicture,
  ciliateBody: { box: BOX.ciliate, draw: (pen) => drawCiliateBody(pen, 0) } satisfies SlimePicture,
  ciliateRim: { box: BOX.ciliate, draw: drawCiliateRim } satisfies SlimePicture,
  dinoBody: { box: BOX.dino, draw: (pen) => drawDinoBody(pen, 0) } satisfies SlimePicture,
  dinoRim: { box: BOX.dino, draw: drawDinoRim } satisfies SlimePicture,
} as const;

/** The box a picture is drawn in at `unitPx`: its own, and the margin's css px more each way, in its unit. */
export function marginBox(box: PictureBox, unitPx: number): PictureBox {
  const margin = SLIME_PICTURE_MARGIN_PX / unitPx;
  return { left: box.left - margin, top: box.top - margin, right: box.right + margin, bottom: box.bottom + margin };
}

/** A rung of a picture: drawn as it looks `unitPx` css px long, `scale` canvas px to the css px. */
export interface PictureRung {
  readonly unitPx: number;
  readonly scale: number;
}

/** The canvas px a picture takes at a rung: its margin box at `unitPx × scale` px to the unit, rounded up. */
export function pictureSize(box: PictureBox, rung: PictureRung): [number, number] {
  const drawn = marginBox(box, rung.unitPx);
  const pxPerUnit = rung.unitPx * rung.scale;
  return [Math.ceil((drawn.right - drawn.left) * pxPerUnit), Math.ceil((drawn.bottom - drawn.top) * pxPerUnit)];
}

/** Draws `picture` at a rung into the canvas px `cell` of `context`, clipped to it. */
export function drawPictureInto(
  context: ShoreContext2D,
  picture: SlimePicture,
  rung: PictureRung,
  cell: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): void {
  const drawn = marginBox(picture.box, rung.unitPx);
  const pxPerUnit = rung.unitPx * rung.scale;
  context.save();
  context.beginPath();
  context.rect(cell.x, cell.y, cell.width, cell.height);
  context.clip();
  context.setTransform(pxPerUnit, 0, 0, pxPerUnit, cell.x - drawn.left * pxPerUnit, cell.y - drawn.top * pxPerUnit);
  picture.draw({ context, unitPx: rung.unitPx });
  context.restore();
}
