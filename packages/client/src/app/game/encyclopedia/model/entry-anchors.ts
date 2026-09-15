// The code values that open an entry (docs/architecture/encyclopedia.md §12.4): every effect the server emits and
// every world standing the HUD shows has a page or a section to explain it. They name entry ids, so they sit here
// rather than beside `ACTION` and `CONCEPT`, which `entry-id.ts` imports (no cycle). The targets land with #361 and
// #362; the completeness spec pins that each exists.

import { EFFECT_KIND, WORLD_STANDING, type EffectKind, type WorldStanding } from '@evolution/shared';
import type { EntryAnchor, EntryId } from './entry-id';

export const ENTRY_BY_EFFECT: Readonly<Record<EffectKind, EntryId>> = {
  [EFFECT_KIND.eat]: 'action:eat',
  [EFFECT_KIND.cellAbsorbed]: 'action:engulf',
  [EFFECT_KIND.cellReleased]: 'action:escape',
  [EFFECT_KIND.levelUp]: 'action:level_up',
  [EFFECT_KIND.respawn]: 'action:respawn',
  [EFFECT_KIND.worldLevelUp]: 'world:world_clock',
};

export const ENTRY_BY_WORLD_STANDING: Readonly<Record<WorldStanding, EntryAnchor>> = {
  [WORLD_STANDING.ahead]: 'concept:world_standing#ahead',
  [WORLD_STANDING.with]: 'concept:world_standing#with',
  [WORLD_STANDING.behind]: 'concept:world_standing#behind',
};
