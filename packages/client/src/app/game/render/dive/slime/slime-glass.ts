// The game-style glass the slime's plankton and diatoms are drawn in (docs/rendering/opening-dive.md §4, ticket #803,
// the mockup's `rimGrad`, `bodyGrad`, `halo`, `glint`, `lw` and `pxu`): a translucent body lit from the top-left, a
// scattering rim, a soft halo and a glint. Every object is drawn in its own unit (its length is 1) onto a sprite whose
// scale is `unitPx` css px to the unit, so a line never gets thinner than the mockup's 1.1 css px.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../../colour';
import { DIAMETER_PER_RADIUS } from '../../geometry';
import { WHITE } from '../../constants';
import { SLIME_GLOW } from '../../constants/dive-slime';
import { SLIME_GLASS, SLIME_LINE_MIN_PX } from '../../constants/dive-slime-diatoms';
import type { BakeGradient } from '../../textures/texture-bake';
import type { ShoreContext2D } from '../shore/shore-canvas';

/** A context drawing in an object's unit, `unitPx` css px to the unit (the object's length on screen). */
export interface GlassPen {
  readonly context: ShoreContext2D;
  readonly unitPx: number;
}

/** How big an object is on screen: `unitPx` css px to its unit. */
export type UnitScale = Pick<GlassPen, 'unitPx'>;

/** `px` css px in the object's unit (`pxu`). */
export function unitsOfPx(pen: UnitScale, cssPx: number): number {
  return cssPx / pen.unitPx;
}

/** A stroke `width` units wide, never under the thinnest line (`lw`). */
export function lineWidth(pen: UnitScale, width: number): number {
  return Math.max(unitsOfPx(pen, SLIME_LINE_MIN_PX), width);
}

/** The rim's light across the object, white at the top-left (`rimGrad`). */
export function rimGradient(
  context: ShoreContext2D,
  centre: { readonly x: number; readonly y: number; readonly radius: number },
  rim: string,
  base: string,
): BakeGradient {
  const { x, y, radius } = centre;
  const stops = SLIME_GLASS.rim.stops;
  const gradient = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  gradient.addColorStop(stops[0], WHITE);
  gradient.addColorStop(stops[1], rim);
  gradient.addColorStop(stops[2], base);
  gradient.addColorStop(stops[3], rim);
  return gradient;
}

/** A body's colours: its light, base and dark, at an alpha. */
export interface BodyColours {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
  readonly alpha: number;
}

/** A translucent body lit from the top-left (`bodyGrad`). */
export function bodyGradient(
  context: ShoreContext2D,
  centre: { readonly x: number; readonly y: number; readonly radius: number },
  colours: BodyColours,
): BakeGradient {
  const { x, y, radius } = centre;
  const body = SLIME_GLASS.body;
  const gradient = context.createRadialGradient(
    x + radius * body.lightX,
    y + radius * body.lightY,
    radius * body.core,
    x + radius * body.farX,
    y + radius * body.farY,
    radius * body.reach,
  );
  gradient.addColorStop(0, hexWithAlpha(colours.light, colours.alpha));
  gradient.addColorStop(body.stop, hexWithAlpha(colours.base, colours.alpha));
  gradient.addColorStop(1, hexWithAlpha(colours.dark, colours.alpha * body.darkAlpha));
  return gradient;
}

/** A white glint (`glint`). */
export function drawGlint(context: ShoreContext2D, x: number, y: number, radius: number): void {
  const { stops, alphas } = SLIME_GLASS.glint;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(stops[0], hexWithAlpha(WHITE, alphas[0]));
  gradient.addColorStop(stops[1], hexWithAlpha(WHITE, alphas[1]));
  gradient.addColorStop(stops[2], hexWithAlpha(WHITE, alphas[2]));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

/** A soft round glow of `colour` (`halo`, the mockup's `glowSprite` drawn at `alpha`). */
export function drawGlow(
  context: ShoreContext2D,
  centre: { readonly x: number; readonly y: number; readonly radius: number },
  colour: string,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const { x, y, radius } = centre;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, hexWithAlpha(colour, alpha));
  gradient.addColorStop(SLIME_GLOW.middleStop, hexWithAlpha(colour, alpha * SLIME_GLOW.middleAlpha));
  gradient.addColorStop(1, hexWithAlpha(colour, 0));
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * DIAMETER_PER_RADIUS, radius * DIAMETER_PER_RADIUS);
}
