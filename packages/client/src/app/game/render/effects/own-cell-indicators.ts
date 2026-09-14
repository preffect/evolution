// The own cell's indicator placements (docs/rendering/own-cell-indicators.md §10, docs/ui/hud.md §3.1.2): the
// `OwnCellIndicators` record, the own view and the zoom turned into this frame's arc rows, atlas sprites and texts,
// in the effects layer's world units. The DNA ring and the level numeral always; the ladder orbit, or the escape
// arc and its label in the orbit's place while `being_engulfed`; the nearest threat's label on its warning ring.
// Everything sits in the own cell's undeformed frame (the view's centre and radius), so nothing bends with the
// membrane. Pure: `own-cell-indicators-layer.ts` pools the sprites, draws the rows and sets the texts. The ring,
// orbit and escape builders are exported for the indicator contact sheet, which draws the same things at zoom 1.

import { ENGULF_PHASE, type BalanceConfig, type CellView } from '@evolution/shared';
import {
  CALLOUT_BACKING,
  DANGER,
  DNA,
  DNA_RING_STROKE_PX,
  DNA_RING_TRACK_ALPHA,
  DNA_RING_TRACK_PAD_PX,
  ESCAPE_ARC_STROKE_PX,
  ESCAPE_ARC_TRACK_ALPHA,
  LABEL_PILL_HEIGHT_PX,
  LADDER_UNLOCK_RING_STROKE_PX,
  LEVEL_GOLD,
  THREAT_LABEL_GAP_PX,
  WHITE,
} from '../constants';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import { paletteFor } from '../palette';
import type { SpritePaint } from '../sprite-pool';
import type { LastViewOf } from '../cells/cell-effects';
import { warningRingPxFor } from '../cells/cell-instance-builder';
import { cellLodFor } from '../cells/cell-lod';
import { LADDER_SILHOUETTE, type OwnCellEscape, type OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorSpriteTexture, IndicatorTextures } from '../textures/indicator-textures';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import { pipBlockKey } from '../textures/pip-block-bake';
import { ARC_CAP, type ArcInstance } from './arc-instance';
import { orbitBackingArcs } from './orbit-backing-arcs';
import { orbitLayout, type OrbitLayout } from './orbit-layout';
import { dnaRingRadiusPx, ladderOrbitRadiusPx, unlockRingRadiusPx, type OrbitPoint } from './own-cell-geometry';
import { threatLabelPlacement } from './threat-label-placement';

/** The escape label's two readings (docs/ui/hud.md §3.1.2), uppercased by the `label` role when drawn. */
export const ESCAPE_LABEL = { window: 'Sprint to escape', sealed: 'Sealed' } as const;

const FULL_RING = 1;
const FROM_TWELVE_O_CLOCK = 0;
const OPAQUE = 1;
const NO_FLASH = 0;
const RUNG_GHOST_KEYS: readonly string[] = Object.values(LADDER_SILHOUETTE);

/** The nearest threat's centre in world units and the warning ring the cell layer draws on it. */
export interface ThreatAnchor {
  readonly x: number;
  readonly y: number;
  readonly warningRingPx: number;
}

/** An atlas sprite on the orbit: the pooled placement (`SpritePaint`, always opaque) plus its indicator texture. */
export interface IndicatorSpritePlacement extends Omit<SpritePaint, 'alpha'> {
  readonly texture: IndicatorSpriteTexture;
}

export interface IndicatorTextPlacement {
  readonly text: string;
  /** The text's centre in world units; it is drawn upright at its px size. */
  readonly x: number;
  readonly y: number;
  readonly tint: string;
}

export interface IndicatorLabelPlacement extends IndicatorTextPlacement {
  /** The whole pill under the text, in CSS px (`labelPillWidthPx` of the measured text). */
  readonly pillWidthPx: number;
}

export interface OwnCellIndicatorsFrame {
  readonly indicators: OwnCellIndicators;
  readonly ownCell: CellView;
  readonly zoom: number;
  /** The DNA ring's shown fill, tweened toward `indicators.dnaFraction` by the layer. */
  readonly dnaFill: number;
  /** The `level_up` clip's `ringFlash` track; 0 while no level-up plays. */
  readonly ringFlash: number;
  readonly threat: ThreatAnchor | null;
  readonly textures: Pick<IndicatorTextures, 'ghosts' | 'pipBlocks'>;
  /** The drawn width of a `label` text in CSS px (the layer's text view measures it). */
  readonly measureLabelPx: (text: string) => number;
}

export interface OwnCellIndicatorPlacements {
  readonly arcs: readonly ArcInstance[];
  readonly sprites: readonly IndicatorSpritePlacement[];
  readonly numeral: IndicatorTextPlacement;
  /** The escape label while `being_engulfed`, else the nearest threat's; `null` with neither. */
  readonly label: IndicatorLabelPlacement | null;
}

