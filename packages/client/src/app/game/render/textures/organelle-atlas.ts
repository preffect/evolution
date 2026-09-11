// The organelle atlas (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §3–§4): one code-baked sprite per
// organelle kind, each with its own soft halo, body ramp, detail and glint, at
// `ORGANELLE_ATLAS_PX_PER_R` px per cell radius times the device pixel ratio (capped), so the own
// cell never upsamples. Sizes are fractions of `r`; the sprite is `widthRadii × r` wide when drawn.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  CHLOROPLAST,
  CHLORO_BASE,
  CHLORO_DARK,
  CHLORO_GRANULE,
  CHLORO_LIGHT,
  FOOD_VACUOLE,
  LIPID_BASE,
  LIPID_DROPLET,
  LIPID_LIGHT,
  MITOCHONDRION,
  MITO_BASE,
  MITO_CRISTA,
  MITO_DARK,
  MITO_LIGHT,
  MITO_MATRIX,
  ORGANELLE_ATLAS_MAX_DPR,
  ORGANELLE_ATLAS_PX_PER_R,
  ORGANELLE_GLINT_ALPHA,
  ORGANELLE_HALO_ALPHA,
  ORGANELLE_HALO_REACH,
  ORGANELLE_KIND,
  ORGANELLE_RIM_WIDTH_SHARE,
  PROTOCELL_GRANULE_RADIUS_MAX,
  PROTO_GRANULE,
  TOXIN_BASE,
  TOXIN_GLOW,
  TOXIN_RIM,
  TOXIN_VACUOLE,
  VACUOLE_FILL_ALPHA,
  VAC_BASE,
  VAC_RIM,
  WHITE,
  type OrganelleKind,
} from '../constants';
import { HALF } from '../geometry';
import { bakeNucleoidSprite, bakeNucleusSprite } from './nucleus-bake';
import {
  createBodyCanvas,
  fillDisc,
  fillEllipse,
  fillHalo,
  fillRadial,
  paintGlint,
  strokeDisc,
  strokeEllipse,
  type BakeCanvasFactory,
  type BakeContext2D,
  type BakedSprite,
  type BodyCanvas,
  type DiscSpec,
} from './texture-bake';

export type OrganelleAtlasBakes = Readonly<Record<OrganelleKind, BakedSprite>>;

/** The px per radius the atlas bakes at for a device pixel ratio. */
export function atlasPxPerRadius(devicePixelRatio: number): number {
  return ORGANELLE_ATLAS_PX_PER_R * Math.min(Math.ceil(devicePixelRatio), ORGANELLE_ATLAS_MAX_DPR);
}

function haloedBody(factory: BakeCanvasFactory, bodyPx: number, halo: string): BodyCanvas & { disc: DiscSpec } {
  const body = createBodyCanvas(factory, bodyPx, ORGANELLE_HALO_REACH);
  const disc = { x: body.centre, y: body.centre, radius: bodyPx };
  fillHalo(
    body.canvas.context,
    { ...disc, radius: bodyPx * ORGANELLE_HALO_REACH },
    { colour: halo, alpha: ORGANELLE_HALO_ALPHA },
  );
  return { ...body, disc };
}

function finishSprite(body: BodyCanvas, pxPerRadius: number): BakedSprite {
  return { canvas: body.canvas, widthRadii: body.canvas.width / pxPerRadius };
}

function paintCristae(context: BakeContext2D, centre: number, radiusX: number, radiusY: number): void {
  context.fillStyle = MITO_LIGHT;
  context.globalAlpha = MITO_CRISTA.alpha;
  const width = radiusX * MITO_CRISTA.widthShare;
  const height = radiusY * MITO_CRISTA.heightShare;
  for (let crista = 0; crista < MITOCHONDRION.cristae; crista += 1) {
    const x = centre - radiusX * HALF + ((crista + HALF) / MITOCHONDRION.cristae) * radiusX;
    context.fillRect(x - width * HALF, centre - height * HALF, width, height);
  }
  context.globalAlpha = 1;
}

