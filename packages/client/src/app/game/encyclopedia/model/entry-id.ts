// The encyclopedia's ids (docs/architecture/encyclopedia.md §12.2): an entry documents one code kind, its subject, and
// its id is `<subject>:<codeId>`, so regrouping entries never renames an id. Ids are lowercase and use only `:` `#`
// `_`, which keeps them URL- and test-id-safe as written. The closed sets of the subjects without a code enum of
// their own (`ABILITY`, `ACTION`, `WORLD_TOPIC`, `CONCEPT`, `HUD_TOPIC`) import nothing from here, so no model file cycles.

import type {
  BacteriumVariant,
  CellKind,
  CellStage,
  DnaTag,
  ENTITY_KIND,
  FoodKind,
  TraitId,
  ValueOf,
  ZoneId,
} from '@evolution/shared';
import type { AbilityId } from './abilities';
import type { ActionId } from './actions';
import type { ConceptId } from './concepts';
import type { HudTopicId } from './hud-topics';
import type { WorldTopicId } from './world-topics';

export const ENTRY_SUBJECT = {
  cellKind: 'cell_kind',
  food: 'food',
  bacterium: 'bacterium',
  /** `ENTITY_KIND` members with no subject of their own (`dna_fragment`), via `ENTRY_BY_ENTITY_KIND`. */
  entity: 'entity',
  stage: 'stage',
  trait: 'trait',
  dnaTag: 'dna_tag',
  ability: 'ability',
  action: 'action',
  zone: 'zone',
  world: 'world',
  /** The rules the other pages link to. */
  concept: 'concept',
  /** How to read each HUD element; a subject under basics, not a category. */
  hud: 'hud',
} as const;
export type EntrySubject = ValueOf<typeof ENTRY_SUBJECT>;

/**
 * What an entry page's kind chip calls its subject (docs/ui/encyclopedia.md §11.4). A trait page names its kind with
 * the rarity, tag and stage chips §11.4 lists; every other page has only this one, so a stage or a DNA tag is not a
 * title on an otherwise bare column. It sits beside the closed set so that a subject added without a word fails
 * `typecheck` rather than reaching a reader as `dna_tag`.
 */
export const ENTRY_SUBJECT_LABEL: Readonly<Record<EntrySubject, string>> = {
  [ENTRY_SUBJECT.cellKind]: 'Cell',
  [ENTRY_SUBJECT.food]: 'Food',
  [ENTRY_SUBJECT.bacterium]: 'Bacterium',
  [ENTRY_SUBJECT.entity]: 'Object',
  [ENTRY_SUBJECT.stage]: 'Stage',
  [ENTRY_SUBJECT.trait]: 'Trait',
  [ENTRY_SUBJECT.dnaTag]: 'DNA tag',
  [ENTRY_SUBJECT.ability]: 'Ability',
  [ENTRY_SUBJECT.action]: 'Action',
  [ENTRY_SUBJECT.zone]: 'Zone',
  [ENTRY_SUBJECT.world]: 'World',
  [ENTRY_SUBJECT.concept]: 'Rule',
  [ENTRY_SUBJECT.hud]: 'Screen',
};

/** The code id each subject documents: the one table the `EntryId` union is derived from. */
export interface CodeIdBySubject {
  [ENTRY_SUBJECT.cellKind]: CellKind;
  [ENTRY_SUBJECT.food]: FoodKind;
  [ENTRY_SUBJECT.bacterium]: BacteriumVariant;
  [ENTRY_SUBJECT.entity]: typeof ENTITY_KIND.dnaFragment;
  [ENTRY_SUBJECT.stage]: CellStage;
  [ENTRY_SUBJECT.trait]: TraitId;
  [ENTRY_SUBJECT.dnaTag]: DnaTag;
  [ENTRY_SUBJECT.ability]: AbilityId;
  [ENTRY_SUBJECT.action]: ActionId;
  [ENTRY_SUBJECT.zone]: ZoneId;
  [ENTRY_SUBJECT.world]: WorldTopicId;
  [ENTRY_SUBJECT.concept]: ConceptId;
  [ENTRY_SUBJECT.hud]: HudTopicId;
}

export type EntryIdOf<Subject extends EntrySubject> = `${Subject}:${CodeIdBySubject[Subject]}`;
export type EntryId = { [Subject in EntrySubject]: EntryIdOf<Subject> }[EntrySubject];

/** A place inside an entry: `trait:cell_wall#tier_2`. Section keys are lowercase snake_case. */
export type EntryAnchor = `${EntryId}#${string}`;
/** What a prose link or a `seeAlso` names: an entry, or a section of one. */
export type EntryReference = EntryId | EntryAnchor;

export const ENTRY_ID_SEPARATOR = ':';
export const ENTRY_ANCHOR_SEPARATOR = '#';

/** `trait:cell_wall` from its subject and code id. */
export function entryIdOf<Subject extends EntrySubject>(subject: Subject, codeId: CodeIdBySubject[Subject]): EntryId {
  return `${subject}${ENTRY_ID_SEPARATOR}${codeId}` as EntryId;
}

/** The subject and code id of an id; the subject is everything before the first separator. */
export function splitEntryId(entryId: EntryId): { readonly subject: EntrySubject; readonly codeId: string } {
  const separatorIndex = entryId.indexOf(ENTRY_ID_SEPARATOR);
  return {
    subject: entryId.slice(0, separatorIndex) as EntrySubject,
    codeId: entryId.slice(separatorIndex + ENTRY_ID_SEPARATOR.length),
  };
}

/** The entry an anchor points into and its section key (`null` for a plain id). */
export function splitEntryReference(reference: string): {
  readonly entryId: string;
  readonly sectionKey: string | null;
} {
  const anchorIndex = reference.indexOf(ENTRY_ANCHOR_SEPARATOR);
  if (anchorIndex < 0) return { entryId: reference, sectionKey: null };
  return {
    entryId: reference.slice(0, anchorIndex),
    sectionKey: reference.slice(anchorIndex + ENTRY_ANCHOR_SEPARATOR.length),
  };
}
