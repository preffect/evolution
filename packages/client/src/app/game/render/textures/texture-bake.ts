// Baking code-drawn textures (docs/ASSET-GENERATION.md, docs/VISUAL-STYLE.md §8): every glow,
// mote, organelle and the dish field is drawn once on a 2D canvas and blitted as a sprite. The
// bakes draw through `BakeContext2D`, the slice of the Canvas 2D API they use, so a unit test
// records the layers on a fake and the browser gets a real canvas from the DOM factory.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import { BAKE_GLINT } from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';

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
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(controlX: number, controlY: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, start: number, end: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): BakeGradient;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): BakeGradient;
}

export interface BakeCanvas {
  readonly width: number;
  readonly height: number;
  readonly context: BakeContext2D;
  /** The platform canvas a texture is made from (an `HTMLCanvasElement` in the browser, `null` in a fake). */
  readonly element: HTMLCanvasElement | null;
}

export interface BakeCanvasFactory {
  create(width: number, height: number): BakeCanvas;
}

const MIN_CANVAS_PX = 1;

/** The browser factory: one `<canvas>` per bake, never attached to the document. */
export function createDomBakeCanvasFactory(documentReference: Document): BakeCanvasFactory {
  return {
    create(width, height) {
      const element = documentReference.createElement('canvas');
      element.width = Math.max(MIN_CANVAS_PX, Math.ceil(width));
      element.height = Math.max(MIN_CANVAS_PX, Math.ceil(height));
      const context = element.getContext('2d');
      if (context === null) throw new Error('Canvas 2D is unavailable: the texture bake cannot run.');
      return { width: element.width, height: element.height, context, element };
    },
  };
}

/** A square canvas holding a body of `bodyPx` and everything out to `reach × bodyPx` around it. */
export interface BodyCanvas {
  readonly canvas: BakeCanvas;
  /** The body's centre on both axes. */
  readonly centre: number;
}

export function createBodyCanvas(factory: BakeCanvasFactory, bodyPx: number, reach: number): BodyCanvas {
  const size = Math.ceil(bodyPx * reach * DIAMETER_PER_RADIUS);
  return { canvas: factory.create(size, size), centre: size * HALF };
}

/** A bake plus its full width in radii of the body it decorates, so a layer scales it by that radius. */
export interface BakedSprite {
  readonly canvas: BakeCanvas;
  readonly widthRadii: number;
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

export interface EllipseSpec {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotation: number;
}

function discPath(context: BakeContext2D, disc: DiscSpec): void {
  context.beginPath();
  context.arc(disc.x, disc.y, disc.radius, 0, RADIANS_PER_FULL_TURN);
}

function ellipsePath(context: BakeContext2D, ellipse: EllipseSpec): void {
  context.beginPath();
  context.ellipse(ellipse.x, ellipse.y, ellipse.radiusX, ellipse.radiusY, ellipse.rotation, 0, RADIANS_PER_FULL_TURN);
}

/** A radial gradient of `stops` filled over a disc; the one primitive behind every soft edge. */
export function fillRadial(context: BakeContext2D, disc: DiscSpec, stops: readonly RadialStop[]): void {
  const gradient = context.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, disc.radius);
  for (const stop of stops) gradient.addColorStop(stop.offset, hexWithAlpha(stop.colour, stop.alpha));
  context.fillStyle = gradient;
  discPath(context, disc);
  context.fill();
}

/** Stops that hold `alpha` out to `plateau` of the radius (none when 0) and fade to clear at the rim. */
function fadeToClearStops(paint: Paint, plateau: number): RadialStop[] {
  const centre = { offset: 0, colour: paint.colour, alpha: paint.alpha };
  const rim = { offset: 1, colour: paint.colour, alpha: 0 };
  return plateau > 0 ? [centre, { ...centre, offset: plateau }, rim] : [centre, rim];
}

/** A gradient from `alpha` at the centre to clear at the rim: the halo every glow is built from. */
export function fillHalo(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  fillRadial(context, disc, fadeToClearStops(paint, 0));
}

/** A soft-edged disc: flat to `1 − feather` of the radius, then to clear. */
export function fillSoftDisc(context: BakeContext2D, disc: DiscSpec, paint: Paint & { feather: number }): void {
  fillRadial(context, disc, fadeToClearStops(paint, 1 - paint.feather));
}

export function fillDisc(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  context.fillStyle = hexWithAlpha(paint.colour, paint.alpha);
  discPath(context, disc);
  context.fill();
}

export function strokeDisc(context: BakeContext2D, disc: DiscSpec, paint: StrokePaint): void {
  context.strokeStyle = hexWithAlpha(paint.colour, paint.alpha);
  context.lineWidth = paint.width;
  discPath(context, disc);
  context.stroke();
}

export function fillEllipse(context: BakeContext2D, ellipse: EllipseSpec, paint: Paint): void {
  context.fillStyle = hexWithAlpha(paint.colour, paint.alpha);
  ellipsePath(context, ellipse);
  context.fill();
}

export function strokeEllipse(context: BakeContext2D, ellipse: EllipseSpec, paint: StrokePaint): void {
  context.strokeStyle = hexWithAlpha(paint.colour, paint.alpha);
  context.lineWidth = paint.width;
  ellipsePath(context, ellipse);
  context.stroke();
}

export interface GlowLayers {
  /** Radii as multiples of the body radius. */
  readonly soft: number;
  readonly wide: number;
  readonly softAlpha: number;
  readonly wideAlpha: number;
}

/** Soft halo over wide halo (ASSET-GENERATION §1.5); the core is the body and the glint is the caller's. */
export function paintGlow(context: BakeContext2D, disc: DiscSpec, colour: string, layers: GlowLayers): void {
  fillHalo(context, { ...disc, radius: disc.radius * layers.wide }, { colour, alpha: layers.wideAlpha });
  fillHalo(context, { ...disc, radius: disc.radius * layers.soft }, { colour, alpha: layers.softAlpha });
}

/** The specular glint: a small ellipse toward the top-left of a body, leaning with the light (VISUAL-STYLE §1). */
export function paintGlint(context: BakeContext2D, disc: DiscSpec, paint: Paint): void {
  const offset = disc.radius * BAKE_GLINT.offsetShare;
  fillEllipse(
    context,
    {
      x: disc.x - offset,
      y: disc.y - offset,
      radiusX: disc.radius * BAKE_GLINT.lengthShare,
      radiusY: disc.radius * BAKE_GLINT.widthShare,
      rotation: RADIANS_PER_FULL_TURN * BAKE_GLINT.rotationTurns,
    },
    paint,
  );
}
