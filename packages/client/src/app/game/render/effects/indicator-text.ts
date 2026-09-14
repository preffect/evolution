// The own-cell indicators' two texts (docs/rendering/own-cell-indicators.md §10): the level numeral in the `value`
// role and the label in the `label` role on its nine-slice pill, both drawn upright at their px size in the effects
// layer's world units (scaled by 1 / zoom). A seam of its own because `BitmapText` needs a real 2D canvas to build
// its glyphs, which no unit test has: the layer takes a factory, and specs hand it a recording fake.

import { BitmapText, Container, NineSliceSprite } from 'pixi.js';
import { UI_TYPE } from '../constants';
import { HALF } from '../geometry';
import { hexToNumber } from '../colour';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { labelPillSpriteSizePx } from '../textures/label-pill-bake';
import type { IndicatorLabelPlacement, IndicatorTextPlacement } from './own-cell-indicators';

export interface IndicatorText {
  readonly container: Container;
  /** The drawn width of `text` in the `label` role, in CSS px. */
  measureLabelPx(text: string): number;
  showNumeral(placement: IndicatorTextPlacement, zoom: number): void;
  showLabel(placement: IndicatorLabelPlacement, zoom: number): void;
  hideNumeral(): void;
  hideLabel(): void;
}

export type IndicatorTextFactory = (textures: IndicatorTextures) => IndicatorText;

const EMPTY_TEXT = '';
const NO_BORDER = 0;

function centredText(fontFamily: string, fontSize: number): BitmapText {
  const text = new BitmapText({ text: EMPTY_TEXT, style: { fontFamily, fontSize } });
  text.anchor.set(HALF);
  return text;
}

/** The label pill as a nine-slice in texels, scaled back to px: only its middle column stretches. */
function labelPillSprite(textures: IndicatorTextures): NineSliceSprite {
  const { labelPill, bakeScale } = textures;
  const capTexels = labelPill.capWidthPx * bakeScale;
  const pill = new NineSliceSprite({
    texture: labelPill.texture,
    leftWidth: capTexels,
    rightWidth: capTexels,
    topHeight: NO_BORDER,
    bottomHeight: NO_BORDER,
  });
  pill.scale.set(1 / bakeScale);
  return pill;
}

class BitmapIndicatorText implements IndicatorText {
  readonly container = new Container();
  private readonly numeral: BitmapText;
  private readonly label: BitmapText;
  private readonly pill: NineSliceSprite;
  private readonly labelGroup = new Container();

  constructor(private readonly textures: IndicatorTextures) {
    this.numeral = centredText(textures.fonts.value, UI_TYPE.value.px);
    this.label = centredText(textures.fonts.label, UI_TYPE.label.px);
    this.pill = labelPillSprite(textures);
    this.labelGroup.addChild(this.pill, this.label);
    this.container.addChild(this.labelGroup, this.numeral);
    this.hideNumeral();
    this.hideLabel();
  }

  measureLabelPx(text: string): number {
    this.label.text = text;
    return this.label.width;
  }

  showNumeral(placement: IndicatorTextPlacement, zoom: number): void {
    this.numeral.text = placement.text;
    this.numeral.tint = hexToNumber(placement.tint);
    this.numeral.position.set(placement.x, placement.y);
    this.numeral.scale.set(1 / zoom);
    this.numeral.visible = true;
  }

  showLabel(placement: IndicatorLabelPlacement, zoom: number): void {
    const { bakeScale } = this.textures;
    this.label.text = placement.text;
    this.label.tint = hexToNumber(placement.tint);
    const size = labelPillSpriteSizePx(placement.pillWidthPx);
    this.pill.setSize(size.width * bakeScale, size.height * bakeScale);
    this.pill.position.set(-size.width * HALF, -size.height * HALF);
    this.labelGroup.position.set(placement.x, placement.y);
    this.labelGroup.scale.set(1 / zoom);
    this.labelGroup.visible = true;
  }

  hideNumeral(): void {
    this.numeral.visible = false;
  }

  hideLabel(): void {
    this.labelGroup.visible = false;
  }
}

export const createBitmapIndicatorText: IndicatorTextFactory = (textures) => new BitmapIndicatorText(textures);
