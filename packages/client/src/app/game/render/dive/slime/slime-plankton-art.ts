// The plankton's still layers (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `nauplius`, `ciliate` and
// `dino` less what moves): each body with what its clip holds, and the rim and glint drawn over the moving parts. The
// limbs, cilia, membranelles, vacuole and flagella move every frame and are stroked by the GPU
// (`slime-plankton-strokes.ts`); the halos are sprites of their own. Each is drawn in its own unit onto a sprite.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_LIGHT,
  CILIA,
  LIPID_BASE,
  LIPID_CENTRE,
  LIPID_LIGHT,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
} from '../../constants';
import { SLIME_BLOB_ROLL, SLIME_CILIATE, SLIME_DINO, SLIME_NAUPLIUS } from '../../constants/dive-slime-plankton';
import { HALF } from '../../geometry';
import type { ShoreContext2D } from '../shore/shore-canvas';
import { coordinateHash } from '../shore/shore-noise';
import { bodyGradient, drawGlint, drawGlow, lineWidth, rimGradient, unitsOfPx, type GlassPen } from './slime-glass';

/** A body's alpha: `base` plus `bright` of what the dark field has not yet taken. */
function bodyAlpha(look: { readonly alpha: number; readonly bright: number }, darkField: number): number {
  return look.alpha + look.bright * (1 - darkField);
}

/** The larva's shield of a body (`nauplius`'s `body`). */
function naupliusPath(context: ShoreContext2D): void {
  const { noseX, frontY, backX, backY, tailX, tailY, tipX } = SLIME_NAUPLIUS.body.shape;
  context.beginPath();
  context.moveTo(noseX, 0);
  context.bezierCurveTo(noseX, -frontY, backX, -backY, tailX, -tailY);
  context.lineTo(tipX, 0);
  context.lineTo(tailX, tailY);
  context.bezierCurveTo(backX, backY, noseX, frontY, noseX, 0);
  context.closePath();
}

/** Small round blobs scattered by a salt, each lit from the top-left (lipids, organelles). */
function drawBlobs(
  context: ShoreContext2D,
  blobs: { readonly count: number; readonly salt: number; readonly spreadX: number; readonly spreadY: number },
  radius: { readonly min: number; readonly span: number },
  colourOf: (blob: number) => { light: string; base: string; dark: string; alpha: number },
): void {
  for (let blob = 0; blob < blobs.count; blob += 1) {
    const x = (coordinateHash(blob, SLIME_BLOB_ROLL.x, blobs.salt) - HALF) * blobs.spreadX;
    const y = (coordinateHash(blob, SLIME_BLOB_ROLL.y, blobs.salt) - HALF) * blobs.spreadY;
    const size = radius.min + coordinateHash(blob, SLIME_BLOB_ROLL.radius, blobs.salt) * radius.span;
    context.fillStyle = bodyGradient(context, { x, y, radius: size }, colourOf(blob));
    context.beginPath();
    context.arc(x, y, size, 0, RADIANS_PER_FULL_TURN);
    context.fill();
  }
}

