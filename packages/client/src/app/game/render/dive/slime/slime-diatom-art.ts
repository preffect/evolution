// The diatoms' pictures (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `lanceolate`, `pennate`,
// `cocconeis`, `licmophora` and `diatomSprite`), each drawn in its own unit onto a sprite: the glass box, plastids,
// striae, raphe, rim and glint, with each detail switched on at the size the mockup gave it. The halo round each is
// drawn by the shader that lays the sprites (`slime-shader-scatter.ts`), so a sprite holds only the diatom itself.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../../colour';
import { DIATOM_PLASTID_DARK, DIATOM_PLASTID_LIGHT, SILICA_BASE, SILICA_DARK, SILICA_LIGHT } from '../../constants';
import {
  SLIME_COCCONEIS,
  SLIME_DIATOM_BROWN,
  SLIME_LANCEOLATE,
  SLIME_LICMOPHORA,
  SLIME_PENNATE,
} from '../../constants/dive-slime-diatoms';
import { HALF } from '../../geometry';
import type { ShoreContext2D } from '../shore/shore-canvas';
import { bodyGradient, drawGlint, lineWidth, rimGradient, unitsOfPx, type GlassPen } from './slime-glass';

const RIM_RADIUS = HALF;

/** A boat-shaped outline `length` long and `width` wide round the origin (`lanceolate`). */
export function lanceolatePath(context: ShoreContext2D, length: number, width: number): void {
  const { points, power } = SLIME_LANCEOLATE;
  const halfWidth = (along: number): number => width * HALF * Math.pow(1 - along * along, power);
  context.beginPath();
  for (let point = 0; point <= points; point += 1) {
    const along = (point / points - HALF) / HALF;
    if (point === 0) context.moveTo(along * length * HALF, -halfWidth(along));
    else context.lineTo(along * length * HALF, -halfWidth(along));
  }
  for (let point = points; point >= 0; point -= 1) {
    const along = (point / points - HALF) / HALF;
    context.lineTo(along * length * HALF, halfWidth(along));
  }
  context.closePath();
}

function silicaRim(pen: GlassPen, width: number): void {
  pen.context.strokeStyle = rimGradient(pen.context, { x: 0, y: 0, radius: RIM_RADIUS }, SILICA_LIGHT, SILICA_DARK);
  pen.context.lineWidth = lineWidth(pen, width);
  pen.context.stroke();
}

function pennatePlastids(pen: GlassPen): void {
  const { context } = pen;
  const { offset, radiusX, radiusY, lightRadius, alpha } = SLIME_PENNATE.plastids;
  const width = SLIME_PENNATE.width;
  for (const side of [-1, 1]) {
    const y = side * width * offset;
    context.beginPath();
    context.ellipse(0, y, radiusX, width * radiusY, 0, 0, RADIANS_PER_FULL_TURN);
    context.fillStyle = bodyGradient(
      context,
      { x: 0, y, radius: lightRadius },
      { light: DIATOM_PLASTID_LIGHT, base: SLIME_DIATOM_BROWN.pennate, dark: DIATOM_PLASTID_DARK, alpha },
    );
    context.fill();
  }
}

function pennateStriae(pen: GlassPen, darkField: number): void {
  const { context } = pen;
  const { spacing, half, skipWithin, width, base, darkField: dark } = SLIME_PENNATE.striae;
  const boxWidth = SLIME_PENNATE.width;
  context.save();
  lanceolatePath(context, 1, boxWidth);
  context.clip();
  context.strokeStyle = hexWithAlpha(SILICA_LIGHT, base + dark * darkField);
  context.lineWidth = lineWidth(pen, spacing * width);
  context.beginPath();
  for (let stria = -half; stria <= half; stria += 1) {
    if (Math.abs(stria) < skipWithin) continue;
    context.moveTo(stria * spacing, -boxWidth * HALF);
    context.lineTo(stria * spacing, boxWidth * HALF);
  }
  context.stroke();
  context.restore();
}

