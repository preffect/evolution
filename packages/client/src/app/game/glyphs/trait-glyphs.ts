// One code-drawn glyph per trait (docs/ui/components-and-constants.md §7, docs/visual-style/ui-type.md §7.1): the
// picker card's medallion, the menu's trait list and the encyclopedia draw the trait from this record. It lives in the
// neutral `game/glyphs/` so the encyclopedia never imports `hud/`. The drawings are the
// `render/constants/trait-glyphs-*.ts` tables, in the trait's organelle colours. The tables are lists that name
// their trait, since trait ids are snake_case and never object keys, so the record is keyed here and
// `trait-glyphs.spec.ts` pins that it holds exactly one glyph per catalog id.

import type { TraitId } from '@evolution/shared';
import { EARLY_TRAIT_GLYPHS } from '../render/constants/trait-glyphs-early';
import { FORM_TRAIT_GLYPHS } from '../render/constants/trait-glyphs-forms';
import { ORGANELLE_TRAIT_GLYPHS } from '../render/constants/trait-glyphs-organelles';
import type { TraitGlyph } from '../render/svg-glyph';

const ALL_TRAIT_GLYPHS: readonly TraitGlyph[] = [
  ...EARLY_TRAIT_GLYPHS,
  ...ORGANELLE_TRAIT_GLYPHS,
  ...FORM_TRAIT_GLYPHS,
];

export const TRAIT_GLYPHS = Object.fromEntries(ALL_TRAIT_GLYPHS.map((glyph) => [glyph.traitId, glyph])) as Readonly<
  Record<TraitId, TraitGlyph>
>;
