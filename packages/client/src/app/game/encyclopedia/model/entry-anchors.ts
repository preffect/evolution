// The code values that open an entry (docs/architecture/encyclopedia.md §12.4): every effect the server emits and
// every world standing the HUD shows has a page or a section to explain it. They name entry ids, so they sit here
// rather than beside `ACTION` and `CONCEPT`, which `entry-id.ts` imports (no cycle). The completeness spec pins
// that each target exists.

import { EFFECT_KIND, WORLD_STANDING, type EffectKind, type WorldStanding } from '@evolution/shared';
import type { EntryAnchor, EntryId } from './entry-id';

/** The eating page: an `eat`, and the latch's moments, which are a way of taking a bacterium in. */
const EATING_ENTRY: EntryId = 'action:eat';

export const ENTRY_BY_EFFECT: Readonly<Record<EffectKind, EntryId>> = {
  [EFFECT_KIND.eat]: EATING_ENTRY,
  [EFFECT_KIND.cellAbsorbed]: 'action:engulf',
  [EFFECT_KIND.cellReleased]: 'action:escape',
  [EFFECT_KIND.levelUp]: 'action:level_up',
  [EFFECT_KIND.respawn]: 'action:respawn',
  [EFFECT_KIND.worldLevelUp]: 'world:world_clock',
  // The latch's moments open the eating page until the latch has its own (docs/game-design/early-life.md §15.9.4).
  [EFFECT_KIND.bacteriumLatched]: EATING_ENTRY,
  [EFFECT_KIND.bacteriumBonded]: EATING_ENTRY,
  [EFFECT_KIND.latchShaken]: EATING_ENTRY,
};

export const ENTRY_BY_WORLD_STANDING: Readonly<Record<WorldStanding, EntryAnchor>> = {
  [WORLD_STANDING.ahead]: 'concept:world_standing#ahead',
  [WORLD_STANDING.with]: 'concept:world_standing#with',
  [WORLD_STANDING.behind]: 'concept:world_standing#behind',
};
