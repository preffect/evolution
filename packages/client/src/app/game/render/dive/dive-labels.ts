// The dive's labels (docs/rendering/opening-dive.md §5): place names pinned to the turning planet and things pinned
// to the world in metres, each with an amber dot and a text on a dark box, fading in and out over its zoom range.
// Pure: the panel draws them in the DOM from what this answers.

import {
  DIVE_GEO_LABELS,
  DIVE_GEO_LABEL_FADE,
  DIVE_GEO_LABEL_MAX_ARC_RADIANS,
  DIVE_LABEL_BOX,
  DIVE_LABEL_CHARACTER_WIDTH_PX,
  DIVE_LABEL_CULL_PX,
  DIVE_LABEL_EDGE_PX,
  DIVE_LABEL_FADE_ZOOM,
  DIVE_LABEL_FLIP_GAP_PX,
  DIVE_LABEL_OFFSET_PX,
  DIVE_LABEL_PADDING_PX,
  DIVE_READOUT_KEEP_OUT_PX,
  DIVE_WORLD_LABELS,
  EARTH_RADIUS_M,
  type DiveGeoLabel,
  type DiveLabelRange,
} from '../constants';
import { clamp01, degreesToRadians } from '../geometry';
import { diveScreenPoint, type DiveCamera, type DivePoint } from './dive-camera';

export interface DiveLabelPlacement {
  readonly text: string;
  readonly alpha: number;
  /** The dot, in CSS px from the view's top-left. */
  readonly dotX: number;
  readonly dotY: number;
  /** The backing box's top-left. */
  readonly boxX: number;
  readonly boxY: number;
}

/** A label's fade over its range: 0 outside it, 1 a `DIVE_LABEL_FADE_ZOOM` inside both ends (`labelAlpha`). */
export function diveLabelAlpha(range: DiveLabelRange, zoom: number): number {
  return clamp01(
    Math.min((zoom - range.nearZoom) / DIVE_LABEL_FADE_ZOOM, (range.farZoom - zoom) / DIVE_LABEL_FADE_ZOOM),
  );
}

/** The planet's place names fade out as the planet gives way to the map (`geoA`). */
export function diveGeoLabelFade(zoom: number): number {
  return clamp01((zoom - DIVE_GEO_LABEL_FADE.fromZoom) / DIVE_GEO_LABEL_FADE.spanZoom);
}

interface GlobeView {
  readonly centreLongitude: number;
  readonly centreLatitude: number;
}

/** The view centre the rotation turns to: d3's `rotate([λ, φ])` looks at `(−λ, −φ)`. */
function globeViewOf(rotation: readonly [number, number]): GlobeView {
  return { centreLongitude: degreesToRadians(-rotation[0]), centreLatitude: degreesToRadians(-rotation[1]) };
}

