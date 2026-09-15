// Code values the encyclopedia leaves out because the game does not play them yet (docs/architecture/encyclopedia.md
// §12.4). They are excluded by name, never by omission, and the completeness spec pins that each is still reserved in
// code: a value that goes live must leave this list and gain an entry. The reserved trait ids need no row: `TraitId`
// is derived from the catalog, which never holds them (the spec pins that too, over the live balance's list).

import { CELL_STATE, GAME_MODE, type CellState, type GameMode, type GameInput } from '@evolution/shared';

/** The `GameInput` fields build 2 reserves: validated and ignored by the server. */
export type ReservedInputField = keyof Pick<GameInput, 'shouldSplit' | 'shouldEject'>;

/** A trait exclusion group no catalog row uses yet (`primary_locomotion`). */
export const RESERVED_EXCLUSION_GROUP = 'primary_locomotion';

export interface ReservedFromEncyclopedia {
  readonly cellStates: readonly CellState[];
  readonly gameModes: readonly GameMode[];
  readonly exclusionGroups: readonly string[];
  readonly inputFields: readonly ReservedInputField[];
}

export const RESERVED_FROM_ENCYCLOPEDIA: ReservedFromEncyclopedia = {
  cellStates: [CELL_STATE.dividing],
  gameModes: [GAME_MODE.colony],
  exclusionGroups: [RESERVED_EXCLUSION_GROUP],
  inputFields: ['shouldSplit', 'shouldEject'],
};
