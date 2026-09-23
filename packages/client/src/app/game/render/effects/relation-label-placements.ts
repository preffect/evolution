// Where the relation labels sit (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): each on its own
// cell's relation ring, placed by `threatLabelPlacement`'s rule (the side facing the own cell, flipped past the orbit
// extent), upright, on the label pill of §6 rimmed in its role. Pure: the anchors come from the cell views and the
// ring the cell layer packs for them, so a label is never drawn on a ring that is not.

import type { CellView } from '@evolution/shared';
import type { LastViewOf } from '../cells/cell-effects';
import { relationRingOuterLinePx, relationRingPackingFor } from '../cells/cell-instance-builder';
import { cellLodFor } from '../cells/cell-lod';
import { WHITE } from '../constants';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import type { RelationLabel, RelationLabelRim } from '../../hud/format/relation-labels';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorLabelPlacement } from './own-cell-indicators';
import { threatLabelPlacement } from './threat-label-placement';

/** A labelled cell's centre in world units and its ring's outermost line in px. */
export interface RelationLabelAnchor {
  readonly label: RelationLabel;
  readonly x: number;
  readonly y: number;
  readonly ringPx: number;
}

export interface RelationLabelPlacement extends IndicatorLabelPlacement {
  readonly rim: RelationLabelRim;
}

export interface RelationAnchorInput {
  readonly indicators: OwnCellIndicators | null;
  readonly viewOf: LastViewOf;
  readonly zoom: number;
}

const NO_WARNING_RING = 0;

function anchorOf(label: RelationLabel | null, input: RelationAnchorInput): RelationLabelAnchor[] {
  const ring = label === null ? undefined : input.indicators?.relationRings.get(label.cellId);
  const view = label === null ? undefined : input.viewOf(label.cellId);
  if (label === null || ring === undefined || view === undefined) return [];
  const packing = relationRingPackingFor(ring, cellLodFor(view.radius * input.zoom), NO_WARNING_RING);
  if (packing.relationRingPx <= 0) return [];
  return [{ label, x: view.x, y: view.y, ringPx: relationRingOuterLinePx(packing) }];
}

/** The toxic label's anchor, then the edible one's; none for a label whose ring is not drawn this frame. */
export function relationLabelAnchorsFor(input: RelationAnchorInput): readonly RelationLabelAnchor[] {
  const labels = input.indicators?.relationLabels;
  if (labels === undefined) return [];
  return [...anchorOf(labels.toxic, input), ...anchorOf(labels.edible, input)];
}

export interface RelationLabelFrame {
  readonly anchors: readonly RelationLabelAnchor[];
  readonly ownCell: CellView;
  readonly zoom: number;
  /** The drawn width of a `label` text in CSS px. */
  readonly measureLabelPx: (text: string) => number;
}

/** Every anchored label as a pill placement in world units, upright at its px size. */
export function relationLabelPlacements(frame: RelationLabelFrame): RelationLabelPlacement[] {
  const { ownCell, zoom } = frame;
  const ownCentre = { x: ownCell.x * zoom, y: ownCell.y * zoom };
  return frame.anchors.map((anchor) => {
    const text = anchor.label.text.toUpperCase();
    const pillWidthPx = labelPillWidthPx(frame.measureLabelPx(text));
    const placed = threatLabelPlacement({
      threatCentre: { x: anchor.x * zoom, y: anchor.y * zoom },
      warningRingPx: anchor.ringPx,
      ownCentre,
      ownRadiusPx: ownCell.radius * zoom,
      pillWidthPx,
    });
    return { text, x: placed.x / zoom, y: placed.y / zoom, tint: WHITE, pillWidthPx, rim: anchor.label.rim };
  });
}
