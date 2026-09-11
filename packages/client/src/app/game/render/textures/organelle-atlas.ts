// The organelle atlas (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §3–§4): one code-baked sprite per
// organelle kind, each with its own soft halo, body ramp, detail and glint, at
// `ORGANELLE_ATLAS_PX_PER_R` px per cell radius times the device pixel ratio (capped), so the own
// cell never upsamples. Sizes are fractions of `r`; the sprite is `widthRadii × r` wide when drawn.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  CHLOROPLAST,
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_LIGHT,
  FOOD_VACUOLE,
  LIPID_BASE,
  LIPID_DROPLET,
  LIPID_LIGHT,
  MITOCHONDRION,
  MITO_BASE,
  MITO_DARK,
  MITO_LIGHT,
  ORGANELLE_ATLAS_MAX_DPR,
  ORGANELLE_ATLAS_PX_PER_R,
  PROTOCELL_GRANULE_RADIUS_MAX,
  PROTO_GRANULE,
  TOXIN_BASE,
  TOXIN_GLOW,
  TOXIN_RIM,
  TOXIN_VACUOLE,
  VAC_BASE,
  VAC_RIM,
  WHITE,
} from '../constants';
import { ORGANELLE_KIND, type OrganelleKind } from '../cells/organelle-kinds';
import { bakeNucleoidSprite, bakeNucleusSprite } from './nucleus-bake';
import {
  fillDisc,
  fillEllipse,
  fillHalo,
  fillRadial,
  paintGlint,
  strokeDisc,
  strokeEllipse,
  type BakeCanvas,
  type BakeCanvasFactory,
  type BakeContext2D,
} from './texture-bake';

export interface OrganelleSprite {
  readonly canvas: BakeCanvas;
  /** The sprite's full width in cell radii, halo included, so the layer scales it by `r`. */
  readonly widthRadii: number;
}

export type OrganelleAtlas = Readonly<Record<OrganelleKind, OrganelleSprite>>;

const HALF = 0.5;
const SIDE_LENGTH = 2;
/** Every sprite's halo reaches this far beyond its body. */
const HALO_REACH = 1.6;
const HALO_ALPHA = 0.35;
const RIM_WIDTH_SHARE = 0.1;
const GLINT_ALPHA = 0.55;
const CRISTA_WIDTH_SHARE = 0.06;
const CRISTA_HEIGHT_SHARE = 1.2;
const CRISTA_ALPHA = 0.8;
const MATRIX_WIDTH_SHARE = 0.92;
const MATRIX_HEIGHT_SHARE = 0.85;
const MATRIX_LIFT_SHARE = 0.08;
const GRANULE_RADIUS_SHARE = 0.16;
const GRANULE_RING_SHARE = 0.55;
/** The lit granules start 0.375 of a turn before the light and span half a turn. */
const GRANULE_ARC_START_TURNS = -0.375;
const GRANULE_ARC_START = RADIANS_PER_FULL_TURN * GRANULE_ARC_START_TURNS;
const VACUOLE_INNER_ALPHA = 0.25;
const VACUOLE_OUTER_ALPHA = 0.6;

interface SpriteCanvas {
  readonly canvas: BakeCanvas;
  readonly centre: number;
  readonly bodyPx: number;
  readonly widthRadii: number;
}

/** The px per radius the atlas bakes at for a device pixel ratio. */
export function atlasPxPerRadius(devicePixelRatio: number): number {
  return ORGANELLE_ATLAS_PX_PER_R * Math.min(Math.ceil(devicePixelRatio), ORGANELLE_ATLAS_MAX_DPR);
}

function spriteCanvas(factory: BakeCanvasFactory, bodyRadii: number, pxPerRadius: number): SpriteCanvas {
  const widthRadii = bodyRadii * HALO_REACH * SIDE_LENGTH;
  const size = Math.ceil(widthRadii * pxPerRadius);
  return { canvas: factory.create(size, size), centre: size * HALF, bodyPx: bodyRadii * pxPerRadius, widthRadii };
}