interface Centre {
  readonly x: number;
  readonly y: number;
}

/** Where the orbit is drawn: the cell's centre in world units, the zoom that turns its px into them, the rim tint. */
export interface OrbitFrame {
  readonly centre: Centre;
  readonly zoom: number;
  readonly rimColour: string;
}

export interface ThreatAnchorInput {
  readonly indicators: OwnCellIndicators | null;
  readonly viewOf: LastViewOf;
  readonly ownCell: CellView | null;
  readonly balance: Pick<BalanceConfig, 'absorption'>;
  readonly zoom: number;
}

/** The nearest threat's anchor: its view and drawn warning ring; `null` without a threat, or when no ring is drawn to anchor to. */
export function threatAnchorFor(input: ThreatAnchorInput): ThreatAnchor | null {
  const { ownCell, zoom } = input;
  const nearest = input.indicators?.nearestThreat ?? null;
  const view = nearest === null ? undefined : input.viewOf(nearest.cellId);
  if (view === undefined || ownCell === null) return null;
  const warningRingPx = warningRingPxFor(view, ownCell, input.balance, cellLodFor(view.radius * zoom));
  return warningRingPx > 0 ? { x: view.x, y: view.y, warningRingPx } : null;
}

/** A round-capped ring or arc from 12 o'clock: the DNA track and fill, the escape track and arc, an unlock ring. */
export function roundRing(
  centre: Centre,
  radiusPx: number,
  paint: Omit<ArcInstance, 'x' | 'y' | 'radiusPx' | 'startDeg' | 'cap'>,
): ArcInstance {
  return { ...centre, radiusPx, startDeg: FROM_TWELVE_O_CLOCK, cap: ARC_CAP.round, ...paint };
}

/** The DNA ring as §3.1.2 draws it: the callout-backing track, then the fill over it. */
export function dnaRingArcs(
  centre: Centre,
  cellRadiusPx: number,
  fill: Pick<ArcInstance, 'sweep' | 'colour' | 'alpha'>,
): ArcInstance[] {
  const radiusPx = dnaRingRadiusPx(cellRadiusPx);
  const trackStrokePx = DNA_RING_STROKE_PX + DNA_RING_TRACK_PAD_PX * DIAMETER_PER_RADIUS;
  return [
    roundRing(centre, radiusPx, {
      strokePx: trackStrokePx,
      sweep: FULL_RING,
      colour: CALLOUT_BACKING,
      alpha: DNA_RING_TRACK_ALPHA,
    }),
    roundRing(centre, radiusPx, { strokePx: DNA_RING_STROKE_PX, ...fill }),
  ];
}

/** The fill's paint: gold with the level-up flash, full gold at the top level, the tweened share in DNA otherwise. */
function dnaFillOf(frame: OwnCellIndicatorsFrame): Pick<ArcInstance, 'sweep' | 'colour' | 'alpha'> {
  if (frame.ringFlash > NO_FLASH) return { sweep: FULL_RING, colour: LEVEL_GOLD, alpha: frame.ringFlash };
  if (frame.indicators.isMaxLevel) return { sweep: FULL_RING, colour: LEVEL_GOLD, alpha: OPAQUE };
  return { sweep: frame.dnaFill, colour: DNA, alpha: OPAQUE };
}

/** A point on the orbit (px from the cell centre) as world units around `centre`. */
function offsetBy(centre: Centre, point: Centre, zoom: number): Centre {
  return { x: centre.x + point.x / zoom, y: centre.y + point.y / zoom };
}

/** The level-gold ring around every full counter's ghost. */
export function unlockRingArcs(layout: OrbitLayout, orbit: Omit<OrbitFrame, 'rimColour'>): ArcInstance[] {
  return layout.ghosts
    .filter((ghost) => ghost.hasUnlockRing)
    .map((ghost) =>
      roundRing(offsetBy(orbit.centre, ghost, orbit.zoom), unlockRingRadiusPx(), {
        strokePx: LADDER_UNLOCK_RING_STROKE_PX,
        sweep: FULL_RING,
        colour: LEVEL_GOLD,
        alpha: OPAQUE,
      }),
    );
}

function spriteAt(
  texture: IndicatorSpriteTexture,
  point: OrbitPoint,
  orbit: Omit<OrbitFrame, 'rimColour'>,
  tint: string,
): IndicatorSpritePlacement {
  const { zoom } = orbit;
  const position = offsetBy(orbit.centre, point, zoom);
  return {
    texture,
    ...position,
    widthWu: texture.widthPx / zoom,
    heightWu: texture.heightPx / zoom,
    rotation: point.rotation,
    tint,
  };
}

