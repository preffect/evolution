// The nucleus and nucleoid sprites (docs/RENDERING.md §3, sheet 01 layer 6): the nucleus is a
// 0.40 r soft glow under a 0.30 r disc with its rim, five chromatin spots, a white nucleolus with
// its own halo and the nucleus's own highlight; the nucleoid is a loose glowing loop of thread.
// Both are near-white so the layer tints them with the palette's nucleus / rim colour.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  NUCLEOID_ALPHA_MAX,
  NUCLEOID_RADIUS,
  NUCLEOLUS_FRACTION,
  NUCLEUS_CHROMATIN_SPOTS,
  NUCLEUS_GLOW_ALPHA,
  NUCLEUS_GLOW_RADIUS,
  NUCLEUS_HIGHLIGHT,
  NUCLEUS_HIGHLIGHT_ANGLE_DEG,
  NUCLEUS_HIGHLIGHT_OFFSET_RADII,
  NUCLEUS_RADIUS,
  NUCLEUS_RIM_ALPHA,
  NUCLEUS_RIM_PX,
  WHITE,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { hexWithAlpha } from '../colour';
import {
  fillDisc,
  fillEllipse,
  fillHalo,
  fillRadial,
  strokeDisc,
  type BakeCanvasFactory,
  type BakeContext2D,
} from './texture-bake';
import type { OrganelleSprite } from './organelle-atlas';

const HALF = 0.5;
const SIDE_LENGTH = 2;
const NUCLEUS_DARK_ALPHA = 0.85;
const CHROMATIN_ALPHA = 0.25;
const CHROMATIN_RADIUS_SHARE = 0.16;
const CHROMATIN_RING_SHARE = 0.5;
const NUCLEOLUS_HALO_SHARE = 1.8;
const NUCLEOLUS_HALO_ALPHA = 0.5;
const HIGHLIGHT_ALPHA = 0.6;
const NUCLEOID_LOOP_TURNS = 3;
const NUCLEOID_STRAND_PX = 2;
const NUCLEOID_GLOW_PX = 6;
const NUCLEOID_GLOW_REACH = 1.5;
const NUCLEOID_STEPS = 96;
const NUCLEOID_WOBBLE_SHARE = 0.18;
/** The chromatin spots are the body darkened: a black wash at a low alpha. */
const CHROMATIN = '#000000';

function paintChromatin(context: BakeContext2D, centre: number, radius: number): void {
  for (let spot = 0; spot < NUCLEUS_CHROMATIN_SPOTS; spot += 1) {
    const angle = (spot / NUCLEUS_CHROMATIN_SPOTS) * RADIANS_PER_FULL_TURN;
    const distance = radius * CHROMATIN_RING_SHARE;
    const disc = {
      x: centre + Math.cos(angle) * distance,
      y: centre + Math.sin(angle) * distance,
      radius: radius * CHROMATIN_RADIUS_SHARE,
    };
    fillDisc(context, disc, { colour: CHROMATIN, alpha: CHROMATIN_ALPHA });
  }
}

function paintHighlight(context: BakeContext2D, centre: number, pxPerRadius: number): void {
  const angle = degreesToRadians(NUCLEUS_HIGHLIGHT_ANGLE_DEG);
  const ellipse = {
    x: centre + Math.cos(angle) * NUCLEUS_HIGHLIGHT_OFFSET_RADII * pxPerRadius,
    y: centre + Math.sin(angle) * NUCLEUS_HIGHLIGHT_OFFSET_RADII * pxPerRadius,
    radiusX: NUCLEUS_HIGHLIGHT.radiusX * pxPerRadius,
    radiusY: NUCLEUS_HIGHLIGHT.radiusY * pxPerRadius,
    rotation: angle,
  };
  fillEllipse(context, ellipse, { colour: WHITE, alpha: HIGHLIGHT_ALPHA });
}

/** Sheet 01 layer 6 in full; tinted by the palette's nucleus colour at draw time. */
export function bakeNucleusSprite(factory: BakeCanvasFactory, pxPerRadius: number): OrganelleSprite {
  const widthRadii = NUCLEUS_GLOW_RADIUS * SIDE_LENGTH + NUCLEUS_HIGHLIGHT.radiusX;
  const size = Math.ceil(widthRadii * pxPerRadius);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  const radius = NUCLEUS_RADIUS * pxPerRadius;
  fillHalo(
    context,
    { x: centre, y: centre, radius: NUCLEUS_GLOW_RADIUS * pxPerRadius },
    { colour: WHITE, alpha: NUCLEUS_GLOW_ALPHA },
  );
  fillRadial(context, { x: centre, y: centre, radius }, [
    { offset: 0, colour: WHITE, alpha: 1 },
    { offset: 1, colour: WHITE, alpha: NUCLEUS_DARK_ALPHA },
  ]);
  paintChromatin(context, centre, radius);
  strokeDisc(
    context,
    { x: centre, y: centre, radius },
    { colour: WHITE, alpha: NUCLEUS_RIM_ALPHA, width: NUCLEUS_RIM_PX },
  );
  const nucleolus = radius * NUCLEOLUS_FRACTION;
  fillHalo(
    context,
    { x: centre, y: centre, radius: nucleolus * NUCLEOLUS_HALO_SHARE },
    { colour: WHITE, alpha: NUCLEOLUS_HALO_ALPHA },
  );
  fillDisc(context, { x: centre, y: centre, radius: nucleolus }, { colour: WHITE, alpha: 1 });
  paintHighlight(context, centre, pxPerRadius);
  return { canvas, widthRadii };
}

function strokeLoop(
  context: BakeContext2D,
  centre: number,
  radius: number,
  paint: { width: number; alpha: number },
): void {
  context.strokeStyle = hexWithAlpha(WHITE, paint.alpha);
  context.lineWidth = paint.width;
  context.lineCap = 'round';
  context.beginPath();
  for (let step = 0; step <= NUCLEOID_STEPS; step += 1) {
    const angle = (step / NUCLEOID_STEPS) * RADIANS_PER_FULL_TURN;
    const wobble = 1 + NUCLEOID_WOBBLE_SHARE * Math.sin(angle * NUCLEOID_LOOP_TURNS);
    const x = centre + Math.cos(angle) * radius * wobble;
    const y = centre + Math.sin(angle) * radius * wobble;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.stroke();
}

/** A glowing loop of thread, 0.34 r, drawn as a wobbling closed curve with a wide glow under it. */
export function bakeNucleoidSprite(factory: BakeCanvasFactory, pxPerRadius: number): OrganelleSprite {
  const widthRadii = NUCLEOID_RADIUS * SIDE_LENGTH * NUCLEOID_GLOW_REACH;
  const size = Math.ceil(widthRadii * pxPerRadius);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  const radius = NUCLEOID_RADIUS * pxPerRadius;
  fillHalo(
    context,
    { x: centre, y: centre, radius: radius * NUCLEOID_GLOW_REACH },
    { colour: WHITE, alpha: NUCLEOID_ALPHA_MAX },
  );
  strokeLoop(context, centre, radius, { width: NUCLEOID_GLOW_PX, alpha: NUCLEOID_ALPHA_MAX });
  strokeLoop(context, centre, radius, { width: NUCLEOID_STRAND_PX, alpha: 1 });
  return { canvas, widthRadii };
}
