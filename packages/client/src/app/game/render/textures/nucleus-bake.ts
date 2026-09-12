// The nucleus and nucleoid sprites (docs/RENDERING.md §3, sheet 01 layer 6): the nucleus is a
// 0.40 r soft glow cut out inside the 0.30 r disc (an outer glow only), the disc's rim, chromatin
// spots scattered from the cosmetic `organelles` sub-stream, a white nucleolus with its own halo
// and the nucleus's own highlight inside the disc — and no disc fill: the disc is the cell shader's
// nucleus ramp under the sprite (#231, VISUAL-STYLE §3), so the palette's own ramp shows through
// untouched. The nucleoid is a loose glowing loop of thread wobbling on two incommensurate terms at
// seeded phases. Both are baked white below full alpha and tinted the palette's rim colour by the
// sprite layer, so the nucleolus and the highlight stay lighter than the ramp's lit half.

import { RADIANS_PER_FULL_TURN, lerp, type RandomSource } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  CHROMATIN_WASH,
  NUCLEOID_ALPHA_MAX,
  NUCLEOID_BAKE,
  NUCLEOID_RADIUS,
  NUCLEOLUS_FRACTION,
  NUCLEOLUS_HALO,
  NUCLEUS_CHROMATIN,
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
import { DIAMETER_PER_RADIUS, HALF, degreesToRadians } from '../geometry';
import {
  createBodyCanvas,
  cutDisc,
  fillDisc,
  fillEllipse,
  fillHalo,
  strokeDisc,
  type BakeCanvasFactory,
  type BakeContext2D,
  type BakedSprite,
} from './texture-bake';

/** `NUCLEUS_CHROMATIN_SPOTS` spots around the disc, each jittered in angle, distance and size. */
function paintChromatin(context: BakeContext2D, centre: number, radius: number, random: RandomSource): void {
  const chromatin = NUCLEUS_CHROMATIN;
  for (let spot = 0; spot < NUCLEUS_CHROMATIN_SPOTS; spot += 1) {
    const jitter = (random.nextFloat() - HALF) * chromatin.angleJitterTurns;
    const angle = (spot / NUCLEUS_CHROMATIN_SPOTS + jitter) * RADIANS_PER_FULL_TURN;
    const distance = radius * lerp(chromatin.ringShareMin, chromatin.ringShareMax, random.nextFloat());
    const disc = {
      x: centre + Math.cos(angle) * distance,
      y: centre + Math.sin(angle) * distance,
      radius: radius * lerp(chromatin.radiusShareMin, chromatin.radiusShareMax, random.nextFloat()),
    };
    fillDisc(context, disc, { colour: CHROMATIN_WASH, alpha: chromatin.alpha });
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

/** Sheet 01 layer 6 minus its disc fill; tinted by the palette's rim colour at draw time. */
export function bakeNucleusSprite(factory: BakeCanvasFactory, pxPerRadius: number, random: RandomSource): BakedSprite {
  const glowRadius = NUCLEUS_GLOW_RADIUS * pxPerRadius;
  const radius = NUCLEUS_RADIUS * pxPerRadius;
  const { canvas, centre } = createBodyCanvas(factory, glowRadius, 1);
  const { context } = canvas;
  fillHalo(context, { x: centre, y: centre, radius: glowRadius }, { colour: WHITE, alpha: NUCLEUS_GLOW_ALPHA });
  cutDisc(context, { x: centre, y: centre, radius });
  paintChromatin(context, centre, radius, random);
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

/** The loop's two wobble phases, one per term, from the organelles sub-stream. */
interface LoopPhases {
  readonly first: number;
  readonly second: number;
}

function loopPhases(random: RandomSource): LoopPhases {
  return { first: random.nextFloat() * RADIANS_PER_FULL_TURN, second: random.nextFloat() * RADIANS_PER_FULL_TURN };
}

/** The loop's radius share at `angle`: two sine terms of incommensurate turns, so no symmetry survives. */
function loopWobble(angle: number, phases: LoopPhases): number {
  const bake = NUCLEOID_BAKE;
  return (
    1 +
    bake.wobbleShare * Math.sin(angle * bake.loopTurns + phases.first) +
    bake.secondWobbleShare * Math.sin(angle * bake.secondLoopTurns + phases.second)
  );
}

function strokeLoop(
  context: BakeContext2D,
  loop: { centre: number; radius: number; phases: LoopPhases },
  paint: { width: number; alpha: number },
): void {
  const { centre, radius } = loop;
  context.strokeStyle = hexWithAlpha(WHITE, paint.alpha);
  context.lineWidth = paint.width;
  context.lineCap = 'round';
  context.beginPath();
  for (let step = 0; step <= NUCLEOID_BAKE.steps; step += 1) {
    const angle = (step / NUCLEOID_BAKE.steps) * RADIANS_PER_FULL_TURN;
    const wobble = loopWobble(angle, loop.phases);
    const x = centre + Math.cos(angle) * radius * wobble;
    const y = centre + Math.sin(angle) * radius * wobble;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.stroke();
}

/** A glowing loop of thread at `NUCLEOID_RADIUS`, a wobbling closed curve with a wide glow under it. */
export function bakeNucleoidSprite(factory: BakeCanvasFactory, pxPerRadius: number, random: RandomSource): BakedSprite {
  const radius = NUCLEOID_RADIUS * pxPerRadius;
  const { canvas, centre } = createBodyCanvas(factory, radius, NUCLEOID_BAKE.glowReach);
  const { context } = canvas;
  fillHalo(
    context,
    { x: centre, y: centre, radius: radius * NUCLEOID_BAKE.glowReach },
    { colour: WHITE, alpha: NUCLEOID_ALPHA_MAX },
  );
  const loop = { centre, radius, phases: loopPhases(random) };
  strokeLoop(context, loop, { width: NUCLEOID_BAKE.glowPx, alpha: NUCLEOID_ALPHA_MAX });
  strokeLoop(context, loop, { width: NUCLEOID_BAKE.strandPx, alpha: 1 });
  return { canvas, widthRadii: NUCLEOID_RADIUS * NUCLEOID_BAKE.glowReach * DIAMETER_PER_RADIUS };
}
