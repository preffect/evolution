// The legibility cues layer (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10): draws the record's mass
// chip, rate tags and zone pill on the own cell each frame, and the floaters of its one-off changes. It keeps the
// render-side clocks the record cannot: the floater stack (spawned from the frame's own `eat` and `cell_absorbed`
// effects and from the record's `sprintSpent`, once per tick), and the rate tags' `RATE_TAG_REFRESH_MS` hold, which
// keeps a tag's last digit from flickering while a cause that appears or leaves does so at once. Placements are
// `cue-placements.ts`'s data; this class only applies them. Nothing is drawn without a record or an own cell.

import type { CellView, EntityId, GameEffect } from '@evolution/shared';
import { Container, type Sprite } from 'pixi.js';
import { RATE_TAG_REFRESH_MS } from '../constants';
import type { UprightBox } from '../geometry';
import { SpritePool, placeSprite } from '../sprite-pool';
import type { RateTag } from '../../hud/format/mass-cues';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { floaterLeftPx, type CueLayout } from './cue-layout';
import { cueLayoutOf, cuePlacements, cueRowsFor, type CueFrame } from './cue-placements';
import { createBitmapCueText, type CueText, type CueTextFactory } from './cue-text';
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

interface ShownTags {
  readonly tags: readonly RateTag[];
  readonly atMs: number;
}

function hasSameCauses(first: readonly RateTag[], second: readonly RateTag[]): boolean {
  return first.length === second.length && first.every((tag, index) => tag.cause === second[index]?.cause);
}

export class CueLayer {
  readonly container = new Container();
  private readonly spriteContainer = new Container();
  private readonly pool = new SpritePool(this.spriteContainer);
  private readonly floaters = new FloaterStack();
  /** Built on the first frame with something to say: `BitmapText` wants a real canvas (`cue-text.ts`). */
  private text: CueText | null = null;
  private cellId: EntityId | null = null;
  private lastSprintTick: number | null = null;
  private shownTags: ShownTags | null = null;

  constructor(
    private readonly textures: IndicatorTextures,
    private createText: CueTextFactory = createBitmapCueText,
  ) {
    this.container.addChild(this.spriteContainer);
  }

  /** Swaps the text factory before the first text is built: a test passes a fake. */
  useText(factory: CueTextFactory): void {
    this.createText = factory;
  }

  update(frame: CueLayerFrame): CueLayerOutputs {
    const { indicators, ownCell } = frame;
    if (indicators === null || ownCell === null) {
      this.hide();
      return NOTHING_DRAWN;
    }
    const text = this.textView();
    if (ownCell.id !== this.cellId) this.startCell(ownCell.id);
    const cueFrame: CueFrame = {
      indicators,
      ownCell,
      zoom: frame.zoom,
      textures: this.textures,
      measurePx: (value, role) => text.measurePx(value, role),
      rateTags: this.tagsAt(indicators.rateTags, frame.nowMs),
      labelBoxes: frame.labelBoxes,
    };
    const rows = cueRowsFor(cueFrame);
    const layout = cueLayoutOf(cueFrame, rows);
    this.spawnFloaters(frame, indicators, ownCell, layout);
    const placements = cuePlacements(cueFrame, rows, layout, this.floaters.placements(frame.nowMs));
    text.draw(placements.backings, placements.texts, frame.zoom);
    placements.sprites.forEach((placement, index) =>
      placeSprite(this.pool.spriteAt(index), placement.texture.texture, { ...placement, alpha: OPAQUE }),
    );
    this.pool.hideFrom(placements.sprites.length);
    return { pills: placements.backings.length, texts: placements.texts.length, sprites: placements.sprites.length };
  }

  /** The pooled glyph sprites in placement order: a test reads them. */
  get sprites(): readonly Sprite[] {
    return this.pool.all;
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

  private textView(): CueText {
    if (this.text === null) {
      this.text = this.createText(this.textures);
      this.container.addChildAt(this.text.container, 0);
    }
    return this.text;
  }

  /** No own cell or no record (spectating, the lobby): nothing drawn, and the next cell starts fresh. */
  private hide(): void {
    this.text?.draw([], [], HIDDEN_ZOOM);
    this.pool.hideFrom(0);
    this.floaters.clear();
    this.cellId = null;
    this.lastSprintTick = null;
    this.shownTags = null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
