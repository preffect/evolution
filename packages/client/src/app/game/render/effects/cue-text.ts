// The legibility cues' pills and texts (docs/rendering/own-cell-indicators.md §10): every pill backing as a nine-slice
// sprite and every number and cause as `BitmapText`, pooled, drawn upright at their px size in the effects layer's
// world units (scaled by 1 / zoom). A seam of its own for the reason `indicator-text.ts` is one: `BitmapText` builds
// its glyphs on a real 2D canvas, which no unit test has, so the cue layer takes a factory and specs hand it a
// recording fake. The glyph sprites (the trend triangle, the zone dot, a trait's ghost) are the layer's own pool.

import { BitmapText, Container, NineSliceSprite } from 'pixi.js';
import { UI_TYPE } from '../constants';
import { hexToNumber } from '../colour';
import { DIAMETER_PER_RADIUS, HALF } from '../geometry';
import type { IndicatorTextures, LabelPillTexture } from '../textures/indicator-textures';

export const CUE_TEXT_ROLE = { value: 'value', label: 'label' } as const;
export type CueTextRole = (typeof CUE_TEXT_ROLE)[keyof typeof CUE_TEXT_ROLE];

export interface CueBackingDraw {
  readonly texture: LabelPillTexture;
  /** The pill's centre in world units, its whole width and height in CSS px. */
  readonly x: number;
  readonly y: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly alpha: number;
}

export interface CueTextDraw {
  readonly text: string;
  readonly role: CueTextRole;
  /** The text's centre in world units. */
  readonly x: number;
  readonly y: number;
  readonly tint: string;
  readonly alpha: number;
}

export interface CueText {
  readonly container: Container;
  /** The drawn width of `text` in `role`, in CSS px. */
  measurePx(text: string, role: CueTextRole): number;
  /** Shows exactly these backings and texts this frame; the rest of each pool hides. */
  draw(backings: readonly CueBackingDraw[], texts: readonly CueTextDraw[], zoom: number): void;
}

export type CueTextFactory = (textures: IndicatorTextures) => CueText;

const EMPTY_TEXT = '';
const NO_BORDER = 0;

class BitmapCueText implements CueText {
  readonly container = new Container();
  private readonly backingLayer = new Container();
  private readonly textLayer = new Container();
  private readonly backings: NineSliceSprite[] = [];
  private readonly texts: Record<CueTextRole, BitmapText[]> = { value: [], label: [] };
  private readonly measurers: Record<CueTextRole, BitmapText>;

  constructor(private readonly textures: IndicatorTextures) {
    this.container.addChild(this.backingLayer, this.textLayer);
    this.measurers = { value: this.createText(CUE_TEXT_ROLE.value), label: this.createText(CUE_TEXT_ROLE.label) };
  }

  measurePx(text: string, role: CueTextRole): number {
    const measurer = this.measurers[role];
    measurer.text = text;
    return measurer.width;
  }

  draw(backings: readonly CueBackingDraw[], texts: readonly CueTextDraw[], zoom: number): void {
    backings.forEach((backing, index) => this.placeBacking(this.backingAt(index, backing.texture), backing, zoom));
    this.backings.forEach((sprite, index) => (sprite.visible = index < backings.length));
    for (const role of Object.values(CUE_TEXT_ROLE)) {
      const ofRole = texts.filter((text) => text.role === role);
      ofRole.forEach((text, index) => this.placeText(this.textAt(role, index), text, zoom));
      this.texts[role].forEach((view, index) => (view.visible = index < ofRole.length));
    }
  }

  private createText(role: CueTextRole): BitmapText {
    const text = new BitmapText({
      text: EMPTY_TEXT,
      style: { fontFamily: this.textures.fonts[role], fontSize: UI_TYPE[role].px },
    });
    text.anchor.set(HALF);
    return text;
  }

  private textAt(role: CueTextRole, index: number): BitmapText {
    const pool = this.texts[role];
    const existing = pool[index];
    if (existing !== undefined) return existing;
    const created = this.createText(role);
    pool.push(created);
    this.textLayer.addChild(created);
    return created;
  }

  /** A pooled nine-slice; a slot whose texture differs is rebuilt, which happens only when a cue changes role. */
  private backingAt(index: number, texture: LabelPillTexture): NineSliceSprite {
    const existing = this.backings[index];
    if (existing !== undefined && existing.texture === texture.texture) return existing;
    const capTexels = texture.capWidthPx * this.textures.bakeScale;
    const created = new NineSliceSprite({
      texture: texture.texture,
      leftWidth: capTexels,
      rightWidth: capTexels,
      topHeight: NO_BORDER,
      bottomHeight: NO_BORDER,
    });
    if (existing !== undefined) existing.destroy();
    this.backings[index] = created;
    this.backingLayer.addChildAt(created, Math.min(index, this.backingLayer.children.length));
    return created;
  }

  /** The pill's sprite is the drawn pill plus the bake's glow margin on every side, scaled from texels to world units. */
  private placeBacking(sprite: NineSliceSprite, backing: CueBackingDraw, zoom: number): void {
    const { bakeScale } = this.textures;
    const margin = backing.texture.marginPx * DIAMETER_PER_RADIUS;
    const width = backing.widthPx + margin;
    const height = backing.heightPx + margin;
    sprite.setSize(width * bakeScale, height * bakeScale);
    sprite.scale.set(1 / (bakeScale * zoom));
    sprite.position.set(backing.x - (width * HALF) / zoom, backing.y - (height * HALF) / zoom);
    sprite.alpha = backing.alpha;
  }

  private placeText(view: BitmapText, text: CueTextDraw, zoom: number): void {
    view.text = text.text;
    view.tint = hexToNumber(text.tint);
    view.position.set(text.x, text.y);
    view.scale.set(1 / zoom);
    view.alpha = text.alpha;
  }
}

export const createBitmapCueText: CueTextFactory = (textures) => new BitmapCueText(textures);
