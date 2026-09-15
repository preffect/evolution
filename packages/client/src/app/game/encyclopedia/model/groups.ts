// The list groups (docs/architecture/encyclopedia.md §12.2): the ids and how an entry is assigned one are §12's, the
// header labels docs/ui/encyclopedia.md §11.2's. The group is derived from the subject (and, for a trait, its catalog
// category), never written in content. Evolutions walks its stages, then one group per `TRAIT_CATEGORY` in the
// object's declaration order, then the DNA tags; a group with no entry is left out of the list.

import { TRAIT_CATEGORY, type TraitCategory, type ValueOf } from '@evolution/shared';
import { ENCYCLOPEDIA_CATEGORY, type EncyclopediaCategory } from './categories';
import { ENTRY_SUBJECT, splitEntryId, type EntryId, type EntrySubject } from './entry-id';

export const ENTRY_GROUP = {
  rules: 'rules',
  cells: 'cells',
  food: 'food',
  stages: 'stages',
  ...TRAIT_CATEGORY,
  dnaTags: 'dna_tags',
  dishAndZones: 'dish_and_zones',
  time: 'time',
} as const;
export type EntryGroupId = ValueOf<typeof ENTRY_GROUP>;

export const ENTRY_GROUP_LABEL: Readonly<Record<EntryGroupId, string>> = {
  [ENTRY_GROUP.rules]: 'Rules',
  [ENTRY_GROUP.cells]: 'Cells',
  [ENTRY_GROUP.food]: 'Food',
  [ENTRY_GROUP.stages]: 'Stages',
  [ENTRY_GROUP.genome]: 'Genome',
  [ENTRY_GROUP.locomotion]: 'Locomotion',
  [ENTRY_GROUP.membrane]: 'Membrane',
  [ENTRY_GROUP.metabolism]: 'Metabolism',
  [ENTRY_GROUP.sensory]: 'Sensory',
  [ENTRY_GROUP.offense]: 'Offense',
  [ENTRY_GROUP.defense]: 'Defense',
  [ENTRY_GROUP.form]: 'Form',
  [ENTRY_GROUP.colony]: 'Colony',
  [ENTRY_GROUP.dnaTags]: 'DNA tags',
  [ENTRY_GROUP.dishAndZones]: 'Dish and zones',
  [ENTRY_GROUP.time]: 'Time',
};

/** Each category's groups in list order; an ungrouped category has none. */
export const CATEGORY_GROUPS: Readonly<Record<EncyclopediaCategory, readonly EntryGroupId[]>> = {
  [ENCYCLOPEDIA_CATEGORY.basics]: [ENTRY_GROUP.rules],
  [ENCYCLOPEDIA_CATEGORY.entities]: [ENTRY_GROUP.cells, ENTRY_GROUP.food],
  [ENCYCLOPEDIA_CATEGORY.evolutions]: [ENTRY_GROUP.stages, ...Object.values(TRAIT_CATEGORY), ENTRY_GROUP.dnaTags],
  [ENCYCLOPEDIA_CATEGORY.abilities]: [],
  [ENCYCLOPEDIA_CATEGORY.actions]: [],
  [ENCYCLOPEDIA_CATEGORY.world]: [ENTRY_GROUP.dishAndZones, ENTRY_GROUP.time],
};

/** The group of every subject but `trait`, whose group is its catalog category. */
export const GROUP_BY_SUBJECT: Readonly<
  Record<Exclude<EntrySubject, typeof ENTRY_SUBJECT.trait>, EntryGroupId | null>
> = {
  [ENTRY_SUBJECT.concept]: ENTRY_GROUP.rules,
  [ENTRY_SUBJECT.cellKind]: ENTRY_GROUP.cells,
  [ENTRY_SUBJECT.food]: ENTRY_GROUP.food,
  [ENTRY_SUBJECT.bacterium]: ENTRY_GROUP.food,
  [ENTRY_SUBJECT.entity]: ENTRY_GROUP.food,
  [ENTRY_SUBJECT.stage]: ENTRY_GROUP.stages,
  [ENTRY_SUBJECT.dnaTag]: ENTRY_GROUP.dnaTags,
  [ENTRY_SUBJECT.ability]: null,
  [ENTRY_SUBJECT.action]: null,
  [ENTRY_SUBJECT.zone]: ENTRY_GROUP.dishAndZones,
  [ENTRY_SUBJECT.world]: ENTRY_GROUP.time,
};

/** The entries whose group is not their subject's. */
export const GROUP_BY_ENTRY: Readonly<Partial<Record<EntryId, EntryGroupId>>> = {
  'concept:food': ENTRY_GROUP.food,
  'world:dish': ENTRY_GROUP.dishAndZones,
};

/** An entry's group; a trait's is its catalog category, which the caller reads from the balance's structure. */
export function groupOf(entryId: EntryId, traitCategory: TraitCategory | null): EntryGroupId | null {
  const overridden = GROUP_BY_ENTRY[entryId];
  if (overridden !== undefined) return overridden;
  const { subject } = splitEntryId(entryId);
  if (subject !== ENTRY_SUBJECT.trait) return GROUP_BY_SUBJECT[subject];
  if (traitCategory === null) throw new Error(`The trait entry ${entryId} needs its catalog category for a group`);
  return traitCategory;
}