/** The orbit's ghosts (the rung ghosts tinted the rim colour, the counters' in their own) and pip blocks. */
export function orbitSpritePlacements(
  layout: OrbitLayout,
  textures: Pick<IndicatorTextures, 'ghosts' | 'pipBlocks'>,
  orbit: OrbitFrame,
): IndicatorSpritePlacement[] {
  const ghosts = layout.ghosts.flatMap((ghost) => {
    const texture = textures.ghosts[ghost.key];
    const tint = RUNG_GHOST_KEYS.includes(ghost.key) ? orbit.rimColour : WHITE;
    return texture === undefined ? [] : [spriteAt(texture, ghost, orbit, tint)];
  });
  const pipBlocks = layout.pipBlocks.flatMap((block) => {
    const texture = textures.pipBlocks[pipBlockKey(block.variant, block.eaten, block.required)];
    return texture === undefined ? [] : [spriteAt(texture, block, orbit, WHITE)];
  });
  return [...ghosts, ...pipBlocks];
}

/** The escape window on the orbit's radius: a draining arc over a faint track, or the track alone and solid once sealed. */
export function escapeArcs(
  escape: Pick<OwnCellEscape, 'phase' | 'fill'>,
  centre: Centre,
  radiusPx: number,
): ArcInstance[] {
  const isSealed = escape.phase === ENGULF_PHASE.absorb;
  const stroke = { strokePx: ESCAPE_ARC_STROKE_PX, colour: DANGER };
  const track = roundRing(centre, radiusPx, {
    ...stroke,
    sweep: FULL_RING,
    alpha: isSealed ? OPAQUE : ESCAPE_ARC_TRACK_ALPHA,
  });
  return isSealed ? [track] : [track, roundRing(centre, radiusPx, { ...stroke, sweep: escape.fill, alpha: OPAQUE })];
}

function labelOf(text: string, position: Centre, frame: OwnCellIndicatorsFrame): IndicatorLabelPlacement {
  const upper = text.toUpperCase();
  return { text: upper, ...position, tint: WHITE, pillWidthPx: labelPillWidthPx(frame.measureLabelPx(upper)) };
}

/** `THREAT_LABEL_GAP_PX` above the escape arc: `SPRINT TO ESCAPE`, then `SEALED` from the seal on. */
function escapeLabel(escape: OwnCellEscape, centre: Centre, radiusPx: number, frame: OwnCellIndicatorsFrame) {
  const text = escape.phase === ENGULF_PHASE.absorb ? ESCAPE_LABEL.sealed : ESCAPE_LABEL.window;
  const abovePx = radiusPx + ESCAPE_ARC_STROKE_PX * HALF + THREAT_LABEL_GAP_PX + LABEL_PILL_HEIGHT_PX * HALF;
  return labelOf(text, { x: centre.x, y: centre.y - abovePx / frame.zoom }, frame);
}

/** The nearest threat's label on its warning ring, near side or far side (`threatLabelPlacement`, in px). */
function threatLabel(frame: OwnCellIndicatorsFrame, centre: Centre, cellRadiusPx: number) {
  const { threat, zoom } = frame;
  const nearest = frame.indicators.nearestThreat;
  if (threat === null || nearest === null) return null;
  const draft = labelOf(nearest.label, centre, frame);
  const placed = threatLabelPlacement({
    threatCentre: { x: threat.x * zoom, y: threat.y * zoom },
    warningRingPx: threat.warningRingPx,
    ownCentre: { x: centre.x * zoom, y: centre.y * zoom },
    ownRadiusPx: cellRadiusPx,
    pillWidthPx: draft.pillWidthPx,
  });
  return { ...draft, x: placed.x / zoom, y: placed.y / zoom };
}

export function ownCellIndicatorPlacements(frame: OwnCellIndicatorsFrame): OwnCellIndicatorPlacements {
  const { indicators, ownCell, zoom } = frame;
  const centre = { x: ownCell.x, y: ownCell.y };
  const cellRadiusPx = ownCell.radius * zoom;
  const numeral = { text: String(indicators.level), ...centre, tint: frame.ringFlash > NO_FLASH ? LEVEL_GOLD : WHITE };
  const dnaRing = dnaRingArcs(centre, cellRadiusPx, dnaFillOf(frame));
  if (indicators.escape !== null) {
    const radiusPx = ladderOrbitRadiusPx(cellRadiusPx);
    return {
      arcs: [...dnaRing, ...escapeArcs(indicators.escape, centre, radiusPx)],
      sprites: [],
      numeral,
      label: escapeLabel(indicators.escape, centre, radiusPx, frame),
    };
  }
  const layout = orbitLayout(indicators.ladder, cellRadiusPx);
  const orbit = { centre, zoom, rimColour: paletteFor(ownCell.avatarIndex).rim };
  return {
    arcs: [...dnaRing, ...orbitBackingArcs(layout, centre), ...unlockRingArcs(layout, orbit)],
    sprites: orbitSpritePlacements(layout, frame.textures, orbit),
    numeral,
    label: threatLabel(frame, centre, cellRadiusPx),
  };
}
