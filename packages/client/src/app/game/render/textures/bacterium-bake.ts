// The bacterium rods (docs/VISUAL-STYLE.md §2): a rounded rod 2 × 1 collision radii, body, rim,
// one glint; the aerobic rod is mitochondrion-coloured with a hot rim and halo, the
// photosynthetic one chloroplast-coloured with three dark bands.

import { BACTERIUM_VARIANT, type BacteriumVariant } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  BACTERIUM_BAKE,
  BACTERIUM_BANDS,
  BACTERIUM_BODY_ALPHA,
  BACTERIUM_HALO_ALPHA,
  BACTERIUM_PLAIN,
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_LIGHT,
  MITO_BASE,
  MITO_LIGHT,
  PROTO_FILM,
  WHITE,
} from '../constants';
import { HALF } from '../geometry';
import {
  createBodyCanvas,
  fillEllipse,
  fillHalo,
  paintGlint,
  type BakeCanvas,
  type BakeCanvasFactory,
  type BakeContext2D,
} from './texture-bake';

interface RodStyle {
  readonly body: string;
  readonly bodyAlpha: number;
  readonly rim: string;
  readonly halo: string;
  readonly haloAlpha: number;
  readonly bands: string | null;
}

/** The plain rod scatters only a faint film halo; the organelle-coloured rods glow at the food-table alpha. */
const ROD_STYLES: Readonly<Record<BacteriumVariant, RodStyle>> = {
  [BACTERIUM_VARIANT.plain]: {
    body: BACTERIUM_PLAIN,
    bodyAlpha: BACTERIUM_BODY_ALPHA,
    rim: PROTO_FILM,
    halo: PROTO_FILM,
    haloAlpha: BACTERIUM_BAKE.plainHaloAlpha,
    bands: null,
  },
  [BACTERIUM_VARIANT.aerobic]: {
    body: MITO_BASE,
    bodyAlpha: 1,
    rim: MITO_LIGHT,
    halo: MITO_BASE,
    haloAlpha: BACTERIUM_HALO_ALPHA,
    bands: null,
  },
  [BACTERIUM_VARIANT.photosynthetic]: {
    body: CHLORO_BASE,
    bodyAlpha: 1,
    rim: CHLORO_LIGHT,
    halo: CHLORO_LIGHT,
    haloAlpha: BACTERIUM_HALO_ALPHA,
    bands: CHLORO_DARK,
  },
};

const QUARTER_TURN = Math.PI * HALF;
/** Three quarter turns, in quarter turns. */
const THREE_QUARTERS = 3;
const THREE_QUARTER_TURN = QUARTER_TURN * THREE_QUARTERS;

/** A rod along x: two half-discs joined by straight sides, length `2 × radius`, width `radius`. */
function rodPath(context: BakeContext2D, centre: number, radius: number): void {
  const capRadius = radius * HALF;
  const capOffset = radius - capRadius;
  context.beginPath();
  context.arc(centre - capOffset, centre, capRadius, QUARTER_TURN, THREE_QUARTER_TURN);
  context.lineTo(centre + capOffset, centre - capRadius);
  context.arc(centre + capOffset, centre, capRadius, -QUARTER_TURN, QUARTER_TURN);
  context.closePath();
}

function paintBands(context: BakeContext2D, centre: number, radius: number, colour: string): void {
  context.fillStyle = hexWithAlpha(colour, BACTERIUM_BAKE.bandAlpha);
  const width = radius * BACTERIUM_BAKE.bandWidthShare;
  for (let band = 0; band < BACTERIUM_BANDS; band += 1) {
    const x = centre - radius * HALF + ((band + HALF) / BACTERIUM_BANDS) * radius;
    context.fillRect(x - width * HALF, centre - radius * HALF, width, radius);
  }
}

/** A soft sheen along the top of the rod: the light side of a translucent cylinder. */
function paintSheen(context: BakeContext2D, centre: number, radius: number): void {
  const { sheen } = BACTERIUM_BAKE;
  const ellipse = {
    x: centre,
    y: centre - radius * sheen.liftShare,
    radiusX: radius * sheen.lengthShare,
    radiusY: radius * sheen.widthShare,
    rotation: 0,
  };
  fillEllipse(context, ellipse, { colour: WHITE, alpha: sheen.alpha });
}

/** A rod along x: length `2 × radius`, width `radius`, inscribed in its collision circle of `radius` px. */
export function bakeBacteriumRod(factory: BakeCanvasFactory, variant: BacteriumVariant, radius: number): BakeCanvas {
  const style = ROD_STYLES[variant];
  const { canvas, centre } = createBodyCanvas(factory, radius, BACTERIUM_BAKE.haloReach);
  const { context } = canvas;
  fillHalo(
    context,
    { x: centre, y: centre, radius: radius * BACTERIUM_BAKE.haloReach },
    { colour: style.halo, alpha: style.haloAlpha },
  );
  rodPath(context, centre, radius);
  context.fillStyle = hexWithAlpha(style.body, style.bodyAlpha);
  context.fill();
  paintSheen(context, centre, radius);
  if (style.bands !== null) paintBands(context, centre, radius, style.bands);
  rodPath(context, centre, radius);
  context.strokeStyle = hexWithAlpha(style.rim, 1);
  context.lineWidth = radius * BACTERIUM_BAKE.rimWidthShare;
  context.stroke();
  paintGlint(
    context,
    { x: centre, y: centre, radius: radius * HALF },
    { colour: WHITE, alpha: BACTERIUM_BAKE.glintAlpha },
  );
  return canvas;
}