/** The great-circle angle between the label and the view centre (`d3.geoDistance`). */
export function arcFromCentre(label: DiveGeoLabel, view: GlobeView): number {
  const latitude = degreesToRadians(label.latitude);
  const cosine =
    Math.sin(view.centreLatitude) * Math.sin(latitude) +
    Math.cos(view.centreLatitude) *
      Math.cos(latitude) *
      Math.cos(degreesToRadians(label.longitude) - view.centreLongitude);
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

/** The label's point on the orthographic globe, in metres from the view centre (x east, y south). */
function globePoint(label: DiveGeoLabel, view: GlobeView): DivePoint {
  const latitude = degreesToRadians(label.latitude);
  const deltaLongitude = degreesToRadians(label.longitude) - view.centreLongitude;
  const east = Math.cos(latitude) * Math.sin(deltaLongitude);
  const north =
    Math.cos(view.centreLatitude) * Math.sin(latitude) -
    Math.sin(view.centreLatitude) * Math.cos(latitude) * Math.cos(deltaLongitude);
  return { x: east * EARTH_RADIUS_M, y: -north * EARTH_RADIUS_M };
}

function isNearView(camera: DiveCamera, dot: DivePoint): boolean {
  const { width, height } = camera.viewport;
  return (
    dot.x >= -DIVE_LABEL_CULL_PX.x &&
    dot.x <= width + DIVE_LABEL_CULL_PX.x &&
    dot.y >= -DIVE_LABEL_CULL_PX.y &&
    dot.y <= height + DIVE_LABEL_CULL_PX.y
  );
}

/** The text right of and above its dot, flipped left at the right edge and kept inside the view (`drawLabel`). */
export function placeDiveLabel(camera: DiveCamera, text: string, alpha: number, dot: DivePoint): DiveLabelPlacement {
  const { width, height } = camera.viewport;
  const textWidth = text.length * DIVE_LABEL_CHARACTER_WIDTH_PX;
  let textX = dot.x + DIVE_LABEL_OFFSET_PX;
  if (textX + textWidth + DIVE_LABEL_PADDING_PX > width - DIVE_LABEL_EDGE_PX.side) {
    textX = dot.x - DIVE_LABEL_OFFSET_PX - textWidth - DIVE_LABEL_FLIP_GAP_PX;
  }
  const rightmost = Math.max(DIVE_LABEL_EDGE_PX.side, width - textWidth - DIVE_LABEL_PADDING_PX);
  textX = Math.min(rightmost, Math.max(DIVE_LABEL_EDGE_PX.side, textX));
  const baseline = Math.min(
    height - DIVE_LABEL_EDGE_PX.side,
    Math.max(DIVE_LABEL_EDGE_PX.top, dot.y - DIVE_LABEL_OFFSET_PX),
  );
  return {
    text,
    alpha,
    dotX: dot.x,
    dotY: dot.y,
    boxX: textX - DIVE_LABEL_BOX.sidePx,
    boxY: boxTopClearOfReadout(textX - DIVE_LABEL_BOX.sidePx, baseline - DIVE_LABEL_BOX.ascentPx, width),
  };
}

/** A box that would sit in the readout's corner moves down below it (`DIVE_READOUT_KEEP_OUT_PX`). */
export function boxTopClearOfReadout(boxX: number, boxTop: number, stageWidth: number): number {
  const isOnReadout =
    boxX < Math.min(stageWidth, DIVE_READOUT_KEEP_OUT_PX.right) && boxTop < DIVE_READOUT_KEEP_OUT_PX.bottom;
  return isOnReadout ? DIVE_READOUT_KEEP_OUT_PX.bottom : boxTop;
}

export interface DiveLabelInputs {
  readonly camera: DiveCamera;
  readonly globeRotation: readonly [number, number];
  /** The planar world's fade over the globe: the shore band's weight. */
  readonly worldWeight: number;
}

/** The labels of one kind on screen: each one's fade, then its dot, culled near the view and placed. */
function placementsOf<Label extends { readonly text: string; readonly range: DiveLabelRange }>(
  camera: DiveCamera,
  labels: readonly Label[],
  place: { readonly fade: number; readonly dotOf: (label: Label) => DivePoint | null },
): DiveLabelPlacement[] {
  const placements: DiveLabelPlacement[] = [];
  for (const label of labels) {
    const alpha = diveLabelAlpha(label.range, camera.zoom) * place.fade;
    const dot = alpha > 0 ? place.dotOf(label) : null;
    if (dot !== null && isNearView(camera, dot)) placements.push(placeDiveLabel(camera, label.text, alpha, dot));
  }
  return placements;
}

function geoPlacements(inputs: DiveLabelInputs): DiveLabelPlacement[] {
  const { camera } = inputs;
  const view = globeViewOf(inputs.globeRotation);
  return placementsOf(camera, DIVE_GEO_LABELS, {
    fade: diveGeoLabelFade(camera.zoom),
    // A place on the far side of the planet is not drawn (`d3.geoDistance` > 1.4).
    dotOf: (label) =>
      arcFromCentre(label, view) > DIVE_GEO_LABEL_MAX_ARC_RADIANS
        ? null
        : diveScreenPoint(camera, globePoint(label, view)),
  });
}

function worldPlacements(inputs: DiveLabelInputs): DiveLabelPlacement[] {
  const { camera } = inputs;
  return placementsOf(camera, DIVE_WORLD_LABELS, {
    fade: inputs.worldWeight,
    dotOf: (label) => diveScreenPoint(camera, label),
  });
}

/** Every label on screen at this camera, the planet's first. */
export function diveLabelPlacements(inputs: DiveLabelInputs): readonly DiveLabelPlacement[] {
  return [...geoPlacements(inputs), ...worldPlacements(inputs)];
}
