// Baking code-drawn textures (docs/ASSET-GENERATION.md, docs/VISUAL-STYLE.md §8): every glow,
// mote, organelle and the dish field is drawn once on a 2D canvas and blitted as a sprite. The
// bakes draw through `BakeContext2D`, the slice of the Canvas 2D API they use, so a unit test
// records the layers on a fake and the browser gets a real canvas from the DOM factory.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../colour';

export interface BakeGradient {
  addColorStop(offset: number, colour: string): void;
}

/** The Canvas 2D calls the bakes make; a `CanvasRenderingContext2D` satisfies it. */
export interface BakeContext2D {
  fillStyle: string | BakeGradient | CanvasPattern;
  strokeStyle: string | BakeGradient | CanvasPattern;
  lineWidth: number;
  lineCap: 'butt' | 'round' | 'square';
  globalAlpha: number;
  globalCompositeOperation: string;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(controlX: number, controlY: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, start: number, end: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  fill(): void;
  stroke(): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): BakeGradient;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): BakeGradient;
}

export interface BakeCanvas {
  readonly width: number;
  readonly height: number;
  readonly context: BakeContext2D;
  /** The platform canvas a texture is made from (an `HTMLCanvasElement` in the browser). */
  readonly element: unknown;
}

export interface BakeCanvasFactory {
  create(width: number, height: number): BakeCanvas;
}

/** The browser factory: one `<canvas>` per bake, never attached to the document. */
export function createDomBakeCanvasFactory(documentReference: Document): BakeCanvasFactory {
  return {
    create(width, height) {
      const element = documentReference.createElement('canvas');
      element.width = Math.max(1, Math.ceil(width));
      element.height = Math.max(1, Math.ceil(height));
      const context = element.getContext('2d');
      if (context === null) throw new Error('Canvas 2D is unavailable: the texture bake cannot run.');
      return { width: element.width, height: element.height, context, element };
    },
  };
}

export interface RadialStop {
  readonly offset: number;
  readonly colour: string;
  readonly alpha: number;
}

export interface DiscSpec {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface Paint {
  readonly colour: string;
  readonly alpha: number;
}

export interface StrokePaint extends Paint {
  readonly width: number;
}

/** A radial gradient of `stops` filled over a disc; the one primitive behind every soft edge. */
export function fillRadial(context: BakeContext2D, disc: DiscSpec, stops: readonly RadialStop[]): void {
  const gradient = context.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, disc.radius);
  for (const stop of stops) gradient.addColorStop(stop.offset, hexWithAlpha(stop.colour, stop.alpha));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(disc.x, disc.y, disc.radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

/** A gradient from `alpha` at the centre to clear at the rim: the halo every glow is built from. */
export function fillHalo(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  fillRadial(context, disc, [
    { offset: 0, colour: paint.colour, alpha: paint.alpha },
    { offset: 1, colour: paint.colour, alpha: 0 },
  ]);
}

export function fillDisc(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  context.fillStyle = hexWithAlpha(paint.colour, paint.alpha);
  context.beginPath();
  context.arc(disc.x, disc.y, disc.radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

export interface EllipseSpec {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotation: number;
}

export function fillEllipse(context: BakeContext2D, ellipse: EllipseSpec, paint: Paint): void {
  context.fillStyle = hexWithAlpha(paint.colour, paint.alpha);
  context.beginPath();
  context.ellipse(ellipse.x, ellipse.y, ellipse.radiusX, ellipse.radiusY, ellipse.rotation, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

export function strokeEllipse(context: BakeContext2D, ellipse: EllipseSpec, paint: StrokePaint): void {
  context.strokeStyle = hexWithAlpha(paint.colour, paint.alpha);
  context.lineWidth = paint.width;
  context.beginPath();
  context.ellipse(ellipse.x, ellipse.y, ellipse.radiusX, ellipse.radiusY, ellipse.rotation, 0, RADIANS_PER_FULL_TURN);
  context.stroke();
}

export function strokeDisc(context: BakeContext2D, disc: DiscSpec, paint: StrokePaint): void {
  strokeEllipse(context, { x: disc.x, y: disc.y, radiusX: disc.radius, radiusY: disc.radius, rotation: 0 }, paint);
}

export interface GlowLayers {
  /** Radii as multiples of the body radius. */
  readonly soft: number;
  readonly wide: number;
  readonly softAlpha: number;
  readonly wideAlpha: number;
}

/** Core + soft halo + wide halo (ASSET-GENERATION §1.5); the glint is the caller's, it sits on the body. */
export function paintGlow(context: BakeContext2D, disc: DiscSpec, colour: string, layers: GlowLayers): void {
  fillHalo(context, { ...disc, radius: disc.radius * layers.wide }, { colour, alpha: layers.wideAlpha });
  fillHalo(context, { ...disc, radius: disc.radius * layers.soft }, { colour, alpha: layers.softAlpha });
}

/** Glint proportions on a baked body: toward the light at 0.45 r, 0.35 × 0.16 r, rotated with the light. */
const GLINT_OFFSET_SHARE = 0.45;
const GLINT_LENGTH_SHARE = 0.35;
const GLINT_WIDTH_SHARE = 0.16;
/** The glint leans with the light: an eighth of a turn. */
const GLINT_ROTATION_TURNS = -0.125;
const GLINT_ROTATION = RADIANS_PER_FULL_TURN * GLINT_ROTATION_TURNS;

/** The specular glint: a small white ellipse toward the top-left of a body (VISUAL-STYLE §1). */
export function paintGlint(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  const offset = disc.radius * GLINT_OFFSET_SHARE;
  fillEllipse(
    context,
    {
      x: disc.x - offset,
      y: disc.y - offset,
      radiusX: disc.radius * GLINT_LENGTH_SHARE,
      radiusY: disc.radius * GLINT_WIDTH_SHARE,
      rotation: GLINT_ROTATION,
    },
    paint,
  );
}
