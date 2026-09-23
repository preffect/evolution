// Every `ENTITY_KIND` has a page (docs/architecture/encyclopedia.md §12.4): a new entity kind without one fails
// `typecheck`, and the completeness spec pins that each target exists.

import { ENTITY_KIND, type EntityKind } from '@evolution/shared';
import type { EntryId } from './entry-id';

export const ENTRY_BY_ENTITY_KIND: Readonly<Record<EntityKind, EntryId>> = {
  [ENTITY_KIND.cell]: 'cell_kind:player',
  [ENTITY_KIND.foodMote]: 'concept:food',
  [ENTITY_KIND.dnaFragment]: 'entity:dna_fragment',
};
