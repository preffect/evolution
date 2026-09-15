// The legibility cues' placements (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): the record's
// mass chip, rate tags and zone pill, and the live floaters, turned into pill rows (a pill and the parts inside it,
// `CUE_SEGMENT_GAP_PX` apart, measured by the text view), laid out by `cueLayout`, and emitted as the backings,
// texts and glyph sprites of this frame in the effects layer's world units. Pure: `cue-layer.ts` spawns the
// floaters between the layout and the placements and applies what this answers. Text is always `WHITE`; a cue's
// colour is its rim, its trend glyph and its zone dot only.

import type { CellView } from '@evolution/shared';
import { CUE_SEGMENT_GAP_PX, DANGER, GAIN, WHITE, ZONE_CUE } from '../constants';
import { HALF, type UprightBox } from '../geometry';
import type { RateTag } from '../../hud/format/mass-cues';
import { MASS_TREND } from '../../state/mass-trend';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorSpriteTexture, IndicatorTextures, LabelPillTexture } from '../textures/indicator-textures';
import { LABEL_PILL_SPEC, cuePillSpec, pillWidthPx, type PillSpec } from '../textures/label-pill-bake';
import { cueLayout, type CueLayout } from './cue-layout';
import { CUE_TEXT_ROLE, type CueBackingDraw, type CueTextDraw, type CueTextRole } from './cue-text';
import type { FloaterPlacement } from './floater-stack';
import type { IndicatorSpritePlacement } from './own-cell-indicators';

export type CueTextures = Pick<IndicatorTextures, 'cuePills' | 'zonePill' | 'trendGlyph' | 'zoneDot' | 'ghosts'>;

type CueSegment =
  | { readonly kind: 'text'; readonly role: CueTextRole; readonly text: string }
  | {
      readonly kind: 'sprite';
      readonly texture: IndicatorSpriteTexture;
      readonly tint: string;
      readonly rotation: number;
    };

export interface CueFrame {
  readonly indicators: OwnCellIndicators;
  readonly ownCell: Pick<CellView, 'x' | 'y' | 'radius'>;
  readonly zoom: number;
  readonly textures: CueTextures;
  /** The drawn width of a text in a role, CSS px (the text view measures it). */
  readonly measurePx: (text: string, role: CueTextRole) => number;
  /** The rate tags as shown this frame: the record's, held for `RATE_TAG_REFRESH_MS` by the layer. */
  readonly rateTags: readonly RateTag[];
  /** The label pills already placed, px in the own cell's frame: the cues yield to them. */
  readonly labelBoxes: readonly UprightBox[];
}

/** One pill and what sits inside it, measured. */
export interface CueRow {
  readonly segments: readonly CueSegment[];
  readonly texture: LabelPillTexture;
  readonly spec: PillSpec;
  readonly contentPx: number;
  readonly widthPx: number;
  readonly alpha: number;
}

export interface CueRows {
  readonly chip: CueRow;
  readonly tags: readonly CueRow[];
  readonly zone: CueRow | null;
}

export interface CuePlacements {
  readonly backings: readonly CueBackingDraw[];
  readonly texts: readonly CueTextDraw[];
  readonly sprites: readonly IndicatorSpritePlacement[];
}

const OPAQUE = 1;
const UPRIGHT = 0;
const HALF_TURN = Math.PI;
const NOTHING = 0;
/** Every cue pill's height and pad; its rim is already baked into the texture the row draws. */
const CUE_PILL_SIZE = cuePillSpec(null);
/** The zone pill is a label pill without the danger rim. */
const ZONE_PILL_SIZE: PillSpec = { ...LABEL_PILL_SPEC, rimColour: null };

function value(text: string): CueSegment {
  return { kind: 'text', role: CUE_TEXT_ROLE.value, text };
}

/** The `label` role is uppercase: the text is uppercased here, once, so it measures as it draws. */
function label(text: string): CueSegment {
  return { kind: 'text', role: CUE_TEXT_ROLE.label, text: text.toUpperCase() };
}

function segmentWidthPx(segment: CueSegment, frame: CueFrame): number {
  return segment.kind === 'text' ? frame.measurePx(segment.text, segment.role) : segment.texture.widthPx;
}

function rowOf(segments: readonly CueSegment[], texture: LabelPillTexture, spec: PillSpec, frame: CueFrame): CueRow {
  const widths = segments.map((segment) => segmentWidthPx(segment, frame));
  const gaps = Math.max(NOTHING, segments.length - 1) * CUE_SEGMENT_GAP_PX;
  const contentPx = widths.reduce((sum, width) => sum + width, NOTHING) + gaps;
  return { segments, texture, spec, contentPx, widthPx: pillWidthPx(contentPx, spec), alpha: OPAQUE };
}

/** `312`, then the trend triangle and `9/s` while the chip reads a trend; the chip has no rim. */
function chipRow(frame: CueFrame): CueRow {
  const { massChip } = frame.indicators;
  const segments = [value(String(massChip.mass))];
  if (massChip.trend !== MASS_TREND.steady) {
    const isDown = massChip.trend === MASS_TREND.down;
    const trend = frame.textures.trendGlyph;
    segments.push(
      { kind: 'sprite', texture: trend, tint: isDown ? DANGER : GAIN, rotation: isDown ? HALF_TURN : UPRIGHT },
      value(massChip.rateText),
    );
  }
  return rowOf(segments, frame.textures.cuePills.none, CUE_PILL_SIZE, frame);
}

