// The arc panel of the indicator contact sheet (docs/RENDERING.md §10, #294 evidence): what the arc primitive
// draws, at the sizes review asked for. The DNA ring at 0 / 25 / 50 / 75 / 100 % on the floored 17 px ring and on
// a max-mass cell's 44.9 px ring; a ladder orbit at 32 px whose backings merge around the envelope ghost with both
// counters unlocked, so each counter ghost wears its ring; the escape arc on a max-mass cell's 126 px orbit. Each
// sits on a patch of body drawn with the same primitive (a ring as wide as its radius is a disc). Pure: the rows
// and the placed sprites the sheet view draws, in the sheet's screen px (zoom 1).

import {
  CALLOUT_BACKING,
  DANGER,
  DNA,
  DNA_RING_STROKE_PX,
  DNA_RING_TRACK_ALPHA,
  DNA_RING_TRACK_PAD_PX,
  ESCAPE_ARC_STROKE_PX,
  ESCAPE_ARC_TRACK_ALPHA,
  INDICATOR_SHEET,
  LADDER_BACKING_ALPHA,
  LADDER_BACKING_PX,
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_ORBIT_ANGLE_SINGLE_DEG,
  LADDER_UNLOCK_RING_STROKE_PX,
  LEVEL_GOLD,
  WHITE,
} from '../constants';
import { DEGREES_PER_TURN, DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { paletteFor } from '../palette';
import { LADDER_SILHOUETTE, type LadderCounter, type LadderSilhouette } from '../../state/own-cell-indicators';
import type { ArcInstance } from '../effects/arc-instance';
import { orbitLayout, type OrbitLayout } from '../effects/orbit-layout';
import { dnaRingRadiusPx, ladderOrbitRadiusPx, unlockRingRadiusPx } from '../effects/own-cell-geometry';
import type { IndicatorSpriteTexture, IndicatorTextures } from '../textures/indicator-textures';
import { endosymbiontTallies, pipBlockKey } from '../textures/pip-block-bake';

interface Centre {
  readonly x: number;
  readonly y: number;
}

/** A sprite the sheet places at a centre with a rotation (the orbit's ghosts and pip blocks). */
export interface PlacedSheetSprite extends Centre {
  readonly texture: IndicatorSpriteTexture;
  readonly tint: string;
  readonly rotation: number;
}

export interface SheetArcs {
  readonly arcs: readonly ArcInstance[];
  readonly sprites: readonly PlacedSheetSprite[];
}

const FULL_RING = 1;
const FROM_TWELVE_O_CLOCK = 0;
const OPAQUE = 1;
const SHEET = INDICATOR_SHEET.arcs;
const PALETTE = paletteFor(INDICATOR_SHEET.rimPaletteIndex);
const RUNG_SILHOUETTES: readonly string[] = Object.values(LADDER_SILHOUETTE);

function ring(
  centre: Centre,
  radiusPx: number,
  paint: Omit<ArcInstance, 'x' | 'y' | 'radiusPx' | 'startDeg'>,
): ArcInstance {
  return { ...centre, radiusPx, startDeg: FROM_TWELVE_O_CLOCK, ...paint };
}

/** A disc of body under a sample: a ring whose stroke is its own diameter. */
function bodyPatch(centre: Centre, radiusPx: number): ArcInstance {
  return ring(centre, radiusPx * HALF, { strokePx: radiusPx, sweep: FULL_RING, colour: PALETTE.base, alpha: OPAQUE });
}

/** The DNA ring's track (the fill's backing) and its fill, as §3.1.2 draws them. */
function dnaRing(centre: Centre, cellRadiusPx: number, fill: number): ArcInstance[] {
  const radiusPx = dnaRingRadiusPx(cellRadiusPx);
  const trackStrokePx = DNA_RING_STROKE_PX + DNA_RING_TRACK_PAD_PX * DIAMETER_PER_RADIUS;
  return [
    bodyPatch(centre, radiusPx + SHEET.dnaBodyPadPx),
    ring(centre, radiusPx, {
      strokePx: trackStrokePx,
      sweep: FULL_RING,
      colour: CALLOUT_BACKING,
      alpha: DNA_RING_TRACK_ALPHA,
    }),
    ring(centre, radiusPx, { strokePx: DNA_RING_STROKE_PX, sweep: fill, colour: DNA, alpha: OPAQUE }),
  ];
}

export function dnaRingSamples(): ArcInstance[] {
  return SHEET.dnaCellRadiiPx.flatMap((cellRadiusPx, row) =>
    SHEET.dnaFills.flatMap((fill, column) =>
      dnaRing(
        { x: SHEET.leftPx + column * SHEET.dnaPitchPx, y: SHEET.topPx + row * SHEET.dnaPitchPx },
        cellRadiusPx,
        fill,
      ),
    ),
  );
}

/** A prokaryote-era orbit: the envelope rung ghost at 180 and both counters full (decision #285 B). */
export function sampleOrbitLayout(): OrbitLayout {
  const counters = endosymbiontTallies().map((tally): LadderCounter => ({
    traitId: tally.traitId,
    variant: tally.variant,
    eaten: tally.required,
    required: tally.required,
    angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG[tally.variant as keyof typeof LADDER_ORBIT_ANGLES_PAIR_DEG],
    isGhostHidden: false,
    isUnlocked: true,
  }));
  const ghost = { silhouette: LADDER_SILHOUETTE.envelope, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG };
  return orbitLayout({ ghost, counters }, SHEET.orbitCellRadiusPx);
}

function orbitArcs(layout: OrbitLayout): ArcInstance[] {
  const centre = SHEET.orbitCentre;
  const backings = layout.backings.map((backing): ArcInstance => ({
    ...centre,
    radiusPx: layout.radiusPx,
    strokePx: LADDER_BACKING_PX,
    startDeg: backing.startDeg,
    sweep: (backing.endDeg - backing.startDeg) / DEGREES_PER_TURN,
    colour: CALLOUT_BACKING,
    alpha: LADDER_BACKING_ALPHA,
  }));
  const unlockRings = layout.ghosts
    .filter((ghost) => ghost.hasUnlockRing)
    .map((ghost) =>
      ring({ x: centre.x + ghost.x, y: centre.y + ghost.y }, unlockRingRadiusPx(), {
        strokePx: LADDER_UNLOCK_RING_STROKE_PX,
        sweep: FULL_RING,
        colour: LEVEL_GOLD,
        alpha: OPAQUE,
      }),
    );
  return [bodyPatch(centre, SHEET.orbitCellRadiusPx), ...backings, ...unlockRings];
}

function orbitSprites(layout: OrbitLayout, textures: IndicatorTextures): PlacedSheetSprite[] {
  const centre = SHEET.orbitCentre;
  const ghosts = layout.ghosts.map((ghost) => ({
    texture: textures.ghosts[ghost.key]!,
    tint: RUNG_SILHOUETTES.includes(ghost.key as LadderSilhouette) ? PALETTE.rim : WHITE,
    x: centre.x + ghost.x,
    y: centre.y + ghost.y,
    rotation: ghost.rotation,
  }));
  const pipBlocks = layout.pipBlocks.map((block) => ({
    texture: textures.pipBlocks[pipBlockKey(block.variant, block.eaten, block.required)]!,
    tint: WHITE,
    x: centre.x + block.x,
    y: centre.y + block.y,
    rotation: block.rotation,
  }));
  return [...ghosts, ...pipBlocks];
}

/** The escape window mid-drain on a max-mass cell: the danger track and the arc over it. */
export function escapeSample(): ArcInstance[] {
  const centre = SHEET.escapeCentre;
  const radiusPx = ladderOrbitRadiusPx(SHEET.escapeCellRadiusPx);
  const stroke = { strokePx: ESCAPE_ARC_STROKE_PX, colour: DANGER };
  return [
    bodyPatch(centre, SHEET.escapeCellRadiusPx),
    ring(centre, radiusPx, { ...stroke, sweep: FULL_RING, alpha: ESCAPE_ARC_TRACK_ALPHA }),
    ring(centre, radiusPx, { ...stroke, sweep: SHEET.escapeFill, alpha: OPAQUE }),
  ];
}

export function indicatorSheetArcs(textures: IndicatorTextures): SheetArcs {
  const layout = sampleOrbitLayout();
  return {
    arcs: [...dnaRingSamples(), ...orbitArcs(layout), ...escapeSample()],
    sprites: orbitSprites(layout, textures),
  };
}
