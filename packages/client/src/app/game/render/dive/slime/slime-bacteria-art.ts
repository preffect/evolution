// The bacteria's and food specks' sprites (docs/rendering/opening-dive.md §4, ticket #803, the mockup's `stadium`,
// `rodArt`, `rodSprite` and `moteSprite`): a rod in the middle of its own `256 × 160` px cell of the atlas — halo,
// translucent body, bands, inner edge, rim and glint — and a speck in a `96` px cell, algae green or a lipid's gold.
// The shader that lays them stretches each to its own size (`slime-shader-bacteria.ts`).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../../colour';
import { WHITE } from '../../constants';
import {
  SLIME_MOTE_SPRITE,
  SLIME_ROD_SPRITE,
  type SlimeMoteKind,
  type SlimeRodKind,
} from '../../constants/dive-slime-bacteria';
import { HALF } from '../../geometry';
import type { ShoreContext2D } from '../shore/shore-canvas';
import { drawGlow, fillWhiteDisc } from './slime-glass';

/** A rod's outline round the origin, `length` long and `width` wide (`stadium`). */
export function stadiumPath(context: ShoreContext2D, length: number, width: number): void {
  const radius = width * HALF;
  const straight = length * HALF - radius;
  const quarter = Math.PI * HALF;
  context.beginPath();
  context.moveTo(-straight, -radius);
  context.lineTo(straight, -radius);
  context.arc(straight, 0, radius, -quarter, quarter);
  context.lineTo(-straight, radius);
  context.arc(-straight, 0, radius, quarter, Math.PI + quarter);
  context.closePath();
}

function rodHalo(context: ShoreContext2D, kind: SlimeRodKind): void {
  const { length, width, halo } = SLIME_ROD_SPRITE;
  context.save();
  context.scale(length * halo.reachX, width * halo.reachY);
  drawGlow(context, { x: 0, y: 0, radius: 1 }, kind.halo, kind.haloAlpha);
  context.restore();
}

function rodBody(context: ShoreContext2D, kind: SlimeRodKind): void {
  const { length, width, body } = SLIME_ROD_SPRITE;
  const radius = width * HALF;
  const gradient = context.createRadialGradient(
    length * body.fromX,
    radius * body.fromY,
    radius * body.fromRadius,
    length * body.toX,
    radius * body.toY,
    length * body.toRadius,
  );
  gradient.addColorStop(0, hexWithAlpha(kind.rim, kind.alpha));
  gradient.addColorStop(body.stop, hexWithAlpha(kind.body, kind.alpha));
  gradient.addColorStop(1, hexWithAlpha(kind.body, kind.alpha * body.edgeAlpha));
  context.fillStyle = gradient;
  context.fill();
}

function rodBands(context: ShoreContext2D, bands: string): void {
  const { length, width, bands: look } = SLIME_ROD_SPRITE;
  context.save();
  context.clip();
  context.fillStyle = hexWithAlpha(bands, look.alpha);
  for (const along of look.at) {
    context.fillRect(along * length - width * look.width * HALF, -width * HALF, width * look.width, width);
  }
  context.restore();
  stadiumPath(context, length, width);
}

function rodEdges(context: ShoreContext2D, kind: SlimeRodKind): void {
  const { length, width, innerEdge, rim } = SLIME_ROD_SPRITE;
  const radius = width * HALF;
  context.strokeStyle = hexWithAlpha(kind.body, innerEdge.alpha);
  context.lineWidth = width * innerEdge.width;
  context.save();
  context.clip();
  context.stroke();
  context.restore();
  const gradient = context.createLinearGradient(-length * HALF, -radius, length * HALF, radius);
  gradient.addColorStop(0, WHITE);
  gradient.addColorStop(rim.stops[0], kind.rim);
  gradient.addColorStop(rim.stops[1], kind.body);
  gradient.addColorStop(1, kind.rim);
  context.strokeStyle = gradient;
  context.lineWidth = width * rim.width;
  context.stroke();
}

function rodGlint(context: ShoreContext2D): void {
  const { length, width, glint } = SLIME_ROD_SPRITE;
  const x = length * glint.x;
  const y = width * HALF * glint.y;
  fillWhiteDisc(context, { x, y, radius: width * glint.radius }, [
    [0, glint.alpha],
    [1, 0],
  ]);
}

/** One rod round the origin of `context`, in the sprite's px (`rodArt` at the sprite's size, its glow full). */
export function drawRod(context: ShoreContext2D, kind: SlimeRodKind): void {
  const { length, width } = SLIME_ROD_SPRITE;
  rodHalo(context, kind);
  stadiumPath(context, length, width);
  rodBody(context, kind);
  if (kind.bands !== null) rodBands(context, kind.bands);
  rodEdges(context, kind);
  rodGlint(context);
}

/** One food speck round the origin of `context`, in the sprite's px (`moteSprite`). */
export function drawMote(context: ShoreContext2D, kind: SlimeMoteKind): void {
  const { size, bodyShare, halo, body, lipid, rimWidthPx, glint } = SLIME_MOTE_SPRITE;
  const centre = size * HALF;
  const radius = size * bodyShare;
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, centre);
  glow.addColorStop(0, hexWithAlpha(kind.core, halo.alpha));
  glow.addColorStop(halo.middleStop, hexWithAlpha(kind.core, halo.middleAlpha));
  glow.addColorStop(1, hexWithAlpha(kind.core, 0));
  context.fillStyle = glow;
  context.fillRect(-centre, -centre, size, size);
  const light = -radius * body.lightOffset;
  const gradient = context.createRadialGradient(light, light, radius * body.core, 0, 0, radius);
  gradient.addColorStop(0, kind.rim);
  gradient.addColorStop(body.stop, kind.core);
  gradient.addColorStop(1, kind.edge);
  context.fillStyle = gradient;
  context.beginPath();
  if (kind.isLipid)
    context.ellipse(0, 0, radius * lipid.radiusX, radius * lipid.radiusY, lipid.turn, 0, RADIANS_PER_FULL_TURN);
  else context.arc(0, 0, radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  context.strokeStyle = kind.rim;
  context.lineWidth = rimWidthPx;
  context.stroke();
  context.fillStyle = hexWithAlpha(WHITE, glint.alpha);
  context.beginPath();
  context.arc(-radius * glint.offset, -radius * glint.offset, radius * glint.radius, 0, RADIANS_PER_FULL_TURN);
  context.fill();
}
