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
  DIVE_LABEL_SIDE_GAP_PX,
  DIVE_LABEL_STACK_GAP_PX,
  DIVE_READOUT_KEEP_OUT_PX,
  DIVE_WORLD_LABELS,
  EARTH_RADIUS_M,
  type DiveGeoLabel,
  type DiveLabelRange,
  type DiveWorldLabel,
} from '../constants';
import { clamp01, degreesToRadians } from '../geometry';
import { diveScreenPoint, type DiveCamera, type DivePoint } from './dive-camera';

export interface DiveLabelPlacement {
  readonly text: string;
  readonly alpha: number;
  /** The dot, in CSS px from the view's top-left. */
  readonly dotX: number;
  readonly dotY: number;
  /** The backing box's top-left, and its width. */
  readonly boxX: number;
  readonly boxY: number;
  readonly boxWidth: number;
}

/** The readout's box on the stage, from its top-left corner: no label's box may start inside it. */
export interface DiveReadoutKeepOut {
  readonly right: number;
  readonly bottom: number;
}

/** What the panel has measured on the stage; each falls back to the constants until it has. */
export interface DiveLabelLayout {
  /** The readout's box; `DIVE_READOUT_KEEP_OUT_PX` until measured. */
  readonly readout?: DiveReadoutKeepOut;
  /** Each label's backing box as rendered, in CSS px by its text; estimated from its length until measured. */
  readonly boxWidths?: ReadonlyMap<string, number>;
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

/** A label to place: its text, its fade and its dot on screen. */
export interface DiveLabelAtDot {
  readonly text: string;
  readonly alpha: number;
  readonly dot: DivePoint;
}

/** A box's sides: its padding on the left and on the right of the text. */
const BOX_SIDES = 2;
const BOX_PADDING_PX = DIVE_LABEL_BOX.sidePx * BOX_SIDES;

/** A label's backing box width: as the panel measured it, else estimated from the text's length. */
export function diveLabelBoxWidth(text: string, boxWidths?: ReadonlyMap<string, number>): number {
  return boxWidths?.get(text) ?? text.length * DIVE_LABEL_CHARACTER_WIDTH_PX + BOX_PADDING_PX;
}

/**
 * The text right of and above its dot, flipped left at the right edge and kept inside the view (`drawLabel`), and
 * below the readout in its corner.
 */
export function placeDiveLabel(
  camera: DiveCamera,
  label: DiveLabelAtDot,
  layout: DiveLabelLayout = {},
): DiveLabelPlacement {
  const { text, alpha, dot } = label;
  const { width, height } = camera.viewport;
  const readout = layout.readout ?? DIVE_READOUT_KEEP_OUT_PX;
  const boxWidth = diveLabelBoxWidth(text, layout.boxWidths);
  const textWidth = boxWidth - BOX_PADDING_PX;
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
    boxY: boxTopClearOfReadout(textX - DIVE_LABEL_BOX.sidePx, baseline - DIVE_LABEL_BOX.ascentPx, {
      right: Math.min(width, readout.right),
      bottom: readout.bottom,
    }),
    boxWidth,
  };
}

/** A box that would sit in the readout's corner moves down below it. */
export function boxTopClearOfReadout(boxX: number, boxTop: number, readout: DiveReadoutKeepOut): number {
  return boxX < readout.right && boxTop < readout.bottom ? readout.bottom : boxTop;
}

interface LabelBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

function boxOf(placement: DiveLabelPlacement, top: number): LabelBox {
  const left = placement.boxX;
  return { left, right: left + placement.boxWidth, top };
}

/**
 * Two boxes too close to read apart: less than the side gap apart across, and their tops less than a box and the
 * stacking gap apart down.
 */
function isCrowding(first: LabelBox, second: LabelBox): boolean {
  const pitch = DIVE_LABEL_BOX.heightPx + DIVE_LABEL_STACK_GAP_PX;
  return (
    first.left < second.right + DIVE_LABEL_SIDE_GAP_PX &&
    second.left < first.right + DIVE_LABEL_SIDE_GAP_PX &&
    first.top < second.top + pitch &&
    second.top < first.top + pitch
  );
}

/**
 * Labels whose boxes would overlap stack (ticket #805): taken top first, each moves down under any box already set
 * that it would print over, so two things in the same spot (the dish and a diatom; two labels the readout pushed
 * down to the same line) both read. The dots stay where they are. Answers the placements in their own order.
 */
export function stackDiveLabels(placements: readonly DiveLabelPlacement[]): readonly DiveLabelPlacement[] {
  const order = [...placements.keys()].sort((first, second) => {
    const byTop = placements[first]!.boxY - placements[second]!.boxY;
    return byTop === 0 ? first - second : byTop;
  });
  const set: LabelBox[] = [];
  const stacked = [...placements];
  for (const index of order) {
    const placement = placements[index]!;
    let box = boxOf(placement, placement.boxY);
    let crowded = set.find((other) => isCrowding(other, box));
    // Each move is strictly down, past a box already set, so this ends within as many moves as boxes set.
    while (crowded !== undefined) {
      box = boxOf(placement, crowded.top + DIVE_LABEL_BOX.heightPx + DIVE_LABEL_STACK_GAP_PX);
      crowded = set.find((other) => isCrowding(other, box));
    }
    set.push(box);
    stacked[index] = box.top === placement.boxY ? placement : { ...placement, boxY: box.top };
  }
  return stacked;
}

export interface DiveLabelInputs extends DiveLabelLayout {
  readonly camera: DiveCamera;
  readonly globeRotation: readonly [number, number];
  /** The planar world's fade over the globe: the shore band's weight. */
  readonly worldWeight: number;
  /** The slime band's pictures have landed; until then the labels that name them are hidden (absent: landed). */
  readonly hasSlimePictures?: boolean;
}

/** The labels of one kind on screen: each one's fade, then its dot, culled near the view and placed. */
function placementsOf<Label extends { readonly text: string; readonly range: DiveLabelRange }>(
  inputs: DiveLabelInputs,
  labels: readonly Label[],
  place: { readonly fade: number; readonly dotOf: (label: Label) => DivePoint | null },
): DiveLabelPlacement[] {
  const { camera } = inputs;
  const placements: DiveLabelPlacement[] = [];
  for (const label of labels) {
    const alpha = diveLabelAlpha(label.range, camera.zoom) * place.fade;
    const dot = alpha > 0 ? place.dotOf(label) : null;
    if (dot !== null && isNearView(camera, dot)) {
      placements.push(placeDiveLabel(camera, { text: label.text, alpha, dot }, inputs));
    }
  }
  return placements;
}

function geoPlacements(inputs: DiveLabelInputs): DiveLabelPlacement[] {
  const { camera } = inputs;
  const view = globeViewOf(inputs.globeRotation);
  return placementsOf(inputs, DIVE_GEO_LABELS, {
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
  const isShown = (label: DiveWorldLabel): boolean =>
    label.isSlimePictured !== true || inputs.hasSlimePictures !== false;
  return placementsOf(inputs, DIVE_WORLD_LABELS.filter(isShown), {
    fade: inputs.worldWeight,
    dotOf: (label) => diveScreenPoint(camera, label),
  });
}

/** Every label on screen at this camera, the planet's first, stacked where two would overlap. */
export function diveLabelPlacements(inputs: DiveLabelInputs): readonly DiveLabelPlacement[] {
  return stackDiveLabels([...geoPlacements(inputs), ...worldPlacements(inputs)]);
}
