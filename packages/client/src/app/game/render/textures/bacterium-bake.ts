// The bacterium rods (docs/VISUAL-STYLE.md §2): a rounded rod 2 × 1 collision radii, body, rim,
// one glint; the aerobic rod is mitochondrion-coloured with a hot rim and halo, the
// photosynthetic one chloroplast-coloured with three dark bands.

import { BACTERIUM_VARIANT, type BacteriumVariant } from '@evolution/shared';
import {
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
import { hexWithAlpha } from '../colour';
import {
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
const PLAIN_HALO_ALPHA = 0.12;
const ROD_STYLES: Readonly<Record<BacteriumVariant, RodStyle>> = {
  [BACTERIUM_VARIANT.plain]: {
    body: BACTERIUM_PLAIN,
    bodyAlpha: BACTERIUM_BODY_ALPHA,
    rim: PROTO_FILM,
    halo: PROTO_FILM,
    haloAlpha: PLAIN_HALO_ALPHA,
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

const HALF = 0.5;
const QUARTER_TURN = Math.PI * HALF;
/** Three quarter turns, in quarter turns. */
const THREE_QUARTERS = 3;
const THREE_QUARTER_TURN = QUARTER_TURN * THREE_QUARTERS;
const HALO_REACH = 2.2;
const RIM_WIDTH_SHARE = 0.12;
const BAND_WIDTH_SHARE = 0.16;
const BAND_ALPHA = 0.7;
const GLINT_ALPHA = 0.7;
const SIDE_LENGTH = 2;
/** A soft sheen along the top of the rod: the light side of a translucent cylinder. */
const SHEEN_LIFT_SHARE = 0.22;
const SHEEN_LENGTH_SHARE = 0.7;
const SHEEN_WIDTH_SHARE = 0.12;
const SHEEN_ALPHA = 0.18;

/** A rod along x: two half-discs joined by straight sides, length `2 × radius`, width `radius`. */
function rodPath(context: BakeContext2D, centreX: number, centreY: number, radius: number): void {
  const capRadius = radius * HALF;
  const capOffset = radius - capRadius;
  context.beginPath();
  context.arc(centreX - capOffset, centreY, capRadius, QUARTER_TURN, THREE_QUARTER_TURN);
  context.lineTo(centreX + capOffset, centreY - capRadius);
  context.arc(centreX + capOffset, centreY, capRadius, -QUARTER_TURN, QUARTER_TURN);
  context.closePath();
}

function paintBands(context: BakeContext2D, centre: number, radius: number, colour: string): void {
  context.fillStyle = hexWithAlpha(colour, BAND_ALPHA);
  for (let band = 0; band < BACTERIUM_BANDS; band += 1) {
    const x = centre - radius * HALF + ((band + HALF) / BACTERIUM_BANDS) * radius;
    context.fillRect(x - radius * BAND_WIDTH_SHARE * HALF, centre - radius * HALF, radius * BAND_WIDTH_SHARE, radius);
  }
}

/** A rod along x: length `2 × radius`, width `radius`, inscribed in its collision circle. */
export function bakeBacteriumRod(factory: BakeCanvasFactory, variant: BacteriumVariant, radius: number): BakeCanvas {
  const style = ROD_STYLES[variant];
  const size = Math.ceil(radius * HALO_REACH * SIDE_LENGTH);
  const canvas = factory.create(size, size);
  const { context } = canvas;
  const centre = size * HALF;
  fillHalo(
    context,
    { x: centre, y: centre, radius: radius * HALO_REACH },
    { colour: style.halo, alpha: style.haloAlpha },
  );
  rodPath(context, centre, centre, radius);
  context.fillStyle = hexWithAlpha(style.body, style.bodyAlpha);
  context.fill();
  const sheen = {
    x: centre,
    y: centre - radius * SHEEN_LIFT_SHARE,
    radiusX: radius * SHEEN_LENGTH_SHARE,
    radiusY: radius * SHEEN_WIDTH_SHARE,
    rotation: 0,
  };
  fillEllipse(context, sheen, { colour: WHITE, alpha: SHEEN_ALPHA });
  if (style.bands !== null) paintBands(context, centre, radius, style.bands);
  rodPath(context, centre, centre, radius);
  context.strokeStyle = hexWithAlpha(style.rim, 1);
  context.lineWidth = radius * RIM_WIDTH_SHARE;
  context.stroke();
  paintGlint(context, { x: centre, y: centre, radius: radius * HALF }, { colour: WHITE, alpha: GLINT_ALPHA });
  return canvas;
}
