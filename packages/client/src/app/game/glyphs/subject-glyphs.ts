// One code-drawn glyph per encyclopedia subject that is no trait (docs/ui/components-and-constants.md §7,
// docs/visual-style/ui-type.md §7.2): the encyclopedia's list rows, category tiles and entry headers draw the subject
// from this record, the way they draw a trait from `TRAIT_GLYPHS`. It lives in the neutral `game/glyphs/` and takes
// nothing from `encyclopedia/` but the id type, so the encyclopedia never imports `hud/` and a glyph never imports the
// encyclopedia. The drawings are the `render/constants/subject-glyphs-*.ts` tables; the tables are lists that name
// their entry, since entry ids are never object keys, so the record is keyed here and `subject-glyphs.spec.ts` pins
// that it holds exactly one glyph per non-trait `EntryId`.

import { CONTEST_ABILITY_GLYPHS } from '../render/constants/subject-glyphs-abilities-contest';
import { REACH_ABILITY_GLYPHS } from '../render/constants/subject-glyphs-abilities-reach';
import { ACTION_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-actions';
import { CELL_KIND_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-cells';
import { CONCEPT_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-concepts';
import { FOOD_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-food';
import { HUD_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-hud';
import { STAGE_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-stages';
import { DNA_TAG_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-tags';
import { WORLD_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-world';
import { ZONE_SUBJECT_GLYPHS } from '../render/constants/subject-glyphs-zones';
import type { SubjectEntryId, SubjectGlyph } from '../render/svg-glyph';

/** Every subject glyph in one list, in the order the tables are read: what the contact sheet walks. */
export const SUBJECT_GLYPH_LIST: readonly SubjectGlyph[] = [
  ...CELL_KIND_SUBJECT_GLYPHS,
  ...FOOD_SUBJECT_GLYPHS,
  ...STAGE_SUBJECT_GLYPHS,
  ...DNA_TAG_SUBJECT_GLYPHS,
  ...CONTEST_ABILITY_GLYPHS,
  ...REACH_ABILITY_GLYPHS,
  ...ACTION_SUBJECT_GLYPHS,
  ...ZONE_SUBJECT_GLYPHS,
  ...WORLD_SUBJECT_GLYPHS,
  ...CONCEPT_SUBJECT_GLYPHS,
  ...HUD_SUBJECT_GLYPHS,
];

export const SUBJECT_GLYPHS = Object.fromEntries(SUBJECT_GLYPH_LIST.map((glyph) => [glyph.entryId, glyph])) as Readonly<
  Record<SubjectEntryId, SubjectGlyph>
>;
