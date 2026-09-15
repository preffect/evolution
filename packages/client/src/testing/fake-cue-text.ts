// A recording stand-in for the legibility cues' pills and texts (`render/effects/cue-text.ts`): `BitmapText` builds
// its glyphs on a real 2D canvas, which jsdom has none of, so a spec hands the cue layer this factory and reads what
// would have been drawn. Every character measures `FAKE_CUE_CHAR_PX`, in either role.

import { Container } from 'pixi.js';
import type { CueBackingDraw, CueTextDraw, CueTextFactory } from '../app/game/render/effects/cue-text';

export const FAKE_CUE_CHAR_PX = 7;

export interface FakeCueText {
  readonly factory: CueTextFactory;
  /** The last frame's backings and texts; empty before the first draw. */
  readonly drawn: { backings: readonly CueBackingDraw[]; texts: readonly CueTextDraw[] };
}

export function createFakeCueText(): FakeCueText {
  const drawn: FakeCueText['drawn'] = { backings: [], texts: [] };
  const factory: CueTextFactory = () => ({
    container: new Container(),
    measurePx: (text) => text.length * FAKE_CUE_CHAR_PX,
    draw: (backings, texts) => {
      drawn.backings = backings;
      drawn.texts = texts;
    },
  });
  return { factory, drawn };
}
