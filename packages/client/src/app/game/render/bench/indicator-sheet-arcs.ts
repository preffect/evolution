// The arc panel of the indicator contact sheet (docs/rendering/own-cell-indicators.md §10, #294 evidence): what the arc primitive
// draws, at the sizes review asked for. The DNA ring at 0 / 25 / 50 / 75 / 100 % on the floored 17 px ring and on
// a max-mass cell's 44.9 px ring; two ladder orbits with both counters full, so each counter ghost wears its ring:
// at 32 px beside the envelope ghost, where the backings merge, and a 24 px prokaryote, whose two backings stay
// apart with butt ends; the escape arc on a max-mass cell's 126 px orbit. Each sits on a patch of body drawn with
// the same primitive (a ring as wide as its radius is a disc). Pure: the rows and the placed sprites the sheet
// view draws, in the sheet's screen px (zoom 1), built by the live renderer's own builders (`own-cell-indicators.ts`).

import { ENGULF_PHASE } from '@evolution/shared';
import { DNA, INDICATOR_SHEET, LADDER_ORBIT_ANGLES_PAIR_DEG, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../constants';
import { HALF } from '../geometry';
import { paletteFor } from '../palette';
import { LADDER_SILHOUETTE, type LadderCounter } from '../../state/own-cell-ladder';
import type { ArcInstance } from '../effects/arc-instance';
import { orbitBackingArcs } from '../effects/orbit-backing-arcs';
import { orbitLayout, type OrbitLayout } from '../effects/orbit-layout';
import {
  dnaRingArcs,
  escapeArcs,
  orbitSpritePlacements,
  roundRing,
  unlockRingArcs,
} from '../effects/own-cell-indicators';
import { ladderOrbitRadiusPx } from '../effects/own-cell-geometry';
import type { IndicatorSpriteTexture, IndicatorTextures } from '../textures/indicator-textures';
import { endosymbiontTallies } from '../textures/pip-block-bake';

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
const OPAQUE = 1;
const SHEET_ZOOM = 1;
const SHEET = INDICATOR_SHEET.arcs;
const PALETTE = paletteFor(INDICATOR_SHEET.rimPaletteIndex);

/** A disc of body under a sample: a ring whose stroke is its own diameter. */
function bodyPatch(centre: Centre, radiusPx: number): ArcInstance {
  return roundRing(centre, radiusPx * HALF, {
    strokePx: radiusPx,
    sweep: FULL_RING,
    colour: PALETTE.base,
    alpha: OPAQUE,
  });
}

export function dnaRingSamples(): ArcInstance[] {
  return SHEET.dnaCellRadiiPx.flatMap((cellRadiusPx, row) =>
    SHEET.dnaFills.flatMap((fill, column) => {
      const centre = { x: SHEET.leftPx + column * SHEET.dnaPitchPx, y: SHEET.topPx + row * SHEET.dnaPitchPx };
      const ring = dnaRingArcs(centre, cellRadiusPx, { sweep: fill, colour: DNA, alpha: OPAQUE });
      return [bodyPatch(centre, ring[0]!.radiusPx + SHEET.dnaBodyPadPx), ...ring];
    }),
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
  return [
    bodyPatch(centre, sample.cellRadiusPx),
    ...orbitBackingArcs(layout, centre),
    ...unlockRingArcs(layout, { centre, zoom: SHEET_ZOOM }),
  ];
}

/** The escape window mid-drain on a max-mass cell: the danger track and the arc over it. */
export function escapeSample(): ArcInstance[] {
  const centre = SHEET.escapeCentre;
  const radiusPx = ladderOrbitRadiusPx(SHEET.escapeCellRadiusPx);
  return [
    bodyPatch(centre, SHEET.escapeCellRadiusPx),
    ...escapeArcs({ phase: ENGULF_PHASE.wrap, fill: SHEET.escapeFill }, centre, radiusPx),
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
    sprites: orbits.flatMap(({ sample, layout }) =>
      orbitSpritePlacements(layout, textures, { centre: sample.centre, zoom: SHEET_ZOOM, rimColour: PALETTE.rim }),
    ),
  };
}
