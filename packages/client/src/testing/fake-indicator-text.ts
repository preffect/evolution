// A recording stand-in for the own-cell indicators' texts (`render/effects/indicator-text.ts`): `BitmapText` builds its
// glyphs on a real 2D canvas, which jsdom has none of, so a spec hands the layer (or the renderer) this factory and
// reads what would have been shown. A label measures `FAKE_LABEL_CHAR_PX` per character.

import { Container } from 'pixi.js';
import type { IndicatorTextFactory } from '../app/game/render/effects/indicator-text';
import type { IndicatorLabelPlacement, IndicatorTextPlacement } from '../app/game/render/effects/own-cell-indicators';

export const FAKE_LABEL_CHAR_PX = 7;

export interface FakeIndicatorText {
  readonly factory: IndicatorTextFactory;
  /** The last numeral and label shown, `null` once hidden (or never shown). */
  readonly shown: { numeral: IndicatorTextPlacement | null; label: IndicatorLabelPlacement | null };
}

export function createFakeIndicatorText(): FakeIndicatorText {
  const shown: FakeIndicatorText['shown'] = { numeral: null, label: null };
  const factory: IndicatorTextFactory = () => ({
    container: new Container(),
    measureLabelPx: (text) => text.length * FAKE_LABEL_CHAR_PX,
    showNumeral: (placement) => {
      shown.numeral = placement;
    },
    showLabel: (placement) => {
      shown.label = placement;
    },
    hideNumeral: () => {
      shown.numeral = null;
    },
    hideLabel: () => {
      shown.label = null;
    },
  });
  return { factory, shown };
}
