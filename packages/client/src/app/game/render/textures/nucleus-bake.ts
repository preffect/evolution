// The nucleus and nucleoid sprites (docs/RENDERING.md §3, sheet 01 layer 6): the nucleus is a
// 0.40 r soft glow under a 0.30 r disc with its rim, five chromatin spots, a white nucleolus with
// its own halo and the nucleus's own highlight; the nucleoid is a loose glowing loop of thread.
// Both are baked white so the layer tints them with the palette's nucleus / rim colour.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  NUCLEOID_ALPHA_MAX,
  NUCLEOID_BAKE,
  NUCLEOID_RADIUS,
  NUCLEOLUS_FRACTION,
  NUCLEOLUS_HALO,
  NUCLEUS_BAKE,
  NUCLEUS_CHROMATIN_SPOTS,
  NUCLEUS_GLOW_ALPHA,
  NUCLEUS_GLOW_RADIUS,
  NUCLEUS_HIGHLIGHT,
  NUCLEUS_HIGHLIGHT_ALPHA,
  NUCLEUS_HIGHLIGHT_ANGLE_DEG,
  NUCLEUS_HIGHLIGHT_OFFSET_RADII,
  NUCLEUS_RADIUS,
  NUCLEUS_RIM_ALPHA,
  NUCLEUS_RIM_PX,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS, degreesToRadians } from '../geometry';
import {
  createBodyCanvas,
  fillDisc,
  fillEllipse,
  fillHalo,
  fillRadial,
  strokeDisc,
  type BakeCanvasFactory,
  type BakeContext2D,
  type BakedSprite,
} from './texture-bake';

/** The chromatin spots are the body darkened: a black wash at a low alpha. */
const CHROMATIN = '#000000';

function paintChromatin(context: BakeContext2D, centre: number, radius: number): void {
  for (let spot = 0; spot < NUCLEUS_CHROMATIN_SPOTS; spot += 1) {
    const angle = (spot / NUCLEUS_CHROMATIN_SPOTS) * RADIANS_PER_FULL_TURN;
    const distance = radius * NUCLEUS_BAKE.chromatinRingShare;
    const disc = {
      x: centre + Math.cos(angle) * distance,
      y: centre + Math.sin(angle) * distance,
      radius: radius * NUCLEUS_BAKE.chromatinRadiusShare,
    };
    fillDisc(context, disc, { colour: CHROMATIN, alpha: NUCLEUS_BAKE.chromatinAlpha });
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
  fillEllipse(context, ellipse, { colour: WHITE, alpha: NUCLEUS_HIGHLIGHT_ALPHA });
}

/** Sheet 01 layer 6 in full; tinted by the palette's nucleus colour at draw time. */
export function bakeNucleusSprite(factory: BakeCanvasFactory, pxPerRadius: number): BakedSprite {
  const glowRadius = NUCLEUS_GLOW_RADIUS * pxPerRadius;
  const radius = NUCLEUS_RADIUS * pxPerRadius;
  const { canvas, centre } = createBodyCanvas(factory, glowRadius, 1);
  const { context } = canvas;
  fillHalo(context, { x: centre, y: centre, radius: glowRadius }, { colour: WHITE, alpha: NUCLEUS_GLOW_ALPHA });
  fillRadial(context, { x: centre, y: centre, radius }, [
    { offset: 0, colour: WHITE, alpha: 1 },
    { offset: 1, colour: WHITE, alpha: NUCLEUS_BAKE.darkAlpha },
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
    { x: centre, y: centre, radius: nucleolus * NUCLEOLUS_HALO.reach },
    { colour: WHITE, alpha: NUCLEOLUS_HALO.alpha },
  );
  fillDisc(context, { x: centre, y: centre, radius: nucleolus }, { colour: WHITE, alpha: 1 });
  paintHighlight(context, centre, pxPerRadius);
  return { canvas, widthRadii: canvas.width / pxPerRadius };
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
  for (let step = 0; step <= NUCLEOID_BAKE.steps; step += 1) {
    const angle = (step / NUCLEOID_BAKE.steps) * RADIANS_PER_FULL_TURN;
    const wobble = 1 + NUCLEOID_BAKE.wobbleShare * Math.sin(angle * NUCLEOID_BAKE.loopTurns);
    const x = centre + Math.cos(angle) * radius * wobble;
    const y = centre + Math.sin(angle) * radius * wobble;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.stroke();
}

/** A glowing loop of thread at `NUCLEOID_RADIUS`, a wobbling closed curve with a wide glow under it. */
export function bakeNucleoidSprite(factory: BakeCanvasFactory, pxPerRadius: number): BakedSprite {
  const radius = NUCLEOID_RADIUS * pxPerRadius;
  const { canvas, centre } = createBodyCanvas(factory, radius, NUCLEOID_BAKE.glowReach);
  const { context } = canvas;
  fillHalo(
    context,
    { x: centre, y: centre, radius: radius * NUCLEOID_BAKE.glowReach },
    { colour: WHITE, alpha: NUCLEOID_ALPHA_MAX },
  );
  strokeLoop(context, centre, radius, { width: NUCLEOID_BAKE.glowPx, alpha: NUCLEOID_ALPHA_MAX });
  strokeLoop(context, centre, radius, { width: NUCLEOID_BAKE.strandPx, alpha: 1 });
  return { canvas, widthRadii: NUCLEOID_RADIUS * NUCLEOID_BAKE.glowReach * DIAMETER_PER_RADIUS };
}
