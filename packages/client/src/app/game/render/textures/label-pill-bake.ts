// The label pill (docs/ui/input-and-onboarding.md §6, docs/rendering/own-cell-indicators.md §10): the backing under the threat and escape labels,
// `LABEL_PILL_HEIGHT_PX` tall with a full-height radius, in the callout backing at `LABEL_PILL_ALPHA` with a
// `DANGER_LABEL_RIM_PX` danger rim. Its width follows the label, so it is baked once at its narrowest and
// drawn as a nine-slice sprite that stretches only the middle column: the caps and the glow margin keep
// their px size at every width. Layers back to front: a soft danger glow, a body lit toward the top, a
// top highlight, the rim. CSS px throughout.

import { hexWithAlpha } from '../colour';
import {
  CALLOUT_BACKING,
  DANGER,
  DANGER_LABEL_RIM_PX,
  LABEL_PILL_ALPHA,
  LABEL_PILL_BAKE,
  LABEL_PILL_HEIGHT_PX,
  LABEL_PILL_PAD_PX,
  PANEL_TOP,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { strokeSoft } from './soft-paint';
import { createPxCanvas, type BakeCanvasFactory, type BakeContext2D, type PxBakedSprite } from './texture-bake';

export interface LabelPillBake extends PxBakedSprite {
  /**
   * The nine-slice's left and right borders in CSS px: the glow margin plus a cap. Top and bottom
   * borders are 0 (the pill never stretches vertically).
   */
  readonly capWidthPx: number;
  /** The glow margin on every side: the drawn pill sits this far inside the sprite. */
  readonly marginPx: number;
}

/** A pill's box in CSS px. */
interface PillBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The pill a label of `textWidthPx` sits on: the text plus `LABEL_PILL_PAD_PX` at each end, never narrower than round. */
export function labelPillWidthPx(textWidthPx: number): number {
  return Math.max(textWidthPx + LABEL_PILL_PAD_PX * DIAMETER_PER_RADIUS, LABEL_PILL_HEIGHT_PX);
}

/** The nine-slice sprite's size for a pill of `pillWidthPx`: the pill plus the glow margin all round. */
export function labelPillSpriteSizePx(pillWidthPx: number): { readonly width: number; readonly height: number } {
  const margin = LABEL_PILL_BAKE.glowPx * DIAMETER_PER_RADIUS;
  return { width: pillWidthPx + margin, height: LABEL_PILL_HEIGHT_PX + margin };
}

/** A stadium: two half-circle caps joined by straight top and bottom edges (after `beginPath`). */
export function tracePill(context: BakeContext2D, box: PillBox): void {
  const radius = box.height * HALF;
  const left = box.x + radius;
  const right = box.x + box.width - radius;
  const centreY = box.y + radius;
  context.moveTo(left, box.y);
  context.lineTo(right, box.y);
  context.arc(right, centreY, radius, -Math.PI * HALF, Math.PI * HALF);
  context.lineTo(left, box.y + box.height);
  context.arc(left, centreY, radius, Math.PI * HALF, Math.PI * (1 + HALF));
  context.closePath();
}

function insetBox(box: PillBox, insetPx: number): PillBox {
  return {
    x: box.x + insetPx,
    y: box.y + insetPx,
    width: box.width - insetPx * DIAMETER_PER_RADIUS,
    height: box.height - insetPx * DIAMETER_PER_RADIUS,
  };
}

function paintBody(context: BakeContext2D, box: PillBox): void {
  const gradient = context.createLinearGradient(0, box.y, 0, box.y + box.height);
  gradient.addColorStop(0, hexWithAlpha(PANEL_TOP, LABEL_PILL_ALPHA));
  gradient.addColorStop(1, hexWithAlpha(CALLOUT_BACKING, LABEL_PILL_ALPHA));
  context.fillStyle = gradient;
  context.beginPath();
  tracePill(context, box);
  context.fill();
}

/** A thin light line along the inside of the top edge, between the cap centres. */
function paintHighlight(context: BakeContext2D, box: PillBox): void {
  const inner = insetBox(box, LABEL_PILL_BAKE.highlightInsetPx);
  const radius = inner.height * HALF;
  context.strokeStyle = hexWithAlpha(WHITE, LABEL_PILL_BAKE.highlightAlpha);
  context.lineWidth = DANGER_LABEL_RIM_PX;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(inner.x + radius, inner.y);
  context.lineTo(inner.x + inner.width - radius, inner.y);
  context.stroke();
}

/** The pill at its narrowest (two caps and the stretch column) with its glow margin. */
export function bakeLabelPill(factory: BakeCanvasFactory, scale: number): LabelPillBake {
  const margin = LABEL_PILL_BAKE.glowPx;
  const pillWidth = LABEL_PILL_HEIGHT_PX + LABEL_PILL_BAKE.stretchPx;
  const size = labelPillSpriteSizePx(pillWidth);
  const sprite = createPxCanvas(factory, size.width, size.height, scale);
  const { context } = sprite.canvas;
  const box = { x: margin, y: margin, width: pillWidth, height: LABEL_PILL_HEIGHT_PX };
  strokeSoft(context, (path) => tracePill(path, box), {
    colour: DANGER,
    alpha: LABEL_PILL_BAKE.glowAlpha,
    widthPx: DANGER_LABEL_RIM_PX,
    featherPx: margin,
  });
  paintBody(context, box);
  paintHighlight(context, box);
  context.strokeStyle = DANGER;
  context.lineWidth = DANGER_LABEL_RIM_PX;
  context.beginPath();
  tracePill(context, insetBox(box, DANGER_LABEL_RIM_PX * HALF));
  context.stroke();
  return { ...sprite, capWidthPx: margin + LABEL_PILL_HEIGHT_PX * HALF, marginPx: margin };
}
