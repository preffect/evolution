// A boulder's surface close up (docs/rendering/opening-dive.md §4, ticket #801, the inside of the mockup's `boulder`
// past 14 px): its grain at every scale, a few joints, the zone cover by height up the shore, lichen high up, then its
// volume (a dark pool low-right), a soft light pool and, when wet, a sheen. All inside the stone's clip.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { SHORE_PALETTE } from '../../constants/dive-shore-tiles';
import { hexWithAlpha } from '../../colour';
import { DIAMETER_PER_RADIUS, HALF } from '../../geometry';
import { coordinateHash, valueNoise } from './shore-noise';
import { fillOctaves, pxToMetres, type ShorePaint } from './shore-paint';
import { rockPath, type BlobPlace } from './shore-shapes';
import { zoneFill, type WorldBox } from './shore-zone-fill';

export interface BoulderSurface {
  readonly place: BlobPlace;
  readonly heightM: number;
  readonly wet: number;
  readonly isGreenstone: boolean;
  /** The focal rock's close detail: barnacles on the stone, and the near tiles in its cover. */
  readonly isClose: boolean;
}

function drawGrain(paint: ShorePaint, surface: BoulderSurface): void {
  const { rock, grain } = SHORE_BOULDER;
  const radius = surface.place.radius;
  const context = paint.context;
  if (surface.isGreenstone) context.globalCompositeOperation = 'overlay';
  fillOctaves(paint, 'rock', {
    tileM: radius * rock.tileRadii,
    alpha: surface.isGreenstone ? rock.greenAlpha : rock.paleAlpha,
    targetPx: rock.targetPx,
  });
  context.globalCompositeOperation = 'source-over';
  // crystals: dark mafic grains and pale feldspar, fine at every scale
  fillOctaves(paint, 'grain', {
    tileM: radius * grain.tileRadii,
    alpha: surface.isGreenstone ? grain.greenAlpha : grain.paleAlpha,
    targetPx: grain.targetPx,
  });
}