function paintCristae(context: BakeContext2D, centre: number, radiusX: number, radiusY: number): void {
  context.fillStyle = MITO_LIGHT;
  context.globalAlpha = CRISTA_ALPHA;
  for (let crista = 0; crista < MITOCHONDRION.cristae; crista += 1) {
    const x = centre - radiusX * HALF + ((crista + HALF) / MITOCHONDRION.cristae) * radiusX;
    const height = radiusY * CRISTA_HEIGHT_SHARE;
    context.fillRect(
      x - radiusX * CRISTA_WIDTH_SHARE * HALF,
      centre - height * HALF,
      radiusX * CRISTA_WIDTH_SHARE,
      height,
    );
  }
  context.globalAlpha = 1;
}

/** The warm bean: halo, dark → base → light ramp, three cristae folds, rim, glint. */
function bakeMitochondrion(factory: BakeCanvasFactory, pxPerRadius: number): OrganelleSprite {
  const bean = spriteCanvas(factory, MITOCHONDRION.length * HALF, pxPerRadius);
  const { context } = bean.canvas;
  const radiusX = bean.bodyPx;
  const radiusY = (MITOCHONDRION.width / MITOCHONDRION.length) * radiusX;
  fillHalo(
    context,
    { x: bean.centre, y: bean.centre, radius: radiusX * HALO_REACH },
    { colour: MITO_BASE, alpha: HALO_ALPHA },
  );
  const body = { x: bean.centre, y: bean.centre, radiusX, radiusY, rotation: 0 };
  fillEllipse(context, body, { colour: MITO_DARK, alpha: 1 });
  const matrix = {
    ...body,
    radiusX: radiusX * MATRIX_WIDTH_SHARE,
    radiusY: radiusY * MATRIX_HEIGHT_SHARE,
    y: bean.centre - radiusY * MATRIX_LIFT_SHARE,
  };
  fillEllipse(context, matrix, { colour: MITO_BASE, alpha: 1 });
  paintCristae(context, bean.centre, radiusX, radiusY);
  strokeEllipse(context, body, { colour: MITO_LIGHT, alpha: 1, width: radiusY * RIM_WIDTH_SHARE });
  paintGlint(context, { x: bean.centre, y: bean.centre, radius: radiusY }, { colour: WHITE, alpha: GLINT_ALPHA });
  return { canvas: bean.canvas, widthRadii: bean.widthRadii };
}

/** The lens: halo, base → dark ramp, six lit granules on the light side, rim, glint. */
function bakeChloroplast(factory: BakeCanvasFactory, pxPerRadius: number): OrganelleSprite {
  const lens = spriteCanvas(factory, CHLOROPLAST.radius, pxPerRadius);
  const { context } = lens.canvas;
  const disc = { x: lens.centre, y: lens.centre, radius: lens.bodyPx };
  fillHalo(context, { ...disc, radius: lens.bodyPx * HALO_REACH }, { colour: CHLORO_LIGHT, alpha: HALO_ALPHA });
  fillRadial(context, disc, [
    { offset: 0, colour: CHLORO_BASE, alpha: 1 },
    { offset: 1, colour: CHLORO_DARK, alpha: 1 },
  ]);
  for (let granule = 0; granule < CHLOROPLAST.granules; granule += 1) {
    const angle = GRANULE_ARC_START + (granule / CHLOROPLAST.granules) * Math.PI;
    const distance = lens.bodyPx * GRANULE_RING_SHARE;
    const spot = {
      x: lens.centre + Math.cos(angle) * distance,
      y: lens.centre + Math.sin(angle) * distance,
      radius: lens.bodyPx * GRANULE_RADIUS_SHARE,
    };
    fillDisc(context, spot, { colour: CHLORO_LIGHT, alpha: 1 });
  }
  strokeDisc(context, disc, { colour: CHLORO_LIGHT, alpha: 1, width: lens.bodyPx * RIM_WIDTH_SHARE });
  paintGlint(context, disc, { colour: WHITE, alpha: GLINT_ALPHA });
  return { canvas: lens.canvas, widthRadii: lens.widthRadii };
}

interface BubbleStyle {
  readonly bodyRadii: number;
  readonly base: string;
  readonly rim: string;
  readonly glow: string;
}