/** `−0.5/s DECAY`, and on the DECAY tag the trait's ghost and its `−15 %`. */
function tagRow(tag: RateTag, frame: CueFrame): CueRow {
  const segments = [value(tag.rateText), label(tag.causeLabel)];
  const share = tag.traitShare;
  const ghost = share === null ? undefined : frame.textures.ghosts[share.traitId];
  if (share !== null && ghost !== undefined) {
    segments.push({ kind: 'sprite', texture: ghost, tint: WHITE, rotation: UPRIGHT }, label(share.text));
  }
  return rowOf(segments, frame.textures.cuePills[tag.rim], CUE_PILL_SIZE, frame);
}

/** The zone dot in the zone's tint and the pill's line, on the unrimmed label pill. */
function zoneRow(frame: CueFrame): CueRow | null {
  const zone = frame.indicators.zone;
  if (zone === null || zone.pillText === null) return null;
  const dot: CueSegment = {
    kind: 'sprite',
    texture: frame.textures.zoneDot,
    tint: ZONE_CUE[zone.zone] ?? WHITE,
    rotation: UPRIGHT,
  };
  return rowOf([dot, label(zone.pillText)], frame.textures.zonePill, ZONE_PILL_SIZE, frame);
}

export function cueRowsFor(frame: CueFrame): CueRows {
  return {
    chip: chipRow(frame),
    tags: frame.rateTags.map((tag) => tagRow(tag, frame)),
    zone: zoneRow(frame),
  };
}

export function cueLayoutOf(frame: CueFrame, rows: CueRows): CueLayout {
  return cueLayout({
    rPx: frame.ownCell.radius * frame.zoom,
    chipWidthPx: rows.chip.widthPx,
    tagWidthsPx: rows.tags.map((row) => row.widthPx),
    zonePillWidthPx: rows.zone?.widthPx ?? null,
    labelBoxes: frame.labelBoxes,
  });
}

/** A floater's pill: its amount and cause, rimmed by its role, at its alpha. */
export function floaterRow(floater: FloaterPlacement, frame: CueFrame): CueRow {
  const segments = [value(floater.amountText), label(floater.causeLabel)];
  const row = rowOf(segments, frame.textures.cuePills[floater.rim], CUE_PILL_SIZE, frame);
  return { ...row, alpha: floater.alpha };
}

interface PlacementLists {
  readonly backings: CueBackingDraw[];
  readonly texts: CueTextDraw[];
  readonly sprites: IndicatorSpritePlacement[];
}

/** What every part of one row is placed with: the row (its alpha), the zoom, and the lists it lands in. */
interface RowTarget {
  readonly row: CueRow;
  readonly zoom: number;
  readonly lists: PlacementLists;
}

/** One part of a row at its centre (world units): a text in its role, or a glyph sprite at its baked px size. */
function placeSegment(segment: CueSegment, centre: { readonly x: number; readonly y: number }, target: RowTarget) {
  const { row, zoom, lists } = target;
  if (segment.kind === 'text') {
    lists.texts.push({ text: segment.text, role: segment.role, ...centre, tint: WHITE, alpha: row.alpha });
    return;
  }
  const { texture, tint, rotation } = segment;
  const size = { widthWu: texture.widthPx / zoom, heightWu: texture.heightPx / zoom };
  lists.sprites.push({ texture, ...centre, ...size, rotation, tint });
}

/** One row centred on `centrePx` (the own cell's frame): its backing, then its parts left to right. */
function drawRow(
  row: CueRow,
  centrePx: { readonly x: number; readonly y: number },
  frame: CueFrame,
  lists: PlacementLists,
) {
  const { zoom, ownCell } = frame;
  const toWorld = (x: number, y: number) => ({ x: ownCell.x + x / zoom, y: ownCell.y + y / zoom });
  const pillCentre = toWorld(centrePx.x, centrePx.y);
  const { texture, widthPx, alpha } = row;
  lists.backings.push({ texture, ...pillCentre, widthPx, heightPx: row.spec.heightPx, alpha });
  const target: RowTarget = { row, zoom, lists };
  let left = centrePx.x - row.contentPx * HALF;
  for (const segment of row.segments) {
    const width = segmentWidthPx(segment, frame);
    placeSegment(segment, toWorld(left + width * HALF, centrePx.y), target);
    left += width + CUE_SEGMENT_GAP_PX;
  }
}

/** Everything this frame draws: the chip, the tags and the zone pill where the layout put them, then the floaters. */
export function cuePlacements(
  frame: CueFrame,
  rows: CueRows,
  layout: CueLayout,
  floaters: readonly FloaterPlacement[],
): CuePlacements {
  const lists: PlacementLists = { backings: [], texts: [], sprites: [] };
  drawRow(rows.chip, layout.chip, frame, lists);
  rows.tags.forEach((row, index) => {
    const box = layout.tags[index];
    if (box !== undefined) drawRow(row, box, frame, lists);
  });
  if (rows.zone !== null && layout.zonePill !== null) drawRow(rows.zone, layout.zonePill, frame, lists);
  for (const floater of floaters) {
    const row = floaterRow(floater, frame);
    const centre = { x: floater.leftPx + row.widthPx * HALF, y: floater.bottomPx - row.spec.heightPx * HALF };
    drawRow(row, centre, frame, lists);
  }
  return lists;
}