/** Joints: a few fractures across the stone, dark with a lit lower lip. */
function drawJoints(paint: ShorePaint, place: BlobPlace): void {
  const joints = SHORE_BOULDER.joints;
  const context = paint.context;
  const { x, y, radius, seed, squash } = place;
  for (let joint = 0; joint < joints.count; joint += 1) {
    const angle = coordinateHash(seed, joint, joints.salts.angle) * Math.PI;
    const startX = x + (coordinateHash(seed, joint, joints.salts.x) - HALF) * radius;
    const startY = y + (coordinateHash(seed, joint, joints.salts.y) - HALF) * radius * squash;
    const length = radius * (joints.length.min + coordinateHash(seed, joint, joints.salts.length) * joints.length.span);
    context.beginPath();
    const steps = Math.round(DIAMETER_PER_RADIUS / joints.step);
    for (let step = 0; step <= steps; step += 1) {
      const along = -1 + step * joints.step;
      const wander =
        (valueNoise(along * joints.wanderScale + joint * joints.wanderPerJoint, seed, joints.salts.wander) - HALF) *
        radius *
        joints.wander;
      const pointX = startX + Math.cos(angle) * along * length - Math.sin(angle) * wander;
      const pointY = startY + Math.sin(angle) * along * length + Math.cos(angle) * wander;
      if (step === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.strokeStyle = joints.colour;
    context.lineWidth = Math.max(pxToMetres(paint.view, joints.minPx), radius * joints.width);
    context.stroke();
  }
}

/** The zone cover by height: a weed skirt low down, pink crust at the foot, each an ellipse in the stone's box. */
function drawCover(paint: ShorePaint, surface: BoulderSurface): void {
  const { rockweed, lowzone, coverBox } = SHORE_BOULDER;
  const context = paint.context;
  const { x, y, radius, squash } = surface.place;
  const reach = radius * coverBox;
  const box: WorldBox = [x - reach, y - reach, x + reach, y + reach];
  if (surface.heightM < rockweed.belowM) {
    context.beginPath();
    context.ellipse(
      x + radius * rockweed.x,
      y + radius * rockweed.y,
      radius * rockweed.radiusX,
      radius * rockweed.radiusY * squash,
      0,
      0,
      RADIANS_PER_FULL_TURN,
    );
    zoneFill(paint, 'rockweed', { alpha: rockweed.alpha, isNear: surface.isClose, box });
  }
  if (surface.heightM < lowzone.belowM) {
    context.beginPath();
    context.ellipse(
      x,
      y + radius * lowzone.y,
      radius * lowzone.radiusX,
      radius * lowzone.radiusY,
      0,
      0,
      RADIANS_PER_FULL_TURN,
    );
    zoneFill(paint, 'lowzone', { alpha: lowzone.alpha, isNear: surface.isClose, box });
  }
}

function drawLichens(paint: ShorePaint, place: BlobPlace): void {
  const lichens = SHORE_BOULDER.lichens;
  const context = paint.context;
  const { x, y, radius, seed, squash } = place;
  for (let lichen = 0; lichen < lichens.count; lichen += 1) {
    const angle = coordinateHash(seed, lichen, lichens.salts.angle) * RADIANS_PER_FULL_TURN;
    const reach = radius * (lichens.reach.min + coordinateHash(seed, lichen, lichens.salts.reach) * lichens.reach.span);
    const size =
      radius * (lichens.radius.min + coordinateHash(seed, lichen, lichens.salts.radius) * lichens.radius.span);
    const isGrey = lichen % lichens.greyEvery === 0;
    context.fillStyle = isGrey
      ? hexWithAlpha(SHORE_PALETTE.lichenGrey, lichens.greyAlpha)
      : hexWithAlpha(SHORE_PALETTE.lichenOrange, lichens.orangeAlpha);
    context.beginPath();
    context.ellipse(
      x + Math.cos(angle) * reach,
      y + Math.sin(angle) * reach * squash - radius * lichens.lift,
      size,
      size * lichens.squash,
      angle,
      0,
      RADIANS_PER_FULL_TURN,
    );
    context.fill();
  }
}

/** Volume: a dark pool low-right, a soft light pool top-left, and the wet sheen. */
function drawVolume(paint: ShorePaint, place: BlobPlace, wet: number): void {
  const { volume, lightPool, sheen } = SHORE_BOULDER;
  const context = paint.context;
  const { x, y, radius } = place;
  rockPath(context, place);
  const shade = context.createRadialGradient(
    x + radius * volume.lightX,
    y + radius * volume.lightY,
    radius * volume.inner,
    x,
    y,
    radius * volume.outer,
  );
  shade.addColorStop(0, volume.stops[0]);
  shade.addColorStop(volume.middleStop, volume.stops[1]);
  shade.addColorStop(1, volume.stops[2]);
  context.fillStyle = shade;
  context.fill();
  const lightX = x + radius * lightPool.x;
  const lightY = y + radius * lightPool.y;
  const light = context.createRadialGradient(lightX, lightY, 0, lightX, lightY, radius * lightPool.radius);
  light.addColorStop(0, lightPool.colour);
  light.addColorStop(1, lightPool.clear);
  context.fillStyle = light;
  context.fill();
  if (wet <= 0) return;
  const sheenX = x + radius * sheen.x;
  const sheenY = y + radius * sheen.y;
  const shine = context.createRadialGradient(sheenX, sheenY, 0, sheenX, sheenY, radius * sheen.radius);
  shine.addColorStop(0, `rgba(${sheen.core},${sheen.coreAlpha * wet})`);
  shine.addColorStop(sheen.rimStop, `rgba(${sheen.rim},${sheen.rimAlpha * wet})`);
  shine.addColorStop(1, `rgba(${sheen.rim},0)`);
  context.fillStyle = shine;
  context.fill();
}

/** The stone's surface inside its clip (the current path is its outline). */
export function drawBoulderSurface(paint: ShorePaint, surface: BoulderSurface): void {
  const context = paint.context;
  const scale = paint.view.screenPixelsPerMetre;
  const radius = surface.place.radius;
  context.save();
  context.clip();
  drawGrain(paint, surface);
  if (radius * scale > SHORE_BOULDER.joints.fromPx) drawJoints(paint, surface.place);
  drawCover(paint, surface);
  const lichens = SHORE_BOULDER.lichens;
  if (surface.heightM > lichens.aboveM && radius * scale > lichens.fromPx) drawLichens(paint, surface.place);
  drawVolume(paint, surface.place, surface.wet);
  context.restore();
}
