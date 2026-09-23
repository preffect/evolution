// The legibility cues layer (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): draws the record's mass
// chip, rate tags and zone pill on the own cell each frame, and the floaters of its one-off changes. It keeps the
// render-side clocks the record cannot: the floater stack (spawned from the frame's own `eat` and `cell_absorbed`
// effects and from the record's `sprintSpent`, once per tick), and the rate tags' `RATE_TAG_REFRESH_MS` hold, which
// keeps a tag's last digit from flickering while a cause that appears or leaves does so at once. It also keeps the
// measured text widths: the cues' strings repeat from frame to frame, and a `BitmapText` measure lays the glyphs out
// again whenever its text changes, so each distinct string is measured once (the bench showed the effects stage paying
// for re-measuring every part of every pill each frame). Placements are `cue-placements.ts`'s data; this class only
// applies them. Nothing is drawn without a record or an own cell.

import type { CellView, EntityId, GameEffect } from '@evolution/shared';
import { RATE_TAG_REFRESH_MS } from '../constants';
import type { UprightBox } from '../geometry';
import { placeSpriteBatch } from '../sprite-pool';
import type { RateTag } from '../../hud/format/mass-cues';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { cueColumnBox, floaterLeftPx, type CueLayout } from './cue-layout';
import { OwnCellLayer, type OwnCellLayerSubject } from './own-cell-layer';
import { cueLayoutOf, cuePlacements, cueRowsFor, type CueFrame } from './cue-placements';
import { createBitmapCueText, type CueText, type CueTextFactory, type CueTextRole } from './cue-text';
import { FLOATER_CAUSE, FloaterStack, floaterSpawnsOf } from './floater-stack';

export interface CueLayerFrame {
  readonly indicators: OwnCellIndicators | null;
  readonly ownCell: CellView | null;
  readonly zoom: number;
  readonly nowMs: number;
  /** The effects this frame's render tick reached: the own cell's eats and payouts spawn floaters. */
  readonly effects: readonly GameEffect[];
  /** The label pills already placed this frame, px in the own cell's frame. */
  readonly labelBoxes: readonly UprightBox[];
}

export interface CueLayerOutputs {
  readonly pills: number;
  readonly texts: number;
  readonly sprites: number;
}

const NOTHING_DRAWN: CueLayerOutputs = { pills: 0, texts: 0, sprites: 0 };
const HIDDEN_ZOOM = 1;
const OPAQUE = 1;
/** Distinct strings a session keeps widths for before starting over: floater amounts vary, so the set is bounded. */
const MEASURED_WIDTHS_MAX_ENTRIES = 256;

interface ShownTags {
  readonly tags: readonly RateTag[];
  readonly atMs: number;
}

function hasSameCauses(first: readonly RateTag[], second: readonly RateTag[]): boolean {
  return first.length === second.length && first.every((tag, index) => tag.cause === second[index]?.cause);
}

export class CueLayer extends OwnCellLayer<OwnCellIndicators, CueText, CueLayerOutputs, CueLayerFrame> {
  private readonly floaters = new FloaterStack();
  /** Each measured string's width by role, so a repeated string costs no glyph layout. */
  private readonly measuredWidthsPx = new Map<string, number>();
  private lastSprintTick: number | null = null;
  private shownTags: ShownTags | null = null;
  private restingColumnPx: UprightBox | null = null;

  constructor(textures: IndicatorTextures, createText: CueTextFactory = createBitmapCueText) {
    super(textures, NOTHING_DRAWN, createText);
    this.container.addChild(this.spriteContainer);
  }

  /** The cues' text view goes under the glyph sprites, so a pill's backing never covers its own glyph. */
  protected override addTextView(view: CueText): void {
    this.container.addChildAt(view.container, 0);
  }

  protected draw(subject: OwnCellLayerSubject<OwnCellIndicators, CueText>, frame: CueLayerFrame): CueLayerOutputs {
    const { indicators, ownCell, text } = subject;
    if (ownCell.id !== this.cellId) this.startCell(ownCell.id);
    const cueFrame: CueFrame = {
      indicators,
      ownCell,
      zoom: frame.zoom,
      textures: this.textures,
      measurePx: (value, role) => this.widthOf(text, value, role),
      rateTags: this.tagsAt(indicators.rateTags, frame.nowMs),
      labelBoxes: frame.labelBoxes,
    };
    const rows = cueRowsFor(cueFrame);
    const layout = cueLayoutOf(cueFrame, rows);
    this.restingColumnPx = cueColumnBox(cueLayoutOf({ ...cueFrame, labelBoxes: [] }, rows));
    this.spawnFloaters(frame, indicators, ownCell, layout);
    const placements = cuePlacements(cueFrame, rows, layout, this.floaters.placements(frame.nowMs));
    text.draw(placements.backings, placements.texts, frame.zoom);
    placeSpriteBatch(this.pool, placements.sprites, OPAQUE);
    return { pills: placements.backings.length, texts: placements.texts.length, sprites: placements.sprites.length };
  }

  /** A string's width in its role, measured by the text view the first time it is asked for and kept. */
  private widthOf(text: CueText, value: string, role: CueTextRole): number {
    const key = `${role}:${value}`;
    const known = this.measuredWidthsPx.get(key);
    if (known !== undefined) return known;
    if (this.measuredWidthsPx.size >= MEASURED_WIDTHS_MAX_ENTRIES) this.measuredWidthsPx.clear();
    const measured = text.measurePx(value, role);
    this.measuredWidthsPx.set(key, measured);
    return measured;
  }

  /** The record's tags, or the ones shown until `RATE_TAG_REFRESH_MS` has passed while the same causes show. */
  private tagsAt(tags: readonly RateTag[], nowMs: number): readonly RateTag[] {
    const shown = this.shownTags;
    if (shown !== null && hasSameCauses(shown.tags, tags) && nowMs - shown.atMs < RATE_TAG_REFRESH_MS) {
      return shown.tags;
    }
    this.shownTags = { tags, atMs: nowMs };
    return tags;
  }

  /** The chip and tags where they rest with no label near, px in the own cell's frame; `null` while nothing is drawn. */
  get restingColumn(): UprightBox | null {
    return this.restingColumnPx;
  }

  /** The own cell's floaters of this frame, all starting at one x past the chip, the tags and any label. */
  private spawnFloaters(frame: CueLayerFrame, indicators: OwnCellIndicators, ownCell: CellView, layout: CueLayout) {
    const spawns = floaterSpawnsOf(frame.effects, ownCell.id);
    const sprint = indicators.sprintSpent;
    if (sprint !== null && sprint.tick !== this.lastSprintTick) {
      spawns.push({ cause: FLOATER_CAUSE.sprint, amount: -sprint.amount });
      this.lastSprintTick = sprint.tick;
    }
    if (spawns.length === 0) return;
    const leftPx = floaterLeftPx(ownCell.radius * frame.zoom, [layout.chip, ...layout.tags, ...frame.labelBoxes]);
    for (const spawn of spawns) this.floaters.spawn(spawn, frame.nowMs, leftPx);
  }

  private startCell(cellId: EntityId): void {
    this.cellId = cellId;
    this.floaters.clear();
    this.lastSprintTick = null;
    this.shownTags = null;
  }

  /** No own cell or no record (spectating, the lobby): nothing drawn, and the next cell starts fresh. */
  protected hide(): void {
    this.text?.draw([], [], HIDDEN_ZOOM);
    this.pool.hideFrom(0);
    this.floaters.clear();
    this.restingColumnPx = null;
    this.cellId = null;
    this.lastSprintTick = null;
    this.shownTags = null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
