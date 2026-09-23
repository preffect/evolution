// Where the legibility cues sit (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): the mass chip,
// the rate-tag column, the zone pill and a new floater's column, in screen px in the own cell's undeformed frame
// (origin the cell centre, x right, y down). Pure. Overlaps resolve by §3.1.5's fixed order: labels (the threat's,
// placed by `threatLabelPlacement`, and the escape label) are placed first and never move for a cue; the mass chip
// rises past any label box it meets, the rate tags with it; the zone pill, the least urgent fact, hides while any
// label box meets it; a floater starts its column past every box it would cross.

import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_ROW_GAP_PX,
  FLOATER_MAX_VISIBLE,
  FLOATER_RISE_PX,
  LABEL_PILL_HEIGHT_PX,
} from '../constants';
import { HALF, boxesIntersect, type UprightBox } from '../geometry';
import { ladderOrbitExtentPx, selfRingRadiusPx } from './own-cell-geometry';

export interface CueLayoutInput {
  /** The own cell's on-screen radius, `r_px`. */
  readonly rPx: number;
  /** The chip's whole pill width (text, glyph and pads). */
  readonly chipWidthPx: number;
  /** Each shown rate tag's pill width, nearest the chip first. */
  readonly tagWidthsPx: readonly number[];
  /** The zone pill's width while its text is up; `null` otherwise. */
  readonly zonePillWidthPx: number | null;
  /** The label pills already placed on screen, in the same frame. */
  readonly labelBoxes: readonly UprightBox[];
}

export interface CueLayout {
  /** Above the self ring, or above the label boxes it would meet there. */
  readonly chip: UprightBox;
  /** Nearest the chip first, stacked upward. */
  readonly tags: readonly UprightBox[];
  /** `null` while it has no text or while a label box meets it. */
  readonly zonePill: UprightBox | null;
}

const CUE_HALF_HEIGHT = CUE_PILL_HEIGHT_PX * HALF;
const CUE_ROW_PITCH_PX = CUE_PILL_HEIGHT_PX + CUE_ROW_GAP_PX;

/** The chip's bottom edge sits `CUE_GAP_PX` above the self ring. */
function chipBox(rPx: number, widthPx: number): UprightBox {
  const bottom = -(selfRingRadiusPx(rPx) + CUE_GAP_PX);
  return { x: 0, y: bottom - CUE_HALF_HEIGHT, halfWidth: widthPx * HALF, halfHeight: CUE_HALF_HEIGHT };
}

/** The chip raised past every label box it meets, lowest first, until its bottom edge is `CUE_GAP_PX` above each. */
function chipClearOfLabels(chip: UprightBox, labelBoxes: readonly UprightBox[]): UprightBox {
  const lowestFirst = [...labelBoxes].sort((first, second) => second.y - first.y);
  return lowestFirst.reduce(
    (placed, label) =>
      boxesIntersect(label, placed)
        ? { ...placed, y: label.y - label.halfHeight - CUE_GAP_PX - placed.halfHeight }
        : placed,
    chip,
  );
}

/** The zone pill's top edge sits `CUE_GAP_PX` below the orbit extent; it is a label pill (§6), not a cue pill. */
function zonePillBox(rPx: number, widthPx: number): UprightBox {
  const halfHeight = LABEL_PILL_HEIGHT_PX * HALF;
  return { x: 0, y: ladderOrbitExtentPx(rPx) + CUE_GAP_PX + halfHeight, halfWidth: widthPx * HALF, halfHeight };
}

export function cueLayout(input: CueLayoutInput): CueLayout {
  const chip = chipClearOfLabels(chipBox(input.rPx, input.chipWidthPx), input.labelBoxes);
  const tags = input.tagWidthsPx.map((widthPx, row) => ({
    x: 0,
    y: chip.y - CUE_ROW_PITCH_PX * (row + 1),
    halfWidth: widthPx * HALF,
    halfHeight: CUE_HALF_HEIGHT,
  }));
  const zone = input.zonePillWidthPx === null ? null : zonePillBox(input.rPx, input.zonePillWidthPx);
  const isZoneCovered = zone !== null && input.labelBoxes.some((label) => boxesIntersect(label, zone));
  return { chip, tags, zonePill: isZoneCovered ? null : zone };
}

/**
 * The chip and its rate tags as one box: where the cue column rests when no label moves it. The relation labels keep
 * off it (docs/rendering/own-cell-indicators.md §10), so a relation label never pushes the chip up over a cell.
 */
export function cueColumnBox(layout: Pick<CueLayout, 'chip' | 'tags'>): UprightBox {
  const boxes = [layout.chip, ...layout.tags];
  const left = Math.min(...boxes.map((box) => box.x - box.halfWidth));
  const right = Math.max(...boxes.map((box) => box.x + box.halfWidth));
  const top = Math.min(...boxes.map((box) => box.y - box.halfHeight));
  const bottom = Math.max(...boxes.map((box) => box.y + box.halfHeight));
  return {
    x: (left + right) * HALF,
    y: (top + bottom) * HALF,
    halfWidth: (right - left) * HALF,
    halfHeight: (bottom - top) * HALF,
  };
}

/** The top of the full rate-tag column (`rows` tags over the chip), px above the centre: §3.1.5's notice inequality. */
export function rateTagColumnTopPx(rPx: number, rows: number): number {
  return selfRingRadiusPx(rPx) + CUE_GAP_PX + CUE_PILL_HEIGHT_PX + rows * CUE_ROW_PITCH_PX;
}

/** The span a floater column may cover while it lives: from its first bottom edge up past every push and its rise. */
export function floaterColumnSpan(): { readonly top: number; readonly bottom: number } {
  const pushes = FLOATER_MAX_VISIBLE - 1;
  return { top: -(CUE_GAP_PX + CUE_PILL_HEIGHT_PX + FLOATER_RISE_PX + pushes * CUE_ROW_PITCH_PX), bottom: -CUE_GAP_PX };
}

/**
 * A new floater's left edge: `selfRingPx + CUE_GAP_PX`, pushed right past every box (the chip, the tags, a label)
 * whose vertical extent crosses the floater's column until `CUE_GAP_PX` apart. Fixed at spawn: a live floater then
 * moves only on y, so a tag that appears later never snaps it sideways.
 */
export function floaterLeftPx(rPx: number, boxes: readonly UprightBox[]): number {
  const span = floaterColumnSpan();
  const crossing = boxes
    .filter((box) => box.y - box.halfHeight < span.bottom && box.y + box.halfHeight > span.top)
    .sort((first, second) => first.x - first.halfWidth - (second.x - second.halfWidth));
  let left = selfRingRadiusPx(rPx) + CUE_GAP_PX;
  for (const box of crossing) {
    if (box.x + box.halfWidth + CUE_GAP_PX > left && box.x - box.halfWidth - CUE_GAP_PX < left + CUE_PILL_HEIGHT_PX) {
      left = Math.max(left, box.x + box.halfWidth + CUE_GAP_PX);
    }
  }
  return left;
}
