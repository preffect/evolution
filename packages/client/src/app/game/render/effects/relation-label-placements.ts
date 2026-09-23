// Where the relation labels sit (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): each reaching out
// from its own cell's relation ring on the first side clear of every other ring and every label already placed
// (`relation-label-fit.ts`), upright, on the label pill of §6 rimmed in its role; dropped for the frame when no side is
// clear. Pure: the rings come from the cell views and the ring the cell layer packs for them, so a label is never
// drawn on a ring that is not, and never judged against a ring that is not drawn.

import type { CellView, EntityId } from '@evolution/shared';
import type { LastViewOf } from '../cells/cell-effects';
import { relationRingOuterLinePx, relationRingPackingFor } from '../cells/cell-instance-builder';
import { cellLodFor } from '../cells/cell-lod';
import { LABEL_PILL_HEIGHT_PX, RELATION_RING_STROKE_PX, WARNING_RING_STROKE_PX, WHITE } from '../constants';
import { HALF, type Disc, type UprightBox } from '../geometry';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import type { RelationLabel, RelationLabelRim } from '../../hud/format/relation-labels';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorLabelPlacement, ThreatAnchor } from './own-cell-indicators';
import { relationLabelFit } from './relation-label-fit';

/** A drawn relation ring: its cell's centre in world units and its outermost line in px. */
export interface DrawnRelationRing {
  readonly cellId: EntityId;
  readonly x: number;
  readonly y: number;
  readonly ringPx: number;
}

/** A labelled cell's drawn ring and the label it carries. */
export interface RelationLabelAnchor extends DrawnRelationRing {
  readonly label: RelationLabel;
}

/** Every relation ring drawn this frame and the labels to place on them (toxic first). */
export interface RelationLabelScene {
  readonly rings: readonly DrawnRelationRing[];
  readonly anchors: readonly RelationLabelAnchor[];
}

export const NO_RELATION_LABEL_SCENE: RelationLabelScene = { rings: [], anchors: [] };

export interface RelationLabelPlacement extends IndicatorLabelPlacement {
  readonly rim: RelationLabelRim;
}

export interface RelationSceneInput {
  readonly indicators: OwnCellIndicators | null;
  readonly viewOf: LastViewOf;
  readonly zoom: number;
}

const NO_WARNING_RING = 0;

function drawnRings(input: RelationSceneInput): DrawnRelationRing[] {
  const rings: DrawnRelationRing[] = [];
  for (const [cellId, ring] of input.indicators?.relationRings ?? []) {
    const view = input.viewOf(cellId);
    if (view === undefined) continue;
    const packing = relationRingPackingFor(ring, cellLodFor(view.radius * input.zoom), NO_WARNING_RING);
    if (packing.relationRingPx > 0)
      rings.push({ cellId, x: view.x, y: view.y, ringPx: relationRingOuterLinePx(packing) });
  }
  return rings;
}

/** The drawn rings, and the toxic then the edible label on theirs; none for a label whose ring is not drawn. */
export function relationLabelSceneFor(input: RelationSceneInput): RelationLabelScene {
  const labels = input.indicators?.relationLabels;
  if (labels === undefined) return NO_RELATION_LABEL_SCENE;
  const rings = drawnRings(input);
  const anchors = [labels.toxic, labels.edible].flatMap((label) => {
    const ring = label === null ? undefined : rings.find((drawn) => drawn.cellId === label.cellId);
    return label === null || ring === undefined ? [] : [{ ...ring, label }];
  });
  return { rings, anchors };
}

export interface RelationLabelFrame {
  readonly scene: RelationLabelScene;
  readonly ownCell: CellView;
  readonly zoom: number;
  /** The threat's warning ring, which a relation pill keeps clear of like any other ring. */
  readonly threat: ThreatAnchor | null;
  /** The threat or escape label, placed first; the relation labels yield to it. */
  readonly placedLabel: IndicatorLabelPlacement | null;
  /** Where the own cell's cue column rests, px in the own cell's frame; a relation label keeps off it. */
  readonly cueColumn: UprightBox | null;
  /** The drawn width of a `label` text in CSS px. */
  readonly measureLabelPx: (text: string) => number;
}

function labelBoxPx(label: IndicatorLabelPlacement, zoom: number): UprightBox {
  return {
    x: label.x * zoom,
    y: label.y * zoom,
    halfWidth: label.pillWidthPx * HALF,
    halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
  };
}

/** Every drawn ring but `cellId`'s as the disc it covers, px, the threat's warning ring included. */
function ringDiscsPx(frame: RelationLabelFrame, cellId: EntityId): Disc[] {
  const { zoom, threat } = frame;
  const discs = frame.scene.rings
    .filter((ring) => ring.cellId !== cellId)
    .map((ring) => ({ x: ring.x * zoom, y: ring.y * zoom, radius: ring.ringPx + RELATION_RING_STROKE_PX * HALF }));
  if (threat === null) return discs;
  const threatRadius = threat.warningRingPx + WARNING_RING_STROKE_PX * HALF;
  return [...discs, { x: threat.x * zoom, y: threat.y * zoom, radius: threatRadius }];
}

/** Every label that fits, as a pill placement in world units; each one placed becomes an obstacle for the next. */
export function relationLabelPlacements(frame: RelationLabelFrame): RelationLabelPlacement[] {
  const { ownCell, zoom } = frame;
  const placedBoxes = frame.placedLabel === null ? [] : [labelBoxPx(frame.placedLabel, zoom)];
  const { cueColumn } = frame;
  if (cueColumn !== null)
    placedBoxes.push({ ...cueColumn, x: cueColumn.x + ownCell.x * zoom, y: cueColumn.y + ownCell.y * zoom });
  const placements: RelationLabelPlacement[] = [];
  for (const anchor of frame.scene.anchors) {
    const text = anchor.label.text.toUpperCase();
    const pillWidthPx = labelPillWidthPx(frame.measureLabelPx(text));
    const box = relationLabelFit({
      cellCentre: { x: anchor.x * zoom, y: anchor.y * zoom },
      ringPx: anchor.ringPx,
      ownCentre: { x: ownCell.x * zoom, y: ownCell.y * zoom },
      ownRadiusPx: ownCell.radius * zoom,
      pillWidthPx,
      rings: ringDiscsPx(frame, anchor.cellId),
      placed: placedBoxes,
    });
    if (box === null) continue;
    placedBoxes.push(box);
    placements.push({ text, x: box.x / zoom, y: box.y / zoom, tint: WHITE, pillWidthPx, rim: anchor.label.rim });
  }
  return placements;
}
