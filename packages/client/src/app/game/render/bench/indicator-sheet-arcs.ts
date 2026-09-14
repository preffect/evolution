// The arc panel of the indicator contact sheet (docs/rendering/own-cell-indicators.md §10, #294 evidence): what the arc primitive
// draws, at the sizes review asked for. The DNA ring at 0 / 25 / 50 / 75 / 100 % on the floored 17 px ring and on
// a max-mass cell's 44.9 px ring; two ladder orbits with both counters full, so each counter ghost wears its ring:
// at 32 px beside the envelope ghost, where the backings merge, and a 24 px prokaryote, whose two backings stay
// apart with butt ends; the escape arc on a max-mass cell's 126 px orbit. Each sits on a patch of body drawn with
// the same primitive (a ring as wide as its radius is a disc). Pure: the rows and the placed sprites the sheet
// view draws, in the sheet's screen px (zoom 1).

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
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_ORBIT_ANGLE_SINGLE_DEG,
  LADDER_UNLOCK_RING_STROKE_PX,
  LEVEL_GOLD,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { paletteFor } from '../palette';
import { LADDER_SILHOUETTE, type LadderCounter, type LadderSilhouette } from '../../state/own-cell-indicators';
import { ARC_CAP, type ArcInstance } from '../effects/arc-instance';
import { orbitBackingArcs } from '../effects/orbit-backing-arcs';
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

export type OrbitSample = (typeof INDICATOR_SHEET.arcs.orbitSamples)[number];

const FULL_RING = 1;
const FROM_TWELVE_O_CLOCK = 0;
const OPAQUE = 1;
const SHEET = INDICATOR_SHEET.arcs;
const PALETTE = paletteFor(INDICATOR_SHEET.rimPaletteIndex);
const RUNG_SILHOUETTES: readonly string[] = Object.values(LADDER_SILHOUETTE);

/** A round-capped ring or arc from 12 o'clock: the DNA fill, the escape arc, the unlock ring, a body patch. */
function ring(
  centre: Centre,
  radiusPx: number,
  paint: Omit<ArcInstance, 'x' | 'y' | 'radiusPx' | 'startDeg' | 'cap'>,
): ArcInstance {
  return { ...centre, radiusPx, startDeg: FROM_TWELVE_O_CLOCK, cap: ARC_CAP.round, ...paint };
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

/** Both counters full (decision #285 B), beside the envelope rung ghost at 180 when the sample asks for it. */
export function sampleOrbitLayout(sample: OrbitSample): OrbitLayout {
  const counters = endosymbiontTallies().map((tally): LadderCounter => ({
    traitId: tally.traitId,
    variant: tally.variant,
    eaten: tally.required,
    required: tally.required,
    angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG[tally.variant as keyof typeof LADDER_ORBIT_ANGLES_PAIR_DEG],
    isGhostHidden: false,
    isUnlocked: true,
  }));
  const ghost = sample.hasRungGhost
    ? { silhouette: LADDER_SILHOUETTE.envelope, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG }
    : null;
  return orbitLayout({ ghost, counters }, sample.cellRadiusPx);
}

function orbitArcs(layout: OrbitLayout, sample: OrbitSample): ArcInstance[] {
  const { centre } = sample;
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
  return [bodyPatch(centre, sample.cellRadiusPx), ...orbitBackingArcs(layout, centre), ...unlockRings];
}

function orbitSprites(layout: OrbitLayout, textures: IndicatorTextures, centre: Centre): PlacedSheetSprite[] {
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
  const orbits = SHEET.orbitSamples.map((sample) => ({ sample, layout: sampleOrbitLayout(sample) }));
  return {
    arcs: [
      ...dnaRingSamples(),
      ...orbits.flatMap(({ sample, layout }) => orbitArcs(layout, sample)),
      ...escapeSample(),
    ],
    sprites: orbits.flatMap(({ sample, layout }) => orbitSprites(layout, textures, sample.centre)),
  };
}
