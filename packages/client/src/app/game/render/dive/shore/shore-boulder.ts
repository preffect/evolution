// One boulder (docs/rendering/opening-dive.md §4, ticket #801, the mockup's `boulder`): a soft contact shadow to the
// bottom-right, a stone of dark greenstone or pale diorite lit from the top-left, wet low on the shore; close up its
// grain and joints, its zone cover by height (a weed skirt low down, pink crust at the foot, lichen high up), its
// volume and sheen, a rim light, and at the waterline a foam collar and the part under the sea seen through it.

import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexWithAlpha } from '../../colour';
import { smoothstep } from '../../geometry';
import { drawBoulderSurface } from './shore-boulder-surface';
import { coordinateHash } from './shore-noise';
import { isInView, paintTrue, pxToMetres, seaPath, type ShorePaint } from './shore-paint';
import { rockPath, type BlobPlace } from './shore-shapes';
import { fillViewPattern, viewRect } from './shore-zone-fill';

/** A boulder: where it sits, its seed, and how far up the shore it lies (metres from the waterline, + land). */
export interface Boulder {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly seed: number;
  readonly heightM: number;
}

/** The stone's outline place: its squash comes from its seed. */
export function boulderPlace(boulder: Boulder): BlobPlace {
  const squash = SHORE_BOULDER.squash;
  return {
    x: boulder.x,
    y: boulder.y,
    radius: boulder.radius,
    seed: boulder.seed,
    squash: squash.base + coordinateHash(boulder.seed, squash.saltIndex, squash.salt) * squash.span,
  };
}

function isGreenstone(seed: number): boolean {
  const green = SHORE_BOULDER.greenstone;
  return seed === green.focalSeed || coordinateHash(seed, green.saltIndex, green.salt) < green.below;
}

function drawBody(paint: ShorePaint, place: BlobPlace, wet: number): void {
  const boulder = SHORE_BOULDER;
  const body = boulder.body;
  const context = paint.context;
  const { x, y, radius } = place;
  for (const shadow of boulder.contactShadows) {
    rockPath(context, { ...place, x: x + radius * shadow.x, y: y + radius * shadow.y, radius: radius * shadow.radius });
    context.fillStyle = shadow.colour;
    context.fill();
  }
  rockPath(context, place);
  const ramp = isGreenstone(place.seed) ? boulder.greenRamp : boulder.paleRamp;
  const gradient = context.createRadialGradient(
    x + radius * body.lightX,
    y + radius * body.lightY,
    radius * body.core,
    x + radius * body.centreX,
    y + radius * body.centreY,
    radius * body.outer,
  );
  gradient.addColorStop(0, ramp[0]);
  gradient.addColorStop(body.middleStop, ramp[1]);
  gradient.addColorStop(1, ramp[2]);
  context.fillStyle = gradient;
  context.fill();
  if (wet > 0) {
    context.fillStyle = `rgba(${boulder.wet.colour},${boulder.wet.alpha * wet})`;
    context.fill();
  }
}

function drawRimLight(paint: ShorePaint, place: BlobPlace): void {
  const rim = SHORE_BOULDER.rimLight;
  const context = paint.context;
  const { x, y, radius } = place;
  rockPath(context, place);
  context.save();
  context.clip();
  const gradient = context.createLinearGradient(x - radius, y - radius, x + radius * rim.to, y + radius * rim.to);
  gradient.addColorStop(0, rim.colour);
  gradient.addColorStop(1, rim.clear);
  context.strokeStyle = gradient;
  context.lineWidth = Math.max(pxToMetres(paint.view, rim.minPx), radius * rim.width);
  context.stroke();
  context.restore();
}

/** The sun's caustics on the stone under the water, inside its outline (the current path). */
function drawUnderwaterLight(paint: ShorePaint, place: BlobPlace): void {
  const caustic = SHORE_BOULDER.waterline.caustic;
  const { context } = paint;
  const time = paint.view.timeSeconds;
  const reach = place.radius * caustic.reach;
  const rect = viewRect(paint, [place.x - reach, place.y - reach, place.x + reach, place.y + reach]);
  if (rect === null) return;
  context.save();
  context.clip();
  fillViewPattern(paint, 'caustic', {
    tileM: caustic.tileM,
    alpha: caustic.alpha,
    turn: caustic.turn,
    offsetM: [time * caustic.driftX, time * caustic.driftY],
    operation: 'lighter',
    rect,
  });
  context.restore();
}

/** In the water: the part of the stone below the waterline seen through the sea, and a foam collar. */
function drawWaterline(paint: ShorePaint, place: BlobPlace): void {
  const waterline = SHORE_BOULDER.waterline;
  const context = paint.context;
  const { radius } = place;
  const time = paint.view.timeSeconds;
  context.save();
  seaPath(paint);
  context.clip('evenodd');
  rockPath(context, place);
  context.fillStyle = waterline.underwater;
  context.fill();
  drawUnderwaterLight(paint, place);
  rockPath(context, { ...place, radius: radius * waterline.collar.radius });
  context.lineWidth = radius * waterline.collar.width;
  context.strokeStyle = hexWithAlpha(SHORE_PALETTE.foam, waterline.collar.alpha);
  context.stroke();
  const foam = waterline.foam;
  rockPath(context, { ...place, radius: radius * foam.radius });
  context.lineWidth = Math.max(pxToMetres(paint.view, foam.minPx), Math.min(radius * foam.width, foam.maxM));
  paintTrue(paint, 'foam', {
    tileM: foam.tileM,
    alpha: foam.alpha + foam.flicker * Math.sin(time * foam.rate + place.seed),
    isStroke: true,
  });
  context.restore();
}

/** One boulder (`boulder(x, y, r, seed, d)`); `isClose` is the focal rock's close detail (`detail > 1`). */
export function drawBoulder(paint: ShorePaint, boulder: Boulder, isClose = false): void {
  const scale = paint.view.screenPixelsPerMetre;
  if (
    !isInView(paint.view, boulder, boulder.radius * SHORE_BOULDER.visibleRadii) ||
    boulder.radius * scale < SHORE_BOULDER.minRadiusPx
  )
    return;
  const place = boulderPlace(boulder);
  const wet = smoothstep(SHORE_BOULDER.wet.fromM, SHORE_BOULDER.wet.toM, boulder.heightM);
  drawBody(paint, place, wet);
  if (boulder.radius * scale > SHORE_BOULDER.detailFromPx) {
    drawBoulderSurface(paint, {
      place,
      heightM: boulder.heightM,
      wet,
      isGreenstone: isGreenstone(boulder.seed),
      isClose,
    });
  }
  drawRimLight(paint, place);
  if (boulder.heightM < SHORE_BOULDER.waterline.belowM || isClose) drawWaterline(paint, place);
}