/** The warm bean: halo, dark → base → light ramp, three cristae folds, rim, glint. */
function bakeMitochondrion(factory: BakeCanvasFactory, pxPerRadius: number): BakedSprite {
  const radiusX = MITOCHONDRION.length * HALF * pxPerRadius;
  const radiusY = (MITOCHONDRION.width / MITOCHONDRION.length) * radiusX;
  const bean = haloedBody(factory, radiusX, MITO_BASE);
  const { context } = bean.canvas;
  const body = { x: bean.centre, y: bean.centre, radiusX, radiusY, rotation: 0 };
  fillEllipse(context, body, { colour: MITO_DARK, alpha: 1 });
  const matrix = {
    ...body,
    radiusX: radiusX * MITO_MATRIX.widthShare,
    radiusY: radiusY * MITO_MATRIX.heightShare,
    y: bean.centre - radiusY * MITO_MATRIX.liftShare,
  };
  fillEllipse(context, matrix, { colour: MITO_BASE, alpha: 1 });
  paintCristae(context, bean.centre, radiusX, radiusY);
  strokeEllipse(context, body, { colour: MITO_LIGHT, alpha: 1, width: radiusY * ORGANELLE_RIM_WIDTH_SHARE });
  paintGlint(context, { ...bean.disc, radius: radiusY }, { colour: WHITE, alpha: ORGANELLE_GLINT_ALPHA });
  return finishSprite(bean, pxPerRadius);
}

/** The lens: halo, base → dark ramp, six lit granules on the light side, rim, glint. */
function bakeChloroplast(factory: BakeCanvasFactory, pxPerRadius: number): BakedSprite {
  const lens = haloedBody(factory, CHLOROPLAST.radius * pxPerRadius, CHLORO_LIGHT);
  const { context } = lens.canvas;
  const { disc } = lens;
  fillRadial(context, disc, [
    { offset: 0, colour: CHLORO_BASE, alpha: 1 },
    { offset: 1, colour: CHLORO_DARK, alpha: 1 },
  ]);
  const arcStart = RADIANS_PER_FULL_TURN * CHLORO_GRANULE.arcStartTurns;
  for (let granule = 0; granule < CHLOROPLAST.granules; granule += 1) {
    const angle = arcStart + (granule / CHLOROPLAST.granules) * Math.PI;
    const distance = disc.radius * CHLORO_GRANULE.ringShare;
    const spot = {
      x: disc.x + Math.cos(angle) * distance,
      y: disc.y + Math.sin(angle) * distance,
      radius: disc.radius * CHLORO_GRANULE.radiusShare,
    };
    fillDisc(context, spot, { colour: CHLORO_LIGHT, alpha: 1 });
  }
  strokeDisc(context, disc, { colour: CHLORO_LIGHT, alpha: 1, width: disc.radius * ORGANELLE_RIM_WIDTH_SHARE });
  paintGlint(context, disc, { colour: WHITE, alpha: ORGANELLE_GLINT_ALPHA });
  return finishSprite(lens, pxPerRadius);
}

interface BubbleStyle {
  readonly bodyRadii: number;
  readonly base: string;
  readonly rim: string;
  readonly glow: string;
}

/** A translucent bubble: halo, faint fill denser at the rim, bright rim, glint. */
function bakeBubble(factory: BakeCanvasFactory, pxPerRadius: number, style: BubbleStyle): BakedSprite {
  const bubble = haloedBody(factory, style.bodyRadii * pxPerRadius, style.glow);
  const { context } = bubble.canvas;
  fillRadial(context, bubble.disc, [
    { offset: 0, colour: style.base, alpha: VACUOLE_FILL_ALPHA.inner },
    { offset: 1, colour: style.base, alpha: VACUOLE_FILL_ALPHA.outer },
  ]);
  strokeDisc(context, bubble.disc, {
    colour: style.rim,
    alpha: 1,
    width: bubble.disc.radius * ORGANELLE_RIM_WIDTH_SHARE,
  });
  paintGlint(context, bubble.disc, { colour: WHITE, alpha: ORGANELLE_GLINT_ALPHA });
  return finishSprite(bubble, pxPerRadius);
}

interface DropletStyle {
  readonly bodyRadii: number;
  readonly light: string;
  readonly base: string;
}

/** A small bright droplet: halo, light → base ramp, rim, glint. */
function bakeDroplet(factory: BakeCanvasFactory, pxPerRadius: number, style: DropletStyle): BakedSprite {
  const droplet = haloedBody(factory, style.bodyRadii * pxPerRadius, style.light);
  const { context } = droplet.canvas;
  fillRadial(context, droplet.disc, [
    { offset: 0, colour: style.light, alpha: 1 },
    { offset: 1, colour: style.base, alpha: 1 },
  ]);
  strokeDisc(context, droplet.disc, {
    colour: style.light,
    alpha: 1,
    width: droplet.disc.radius * ORGANELLE_RIM_WIDTH_SHARE,
  });
  paintGlint(context, droplet.disc, { colour: WHITE, alpha: ORGANELLE_GLINT_ALPHA });
  return finishSprite(droplet, pxPerRadius);
}

export function bakeOrganelleAtlas(factory: BakeCanvasFactory, devicePixelRatio: number): OrganelleAtlasBakes {
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
