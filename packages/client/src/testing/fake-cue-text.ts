// A recording stand-in for the legibility cues' pills and texts (`render/effects/cue-text.ts`): `BitmapText` builds
// its glyphs on a real 2D canvas, which jsdom has none of, so a spec hands the cue layer this factory and reads what
// would have been drawn. Every character measures `FAKE_CUE_CHAR_PX`, in either role, and every measure is counted.

import { Container } from 'pixi.js';
import type { CueBackingDraw, CueTextDraw, CueTextFactory } from '../app/game/render/effects/cue-text';

export const FAKE_CUE_CHAR_PX = 7;

export interface FakeCueText {
  readonly factory: CueTextFactory;
  /** The last frame's backings and texts; empty before the first draw. */
  readonly drawn: { backings: readonly CueBackingDraw[]; texts: readonly CueTextDraw[] };
  /** How many times the view was asked to measure a text: a cache in front of it keeps this from growing. */
  readonly counts: { measures: number };
}

export function createFakeCueText(): FakeCueText {
  const drawn: FakeCueText['drawn'] = { backings: [], texts: [] };
  const counts: FakeCueText['counts'] = { measures: 0 };
  const factory: CueTextFactory = () => ({
    container: new Container(),
    measurePx: (text) => {
      counts.measures += 1;
      return text.length * FAKE_CUE_CHAR_PX;
    },
    draw: (backings, texts) => {
      drawn.backings = backings;
      drawn.texts = texts;
    },
  });
  return { factory, drawn, counts };
}
