// What a player does, one page per action (docs/architecture/encyclopedia.md §12.4; #362 writes the pages). Anchored
// to the wire: every player intent of `GameInput` has an action, so a new input field without a page fails
// `typecheck`. The effects' anchor (`ENTRY_BY_EFFECT`) names entry ids, so it sits in `entry-anchors.ts`.

import type { GameInput, ValueOf } from '@evolution/shared';
import type { ReservedInputField } from './reserved';

export const ACTION = {
  steer: 'steer',
  sprint: 'sprint',
  eat: 'eat',
  engulf: 'engulf',
  escape: 'escape',
  pickTrait: 'pick_trait',
  levelUp: 'level_up',
  respawn: 'respawn',
} as const;
export type ActionId = ValueOf<typeof ACTION>;

/** The fields of `GameInput` a player acts through: not the sequence number, not the reserved build-2 fields. */
export type PlayerIntent = Exclude<keyof GameInput, 'sequence' | ReservedInputField>;

export const ACTION_BY_INTENT: Readonly<Record<PlayerIntent, ActionId>> = {
  targetX: ACTION.steer,
  targetY: ACTION.steer,
  shouldSprint: ACTION.sprint,
  traitChoice: ACTION.pickTrait,
};
