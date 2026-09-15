// The pills (docs/ui/input-and-onboarding.md §6, docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): the
// label pill under the threat and escape labels (`LABEL_PILL_HEIGHT_PX`, a `DANGER_LABEL_RIM_PX` danger rim) and the
// cue pills under the mass chip, the rate tags and the floaters (`CUE_PILL_HEIGHT_PX`, a `CUE_RIM_PX` rim in the
// cue's role colour, or none). Both are the callout backing at `LABEL_PILL_ALPHA` with a full-height radius. Their
// width follows the text, so each is baked once at its narrowest and drawn as a nine-slice sprite that stretches
// only the middle column: the caps and the glow margin keep their px size at every width. Layers back to front: a
// soft glow in the rim colour, a body lit toward the top, a top highlight, the rim. CSS px throughout.

import { hexWithAlpha } from '../colour';
import {
  CALLOUT_BACKING,
  CUE_PILL_HEIGHT_PX,
  CUE_PILL_PAD_PX,
  CUE_RIM_PX,
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

/** One kind of pill: its height, the pad from the text to each end, and its rim (`null` for none). */
export interface PillSpec {
  readonly heightPx: number;
  readonly padPx: number;
  readonly rimColour: string | null;
  readonly rimPx: number;
}

/** The label pill of §6: the threat and escape labels' backing, rimmed in danger. */
export const LABEL_PILL_SPEC: PillSpec = {
  heightPx: LABEL_PILL_HEIGHT_PX,
  padPx: LABEL_PILL_PAD_PX,
  rimColour: DANGER,
  rimPx: DANGER_LABEL_RIM_PX,
};

/** A cue pill (§3.1.5) rimmed in `rimColour`, or unrimmed. */
export function cuePillSpec(rimColour: string | null): PillSpec {
  return { heightPx: CUE_PILL_HEIGHT_PX, padPx: CUE_PILL_PAD_PX, rimColour, rimPx: CUE_RIM_PX };
}

/** A pill's box in CSS px. */
interface PillBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The pill `contentWidthPx` of text sits on: the content plus the pad at each end, never narrower than round. */
export function pillWidthPx(contentWidthPx: number, spec: PillSpec): number {
  return Math.max(contentWidthPx + spec.padPx * DIAMETER_PER_RADIUS, spec.heightPx);
}

/** The nine-slice sprite's size for a pill of `widthPx`: the pill plus the glow margin all round. */
export function pillSpriteSizePx(widthPx: number, spec: PillSpec): { readonly width: number; readonly height: number } {
  const margin = LABEL_PILL_BAKE.glowPx * DIAMETER_PER_RADIUS;
  return { width: widthPx + margin, height: spec.heightPx + margin };
}

/** The label pill a label of `textWidthPx` sits on. */
export function labelPillWidthPx(textWidthPx: number): number {
  return pillWidthPx(textWidthPx, LABEL_PILL_SPEC);
}

export function labelPillSpriteSizePx(widthPx: number): { readonly width: number; readonly height: number } {
  return pillSpriteSizePx(widthPx, LABEL_PILL_SPEC);
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

/** A soft glow in the rim colour, feathered over the margin; an unrimmed pill has none. */
function paintGlow(context: BakeContext2D, box: PillBox, spec: PillSpec): void {
  if (spec.rimColour === null) return;
  strokeSoft(context, (path) => tracePill(path, box), {
    colour: spec.rimColour,
    alpha: LABEL_PILL_BAKE.glowAlpha,
    widthPx: spec.rimPx,
    featherPx: LABEL_PILL_BAKE.glowPx,
  });
}

/** The rim, inside the pill's box so nothing pokes past the backing's edge; an unrimmed pill has none. */
function paintRim(context: BakeContext2D, box: PillBox, spec: PillSpec): void {
  if (spec.rimColour === null) return;
  context.strokeStyle = spec.rimColour;
  context.lineWidth = spec.rimPx;
  context.beginPath();
  tracePill(context, insetBox(box, spec.rimPx * HALF));
  context.stroke();
}

/** A pill at its narrowest (two caps and the stretch column) with its glow margin. */
export function bakePill(factory: BakeCanvasFactory, scale: number, spec: PillSpec): LabelPillBake {
  const margin = LABEL_PILL_BAKE.glowPx;
  const width = spec.heightPx + LABEL_PILL_BAKE.stretchPx;
  const size = pillSpriteSizePx(width, spec);
  const sprite = createPxCanvas(factory, size.width, size.height, scale);
  const { context } = sprite.canvas;
  const box = { x: margin, y: margin, width, height: spec.heightPx };
  paintGlow(context, box, spec);
  paintBody(context, box);
  paintHighlight(context, box);
  paintRim(context, box, spec);
  return { ...sprite, capWidthPx: margin + spec.heightPx * HALF, marginPx: margin };
}

/** The label pill of §6. */
export function bakeLabelPill(factory: BakeCanvasFactory, scale: number): LabelPillBake {
  return bakePill(factory, scale, LABEL_PILL_SPEC);
}
