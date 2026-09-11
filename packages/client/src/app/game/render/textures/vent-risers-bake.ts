// What rises off the vent seam (sheet 02 vent table, the last three rows): the refraction arcs
// climbing and fading with height, the rim-lit bubbles shrinking as they rise (both in the
// fissure's rotated frame), and the plume motes drifting up in the world frame. Bubble and plume
// placement comes from the vent sub-stream the fissure bake hands in; everything is in wu.

import { lerp, type RandomSource } from '@evolution/shared';
import {
  BG_FIELD,
  BUBBLE_BAKE,
  BUBBLE_FILL_MID,
  BUBBLE_FILL_RIM,
  BUBBLE_INNER_RING,
  BUBBLE_RIM,
  VENT_BUBBLES,
  VENT_PLUME,
  VENT_PLUME_MOTES,
  VENT_SHIMMER_ARCS,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS } from '../geometry';
import { fillFeatheredEllipse, strokeSoft } from './soft-paint';
import { fillHalo, fillRadial, paintGlint, strokeDisc, type BakeContext2D, type DiscSpec } from './texture-bake';

const RISING = -1;

/** A seeded offset across the rise, uniform in ±`spread`. */
function acrossOffset(random: RandomSource, spread: number): number {
  return (random.nextFloat() * DIAMETER_PER_RADIUS - 1) * spread;
}

/** `VENT_SHIMMER_ARCS.count` arcs, each a quadratic sagging toward the seam, wider and fainter as they rise. */
function paintShimmerArcs(context: BakeContext2D): void {
  const arcs = VENT_SHIMMER_ARCS;
  for (let arc = 0; arc < arcs.count; arc += 1) {
    const share = arc / (arcs.count - 1);
    const rise = lerp(arcs.riseWuFirst, arcs.riseWuLast, share) * RISING;
    const halfWidth = lerp(arcs.halfWidthWuFirst, arcs.halfWidthWuLast, share);
    const crest = rise + halfWidth * arcs.sagittaShare * RISING;
    strokeSoft(
      context,
      (path) => {
        path.moveTo(-halfWidth, rise);
        path.quadraticCurveTo(0, crest, halfWidth, rise);
      },
      {
        colour: VENT_PLUME,
        alpha: lerp(arcs.alphaFirst, arcs.alphaLast, share),
        widthPx: lerp(arcs.widthWuFirst, arcs.widthWuLast, share),
        featherPx: 0,
      },
    );
  }
}

/** Sheet 02's `bubble`: halo, a fill densest at the rim, the rim, an inner ring and the glint, all at `alpha`. */
export function paintBubble(context: BakeContext2D, disc: DiscSpec, alpha: number): void {
  const bake = BUBBLE_BAKE;
  context.globalAlpha = alpha;
  fillHalo(
    context,
    { ...disc, radius: disc.radius * bake.haloReach },
    { colour: BUBBLE_FILL_RIM, alpha: bake.haloAlpha },
  );
  fillRadial(context, disc, [
    { offset: 0, colour: BG_FIELD, alpha: bake.fillCentreAlpha },
    { offset: bake.fillMidStop, colour: BUBBLE_FILL_MID, alpha: bake.fillMidAlpha },
    { offset: 1, colour: BUBBLE_FILL_RIM, alpha: bake.fillRimAlpha },
  ]);
  strokeDisc(context, disc, { colour: BUBBLE_RIM, alpha: bake.rimAlpha, width: disc.radius * bake.rimWidthShare });
  strokeDisc(
    context,
    { ...disc, radius: disc.radius * bake.innerRingShare },
    { colour: BUBBLE_INNER_RING, alpha: bake.innerRingAlpha, width: disc.radius * bake.innerRingWidthShare },
  );
  paintGlint(context, disc, { colour: WHITE, alpha: bake.glintAlpha });
  context.globalAlpha = 1;
}

/** `VENT_BUBBLES.count` bubbles at seeded heights and offsets, smaller and fainter the higher they are. */
function paintBubbles(context: BakeContext2D, random: RandomSource): void {
  const bubbles = VENT_BUBBLES;
  for (let bubble = 0; bubble < bubbles.count; bubble += 1) {
    const height = random.nextFloat();
    const disc = {
      x: acrossOffset(random, bubbles.spreadWu),
      y: lerp(bubbles.riseWuMin, bubbles.riseWuMax, height) * RISING,
      radius: lerp(bubbles.radiusWuMax, bubbles.radiusWuMin, height),
    };
    paintBubble(context, disc, lerp(bubbles.alphaNear, bubbles.alphaFar, height));
  }
}

/** The arcs and the bubbles, in the fissure's rotated frame. */
export function paintVentRisers(context: BakeContext2D, random: RandomSource): void {
  paintShimmerArcs(context);
  paintBubbles(context, random);
}

/** The plume: soft motes above the vent in the world frame, spreading and fading with height. */
export function paintVentPlume(context: BakeContext2D, random: RandomSource): void {
  const motes = VENT_PLUME_MOTES;
  for (let mote = 0; mote < motes.count; mote += 1) {
    const height = random.nextFloat();
    const radius = lerp(motes.radiusWuMin, motes.radiusWuMax, random.nextFloat());
    fillFeatheredEllipse(
      context,
      {
        x: acrossOffset(random, lerp(motes.spreadWuNear, motes.spreadWuFar, height)),
        y: lerp(motes.riseWuMin, motes.riseWuMax, height) * RISING,
        radiusX: radius,
        radiusY: radius,
        rotation: 0,
      },
      { colour: VENT_PLUME, alpha: lerp(motes.alphaNear, motes.alphaFar, height) },
      motes.blurWu,
    );
  }
}

/** How far the risers reach from the vent centre: the plume's top mote, halo included. */
export function ventRisersReachWu(): number {
  return VENT_PLUME_MOTES.riseWuMax + VENT_PLUME_MOTES.radiusWuMax + VENT_PLUME_MOTES.blurWu;
}
