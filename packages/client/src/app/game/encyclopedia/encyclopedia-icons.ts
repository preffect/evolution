// The panel's own line icons (docs/ui/encyclopedia.md §11.3): one 16 px mark per rail category, the header's Back
// and Close, and the lens's play and pause (§11.4). Code-drawn, like every other mark in the game
// (docs/ASSET-GENERATION.md): a table of paths in the icon's own view box, which `encyclopedia-icon.component.ts` is
// the single renderer of.
//
// The drawings are the approved mockup's (`qa/decisions/encyclopedia/tools/render_encyclopedia.py`, `rail_icon`),
// transcribed shape for shape so the shipped rail matches the frame the human signed off. Each is one `d` string,
// circles included, because a shape here is a place in a picture rather than a value anything reads: written as path
// data none of it can be mistaken for a tunable, and the renderer stays one `<path>`. Everything paints in
// `currentColor`, so a selected rail item's icon takes the accent with its label.

import { ENCYCLOPEDIA_CATEGORY, type EncyclopediaCategory } from './model/categories';

export interface EncyclopediaIconPath {
  readonly d: string;
  /** A dashed stroke (`1.6 1.6`), or `null` for a solid one. */
  readonly dashArray: string | null;
  /** Filled rather than stroked: a dot, where a 0.7-unit ring would read as a smudge. */
  readonly isFilled: boolean;
}

export interface EncyclopediaIcon {
  readonly viewBox: string;
  readonly paths: readonly EncyclopediaIconPath[];
}

/** The rail mark's box: 16 units square about its own centre, drawn at `ENCYCLOPEDIA_RAIL_ICON_PX`. */
const RAIL_ICON_VIEW_BOX = '-8 -8 16 16';

/** A button icon's box: 20 units square from its origin, the size the kit's own close icon is drawn in. */
const BUTTON_ICON_VIEW_BOX = '0 0 20 20';

/** The dash the dish's floor is drawn with: dash and gap alike, in view-box units. */
const DISH_FLOOR_DASH = '1.6 1.6';

/** The stroke every line icon is drawn with, in view-box units, so it is 1.3 px in a 16 px box. */
export const ENCYCLOPEDIA_ICON_STROKE = 1.3;

function stroked(pathData: string): EncyclopediaIconPath {
  return { d: pathData, dashArray: null, isFilled: false };
}

function dashed(pathData: string): EncyclopediaIconPath {
  return { d: pathData, dashArray: DISH_FLOOR_DASH, isFilled: false };
}

function filled(pathData: string): EncyclopediaIconPath {
  return { d: pathData, dashArray: null, isFilled: true };
}

function railIcon(paths: readonly EncyclopediaIconPath[]): EncyclopediaIcon {
  return { viewBox: RAIL_ICON_VIEW_BOX, paths };
}

/** The dish outline both `basics` and `world` are drawn on: a 6.5-unit ring about the centre. */
const RING = 'M-6.5,0 a6.5,6.5 0 1 0 13,0 a6.5,6.5 0 1 0 -13,0';

/** One mark per category (§11.3), in the rail's order. */
export const ENCYCLOPEDIA_CATEGORY_ICON: Readonly<Record<EncyclopediaCategory, EncyclopediaIcon>> = {
  // An information disc: the rules every other page leans on.
  [ENCYCLOPEDIA_CATEGORY.basics]: railIcon([
    stroked(RING),
    stroked('M0,-0.5 L0,3.5'),
    filled('M-0.7,-3.2 a0.7,0.7 0 1 0 1.4,0 a0.7,0.7 0 1 0 -1.4,0'),
  ]),
  // Two cells over a rod: who lives in the dish, and what you swallow.
  [ENCYCLOPEDIA_CATEGORY.entities]: railIcon([
    stroked('M-5.2,-2 a2.2,2.2 0 1 0 4.4,0 a2.2,2.2 0 1 0 -4.4,0'),
    stroked('M1.4,-3 a1.6,1.6 0 1 0 3.2,0 a1.6,1.6 0 1 0 -3.2,0'),
    stroked('M-1.3,2 H3.3 A1.7,1.7 0 0 1 3.3,5.4 H-1.3 A1.7,1.7 0 0 1 -1.3,2 Z'),
  ]),
  // A rising staircase with an arrowhead: the ladder.
  [ENCYCLOPEDIA_CATEGORY.evolutions]: railIcon([
    stroked('M-7,6 L-3,6 L-3,1 L1,1 L1,-4 L6,-4'),
    stroked('M3,-6 L6,-4 L4,-1'),
  ]),
  // A bolt: what a trait grants.
  [ENCYCLOPEDIA_CATEGORY.abilities]: railIcon([stroked('M1,-7 L-4,1 L0,1 L-1,7 L4,-1 L0,-1 Z')]),
  // A cell with a pointer leaving it: something you do.
  [ENCYCLOPEDIA_CATEGORY.actions]: railIcon([
    stroked('M-6.2,2 a3.2,3.2 0 1 0 6.4,0 a3.2,3.2 0 1 0 -6.4,0'),
    stroked('M0,-1 L6,-6'),
    stroked('M2,-6 L6,-6 L6,-2'),
  ]),
  // The dish seen from above: its rim, a dashed floor and one drifting mote.
  [ENCYCLOPEDIA_CATEGORY.world]: railIcon([
    stroked(RING),
    dashed('M-6.5,0 a6.5,6.5 0 0 0 13,0'),
    stroked('M-0.1,-1.5 a1.6,1.6 0 1 0 3.2,0 a1.6,1.6 0 1 0 -3.2,0'),
  ]),
};

/** The header's Back chevron; it points the way the history goes. */
export const ENCYCLOPEDIA_BACK_ICON: EncyclopediaIcon = {
  viewBox: BUTTON_ICON_VIEW_BOX,
  paths: [stroked('M12,5 L7,10 L12,15')],
};

/** The lens's play mark under reduced motion (§11.4): a filled triangle pointing on. */
export const ENCYCLOPEDIA_PLAY_ICON: EncyclopediaIcon = {
  viewBox: BUTTON_ICON_VIEW_BOX,
  paths: [filled('M7,5 L15,10 L7,15 Z')],
};

/** Its pause mark: two filled bars. */
export const ENCYCLOPEDIA_PAUSE_ICON: EncyclopediaIcon = {
  viewBox: BUTTON_ICON_VIEW_BOX,
  paths: [filled('M6,5 H9 V15 H6 Z M11,5 H14 V15 H11 Z')],
};

/** The header's Close cross, the kit's own (`ui-kit/kit-states`). */
export const ENCYCLOPEDIA_CLOSE_ICON: EncyclopediaIcon = {
  viewBox: BUTTON_ICON_VIEW_BOX,
  paths: [stroked('M5,5 L15,15'), stroked('M15,5 L5,15')],
};
