// Who is in a scenario (docs/TESTING.md §8.1): players are numbered by index in declaration
// order, with ids `player_<index>` and names `Player <index>`; `player(i).does(script)` names
// who a script drives.

import { AVATAR_INDEX_MAX, playerId } from '@evolution/shared';
import type { PlayerScript } from './scripts.js';
import type { ScenarioPlayer } from './session.js';

const PLAYER_ID_PREFIX = 'player_';
const AVATAR_COUNT = AVATAR_INDEX_MAX + 1;

export interface PlayerScriptEntry<Snapshot> {
  readonly playerIndex: number;
  readonly script: PlayerScript<Snapshot>;
}

export interface PlayerHandle {
  does<Snapshot>(script: PlayerScript<Snapshot>): PlayerScriptEntry<Snapshot>;
}

/** `player(1).does(targetRadiiEast(5))` names who a script drives. */
export function player(playerIndex: number): PlayerHandle {
  return { does: (script) => ({ playerIndex, script }) };
}

export function scenarioPlayerId(playerIndex: number) {
  return playerId(`${PLAYER_ID_PREFIX}${playerIndex}`);
}

export function createScenarioPlayer(playerIndex: number, joinTick: number): ScenarioPlayer {
  return {
    playerIndex,
    playerId: scenarioPlayerId(playerIndex),
    playerName: `Player ${playerIndex}`,
    avatarIndex: playerIndex % AVATAR_COUNT,
    joinTick,
    leaveTick: null,
  };
}