/** A translucent bubble: halo, faint fill, bright rim, glint. */
function bakeBubble(factory: BakeCanvasFactory, pxPerRadius: number, style: BubbleStyle): OrganelleSprite {
  const bubble = spriteCanvas(factory, style.bodyRadii, pxPerRadius);
  const { context } = bubble.canvas;
  const disc = { x: bubble.centre, y: bubble.centre, radius: bubble.bodyPx };
  fillHalo(context, { ...disc, radius: bubble.bodyPx * HALO_REACH }, { colour: style.glow, alpha: HALO_ALPHA });
  fillRadial(context, disc, [
    { offset: 0, colour: style.base, alpha: VACUOLE_INNER_ALPHA },
    { offset: 1, colour: style.base, alpha: VACUOLE_OUTER_ALPHA },
  ]);
  strokeDisc(context, disc, { colour: style.rim, alpha: 1, width: bubble.bodyPx * RIM_WIDTH_SHARE });
  paintGlint(context, disc, { colour: WHITE, alpha: GLINT_ALPHA });
  return { canvas: bubble.canvas, widthRadii: bubble.widthRadii };
}

interface DropletStyle {
  readonly bodyRadii: number;
  readonly light: string;
  readonly base: string;
}

/** A small bright droplet: halo, light → base ramp, rim, glint. */
function bakeDroplet(factory: BakeCanvasFactory, pxPerRadius: number, style: DropletStyle): OrganelleSprite {
  const droplet = spriteCanvas(factory, style.bodyRadii, pxPerRadius);
  const { context } = droplet.canvas;
  const disc = { x: droplet.centre, y: droplet.centre, radius: droplet.bodyPx };
  fillHalo(context, { ...disc, radius: droplet.bodyPx * HALO_REACH }, { colour: style.light, alpha: HALO_ALPHA });
  fillRadial(context, disc, [
    { offset: 0, colour: style.light, alpha: 1 },
    { offset: 1, colour: style.base, alpha: 1 },
  ]);
  strokeDisc(context, disc, { colour: style.light, alpha: 1, width: droplet.bodyPx * RIM_WIDTH_SHARE });
  paintGlint(context, disc, { colour: WHITE, alpha: GLINT_ALPHA });
  return { canvas: droplet.canvas, widthRadii: droplet.widthRadii };
}

export function bakeOrganelleAtlas(factory: BakeCanvasFactory, devicePixelRatio: number): OrganelleAtlas {
  const pxPerRadius = atlasPxPerRadius(devicePixelRatio);
  return {
    [ORGANELLE_KIND.nucleus]: bakeNucleusSprite(factory, pxPerRadius),
    [ORGANELLE_KIND.nucleoid]: bakeNucleoidSprite(factory, pxPerRadius),
    [ORGANELLE_KIND.mitochondrion]: bakeMitochondrion(factory, pxPerRadius),
    [ORGANELLE_KIND.chloroplast]: bakeChloroplast(factory, pxPerRadius),
    [ORGANELLE_KIND.foodVacuole]: bakeBubble(factory, pxPerRadius, {
      bodyRadii: FOOD_VACUOLE.radius,
      base: MITO_BASE,
      rim: VAC_RIM,
      glow: VAC_BASE,
    }),
    [ORGANELLE_KIND.toxinVacuole]: bakeBubble(factory, pxPerRadius, {
      bodyRadii: TOXIN_VACUOLE.radius,
      base: TOXIN_BASE,
      rim: TOXIN_RIM,
      glow: TOXIN_GLOW,
    }),
    [ORGANELLE_KIND.lipid]: bakeDroplet(factory, pxPerRadius, {
      bodyRadii: LIPID_DROPLET.radiusMax,
      light: LIPID_LIGHT,
      base: LIPID_BASE,
    }),
    [ORGANELLE_KIND.protocellGranule]: bakeDroplet(factory, pxPerRadius, {
      bodyRadii: PROTOCELL_GRANULE_RADIUS_MAX,
      light: WHITE,
      base: PROTO_GRANULE,
    }),
  };
}