function pennateRaphe(pen: GlassPen): void {
  const { context } = pen;
  const { from, to, width, alpha, node } = SLIME_PENNATE.raphe;
  context.strokeStyle = hexWithAlpha(SILICA_LIGHT, alpha);
  context.lineWidth = lineWidth(pen, width);
  context.beginPath();
  context.moveTo(-to, 0);
  context.lineTo(-from, 0);
  context.moveTo(from, 0);
  context.lineTo(to, 0);
  context.stroke();
  context.fillStyle = hexWithAlpha(SILICA_LIGHT, SLIME_PENNATE.nodeAlpha);
  context.beginPath();
  context.ellipse(0, 0, node.radiusX, SLIME_PENNATE.width * node.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}

/** A boat-shaped diatom without its halo (`pennate`): `darkField` is the dark field's weight. */
export function drawPennate(pen: GlassPen, darkField: number): void {
  const { context, unitPx } = pen;
  const look = SLIME_PENNATE;
  lanceolatePath(context, 1, look.width);
  context.fillStyle = hexWithAlpha(SILICA_BASE, look.fill.base + look.fill.darkField * darkField);
  context.fill();
  if (unitPx > look.plastids.abovePx) pennatePlastids(pen);
  if (look.striae.spacing * unitPx > look.striae.abovePx) pennateStriae(pen, darkField);
  if (unitPx > look.raphe.abovePx) pennateRaphe(pen);
  lanceolatePath(context, 1, look.width);
  silicaRim(pen, look.rimWidth);
  const glint = look.glint;
  if (unitPx > glint.abovePx) {
    drawGlint(context, glint.x, glint.y * look.width, Math.max(unitsOfPx(pen, glint.minPx), glint.radius));
  }
}

function cocconeisDetail(pen: GlassPen): void {
  const { context } = pen;
  const { radiusX, radiusY, rays, raphe } = SLIME_COCCONEIS;
  context.save();
  context.clip();
  context.strokeStyle = hexWithAlpha(SILICA_LIGHT, rays.alpha);
  context.lineWidth = lineWidth(pen, rays.width);
  context.beginPath();
  for (let ray = 0; ray < rays.count; ray += 1) {
    const turn = (ray / rays.count) * RADIANS_PER_FULL_TURN;
    context.moveTo(Math.cos(turn) * rays.innerX, Math.sin(turn) * rays.innerY);
    context.lineTo(Math.cos(turn) * radiusX, Math.sin(turn) * radiusY);
  }
  context.stroke();
  context.restore();
  context.strokeStyle = hexWithAlpha(SILICA_LIGHT, raphe.alpha);
  context.lineWidth = lineWidth(pen, raphe.width);
  context.beginPath();
  context.moveTo(-raphe.half, 0);
  context.lineTo(raphe.half, 0);
  context.stroke();
}

/** Cocconeis without its halo (`cocconeis`). */
export function drawCocconeis(pen: GlassPen, darkField: number): void {
  const { context, unitPx } = pen;
  const look = SLIME_COCCONEIS;
  context.beginPath();
  context.ellipse(0, 0, look.radiusX, look.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  context.fillStyle = bodyGradient(
    context,
    { x: 0, y: 0, radius: look.radiusX },
    {
      light: DIATOM_PLASTID_LIGHT,
      base: SLIME_DIATOM_BROWN.other,
      dark: DIATOM_PLASTID_DARK,
      alpha: look.body.base + look.body.bright * (1 - darkField),
    },
  );
  context.fill();
  if (unitPx > look.detailAbovePx) cocconeisDetail(pen);
  context.beginPath();
  context.ellipse(0, 0, look.radiusX, look.radiusY, 0, 0, RADIANS_PER_FULL_TURN);
  silicaRim(pen, look.rimWidth);
  const glint = look.glint;
  if (unitPx > glint.abovePx) drawGlint(context, glint.x, glint.y, Math.max(unitsOfPx(pen, glint.minPx), glint.radius));
}

/** One of licmophora's wedges along +x from the stalk's end. */
function wedgePath(context: ShoreContext2D): void {
  const { root, tip, bulge } = SLIME_LICMOPHORA.wedges;
  context.beginPath();
  context.moveTo(0, -root);
  context.lineTo(1, -tip);
  context.quadraticCurveTo(bulge, 0, 1, tip);
  context.lineTo(0, root);
  context.closePath();
}

/** Licmophora's fan on its stalk, still (`licmophora`; its sway turns the sprite). */
export function drawLicmophora(pen: GlassPen): void {
  const { context } = pen;
  const { stalk, wedges } = SLIME_LICMOPHORA;
  context.strokeStyle = hexWithAlpha(SILICA_BASE, stalk.alpha);
  context.lineWidth = lineWidth(pen, stalk.width);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(-stalk.length, 0);
  context.stroke();
  const middle = (wedges.count - 1) * HALF;
  for (let wedge = 0; wedge < wedges.count; wedge += 1) {
    context.save();
    context.rotate((wedge - middle) * wedges.spread);
    wedgePath(context);
    context.fillStyle = bodyGradient(
      context,
      { x: HALF, y: 0, radius: HALF },
      { light: DIATOM_PLASTID_LIGHT, base: SLIME_DIATOM_BROWN.other, dark: DIATOM_PLASTID_DARK, alpha: wedges.alpha },
    );
    context.fill();
    context.strokeStyle = rimGradient(context, { x: HALF, y: 0, radius: HALF }, SILICA_LIGHT, SILICA_DARK);
    context.lineWidth = lineWidth(pen, SLIME_LICMOPHORA.rimWidth);
    context.stroke();
    context.restore();
  }
}