/** The larva's body, gut, lipids, rim, eye and glint: everything of it that does not move. */
export function drawNaupliusBody(pen: GlassPen, darkField: number): void {
  const { context, unitPx } = pen;
  const { body, gut, lipids, rim, eye, glint } = SLIME_NAUPLIUS;
  context.lineCap = 'round';
  naupliusPath(context);
  const [light, base, dark] = body.colours;
  const alpha = bodyAlpha(body, darkField);
  context.fillStyle = bodyGradient(context, { x: 0, y: 0, radius: body.radius }, { light, base, dark, alpha });
  context.fill();
  context.save();
  context.clip();
  context.fillStyle = gut.colour;
  context.beginPath();
  context.ellipse(gut.x, 0, gut.radiusX, gut.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  drawBlobs(context, lipids, lipids.radius, () => ({
    light: LIPID_LIGHT,
    base: LIPID_BASE,
    dark: LIPID_CENTRE,
    alpha: lipids.alpha,
  }));
  context.restore();
  naupliusPath(context);
  context.strokeStyle = rimGradient(context, { x: 0, y: 0, radius: body.radius }, rim.colours[0], rim.colours[1]);
  context.lineWidth = lineWidth(pen, rim.width);
  context.stroke();
  drawGlow(context, { x: eye.x, y: 0, radius: eye.haloRadius }, eye.haloColour, eye.haloAlpha);
  context.fillStyle = eye.colour;
  context.beginPath();
  context.arc(eye.x, 0, eye.radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  if (unitPx > glint.abovePx) drawGlint(context, glint.x, glint.y, Math.max(unitsOfPx(pen, glint.minPx), glint.radius));
}

function ciliateEllipse(context: ShoreContext2D): void {
  context.beginPath();
  context.ellipse(0, 0, HALF, SLIME_CILIATE.width * HALF, 0, 0, RADIANS_PER_FULL_TURN);
}

function ciliateInside(pen: GlassPen): void {
  const { context } = pen;
  const { width, nucleus, mouth, organelles } = SLIME_CILIATE;
  context.strokeStyle = nucleus.colour;
  context.lineWidth = lineWidth(pen, nucleus.width);
  context.setLineDash(nucleus.dash);
  context.beginPath();
  context.ellipse(
    nucleus.x,
    width * nucleus.y,
    nucleus.radiusX,
    width * nucleus.radiusY,
    0,
    Math.PI * nucleus.fromTurns,
    Math.PI * nucleus.toTurns,
  );
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = mouth.colour;
  context.lineWidth = lineWidth(pen, mouth.width);
  context.beginPath();
  context.arc(mouth.x, 0, mouth.radius, -mouth.reach, mouth.reach);
  context.stroke();
  drawBlobs(context, { ...organelles, spreadY: organelles.spreadY * width }, organelles.radius, (blob) => {
    const isGreen = blob % organelles.cycle === 1;
    return isGreen
      ? { light: CHLORO_LIGHT, base: CHLORO_BASE, dark: CHLORO_DARK, alpha: organelles.alpha }
      : { light: MITO_LIGHT, base: MITO_BASE, dark: MITO_DARK, alpha: organelles.alpha };
  });
}

/** The ciliate's body and what its clip holds, but not the vacuole, which pulses. */
export function drawCiliateBody(pen: GlassPen, darkField: number): void {
  const { context } = pen;
  const { body } = SLIME_CILIATE;
  ciliateEllipse(context);
  const [light, base, dark] = body.colours;
  context.fillStyle = bodyGradient(
    context,
    { x: 0, y: 0, radius: HALF },
    { light, base, dark, alpha: bodyAlpha(body, darkField) },
  );
  context.fill();
  context.save();
  context.clip();
  ciliateInside(pen);
  context.restore();
}

/** The ciliate's rim and glint, over its membranelles. */
export function drawCiliateRim(pen: GlassPen): void {
  const { context, unitPx } = pen;
  const { rimDark, rimWidth, glint, width } = SLIME_CILIATE;
  ciliateEllipse(context);
  context.strokeStyle = rimGradient(context, { x: 0, y: 0, radius: HALF }, CILIA, rimDark);
  context.lineWidth = lineWidth(pen, rimWidth);
  context.stroke();
  if (unitPx > glint.abovePx) {
    drawGlint(context, glint.x, glint.y * width, Math.max(unitsOfPx(pen, glint.minPx), glint.radius));
  }
}

function dinoShellPath(context: ShoreContext2D): void {
  const { noseX, frontX, frontY, backX, backY, tailX, tailY, tipX, tipY } = SLIME_DINO.shell.shape;
  context.beginPath();
  context.moveTo(noseX, 0);
  context.bezierCurveTo(frontX, -frontY, backX, -backY, tailX, tailY);
  context.lineTo(tipX, tipY);
  context.bezierCurveTo(backX, backY, frontX, frontY, noseX, 0);
  context.closePath();
}

function dinoPlates(pen: GlassPen): void {
  const { context } = pen;
  const { plates, blots } = SLIME_DINO;
  context.strokeStyle = plates.colour;
  context.lineWidth = lineWidth(pen, plates.width);
  for (let plate = 0; plate < plates.count; plate += 1) {
    const turn = (plate / plates.count) * RADIANS_PER_FULL_TURN;
    context.beginPath();
    context.moveTo(Math.cos(turn) * plates.inner, Math.sin(turn) * plates.inner);
    context.lineTo(Math.cos(turn + plates.twist) * plates.outer, Math.sin(turn + plates.twist) * plates.outer);
    context.stroke();
  }
  for (let blot = 0; blot < blots.count; blot += 1) {
    const x = (coordinateHash(blot, SLIME_BLOB_ROLL.x, blots.salt) - HALF) * blots.spreadX;
    const y = (coordinateHash(blot, SLIME_BLOB_ROLL.y, blots.salt) - HALF) * blots.spreadY;
    context.fillStyle = blots.colour;
    context.beginPath();
    context.ellipse(x, y, blots.radiusX, blots.radiusY, blot, 0, RADIANS_PER_FULL_TURN);
    context.fill();
  }
}

/** The dinoflagellate's shell, its plates and the girdle: everything under its girdle's flagellum. */
export function drawDinoBody(pen: GlassPen, darkField: number): void {
  const { context, unitPx } = pen;
  const { shell, platesAbovePx, girdle } = SLIME_DINO;
  dinoShellPath(context);
  const [light, base, dark] = shell.colours;
  context.fillStyle = bodyGradient(
    context,
    { x: 0, y: 0, radius: HALF },
    { light, base, dark, alpha: bodyAlpha(shell, darkField) },
  );
  context.fill();
  context.save();
  context.clip();
  if (unitPx > platesAbovePx) dinoPlates(pen);
  context.restore();
  context.strokeStyle = girdle.colour;
  context.lineWidth = lineWidth(pen, girdle.width);
  context.beginPath();
  context.moveTo(girdle.x, -girdle.reach);
  context.quadraticCurveTo(girdle.controlX, 0, girdle.x, girdle.reach);
  context.stroke();
}

/** The dinoflagellate's rim and glint, over its girdle's flagellum. */
export function drawDinoRim(pen: GlassPen): void {
  const { context, unitPx } = pen;
  const { rimWidth, glint } = SLIME_DINO;
  dinoShellPath(context);
  context.strokeStyle = rimGradient(context, { x: 0, y: 0, radius: HALF }, MITO_LIGHT, MITO_DARK);
  context.lineWidth = lineWidth(pen, rimWidth);
  context.stroke();
  if (unitPx > glint.abovePx) drawGlint(context, glint.x, glint.y, Math.max(unitsOfPx(pen, glint.minPx), glint.radius));
}
