// The own-cell indicators' texts (docs/rendering/own-cell-indicators.md §10): the level numeral in the `value` role,
// the threat or escape label and the relation labels (docs/ui/hud.md §3.1.5) in the `label` role on their nine-slice
// pills, all drawn upright at their px size in the effects layer's world units (scaled by 1 / zoom). A seam of its own
// because `BitmapText` needs a real 2D canvas to build its glyphs, which no unit test has: the layer takes a factory,
// and specs hand it a recording fake.

import { BitmapText, Container, NineSliceSprite } from 'pixi.js';
import { UI_TYPE } from '../constants';
import { HALF } from '../geometry';
import { hexToNumber } from '../colour';
import type { IndicatorTextures } from '../textures/indicator-textures';
import { labelPillSpriteSizePx } from '../textures/label-pill-bake';
import { RELATION_LABEL_RIM } from '../../hud/format/relation-labels';
import type { IndicatorLabelPlacement, IndicatorTextPlacement } from './own-cell-indicators';
import type { RelationLabelPlacement } from './relation-label-placements';

export interface IndicatorText {
  readonly container: Container;
  /** The drawn width of `text` in the `label` role, in CSS px. */
  measureLabelPx(text: string): number;
  showNumeral(placement: IndicatorTextPlacement, zoom: number): void;
  showLabel(placement: IndicatorLabelPlacement, zoom: number): void;
  /** The relation labels, one per kind (at most two); a slot not in `placements` is hidden. */
  showRelationLabels(placements: readonly RelationLabelPlacement[], zoom: number): void;
  hideNumeral(): void;
  hideLabel(): void;
  hideRelationLabels(): void;
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
  // The gain pill shares the danger pill's size and caps, so one set of borders serves both textures.
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

/** One label: its text on its pill, placed and scaled as a group. */
class LabelSlot {
  readonly group = new Container();
  readonly text: BitmapText;
  readonly pill: NineSliceSprite;

  constructor(private readonly textures: IndicatorTextures) {
    this.text = centredText(textures.fonts.label, UI_TYPE.label.px);
    this.pill = labelPillSprite(textures);
    this.group.addChild(this.pill, this.text);
    this.group.visible = false;
  }

  show(placement: IndicatorLabelPlacement, zoom: number): void {
    const { bakeScale } = this.textures;
    this.text.text = placement.text;
    this.text.tint = hexToNumber(placement.tint);
    const size = labelPillSpriteSizePx(placement.pillWidthPx);
    this.pill.setSize(size.width * bakeScale, size.height * bakeScale);
    this.pill.position.set(-size.width * HALF, -size.height * HALF);
    this.group.position.set(placement.x, placement.y);
    this.group.scale.set(1 / zoom);
    this.group.visible = true;
  }
}

/** The edible and the toxic label: at most one per kind (docs/ui/hud.md §3.1.5). */
const RELATION_LABEL_SLOTS = Object.keys(RELATION_LABEL_RIM).length;

class BitmapIndicatorText implements IndicatorText {
  readonly container = new Container();
  private readonly numeral: BitmapText;
  private readonly label: LabelSlot;
  private readonly relationLabels: readonly LabelSlot[];

  constructor(private readonly textures: IndicatorTextures) {
    this.numeral = centredText(textures.fonts.value, UI_TYPE.value.px);
    this.label = new LabelSlot(textures);
    this.relationLabels = Array.from({ length: RELATION_LABEL_SLOTS }, () => new LabelSlot(textures));
    this.container.addChild(...this.relationLabels.map((slot) => slot.group), this.label.group, this.numeral);
    this.hideNumeral();
  }

  measureLabelPx(text: string): number {
    this.label.text.text = text;
    return this.label.text.width;
  }

  showNumeral(placement: IndicatorTextPlacement, zoom: number): void {
    this.numeral.text = placement.text;
    this.numeral.tint = hexToNumber(placement.tint);
    this.numeral.position.set(placement.x, placement.y);
    this.numeral.scale.set(1 / zoom);
    this.numeral.visible = true;
  }

  showLabel(placement: IndicatorLabelPlacement, zoom: number): void {
    this.label.show(placement, zoom);
  }

  showRelationLabels(placements: readonly RelationLabelPlacement[], zoom: number): void {
    this.relationLabels.forEach((slot, index) => {
      const placement = placements[index];
      if (placement === undefined) {
        slot.group.visible = false;
        return;
      }
      const { gainLabelPill, labelPill } = this.textures;
      slot.pill.texture = placement.rim === RELATION_LABEL_RIM.gain ? gainLabelPill.texture : labelPill.texture;
      slot.show(placement, zoom);
    });
  }

  hideNumeral(): void {
    this.numeral.visible = false;
  }

  hideLabel(): void {
    this.label.group.visible = false;
  }

  hideRelationLabels(): void {
    for (const slot of this.relationLabels) slot.group.visible = false;
  }
}

export const createBitmapIndicatorText: IndicatorTextFactory = (textures) => new BitmapIndicatorText(textures);
