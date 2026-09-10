// The adapter for the template's echo module (docs/TESTING.md §8): it proves the harness before
// any rule exists. The echo game has no world, so the hash is the FNV lanes over the bytes of
// `JSON.stringify(serializeRoomState())` (docs/DETERMINISM.md §7), cells cannot be located and
// nothing can be placed. #98 replaces this with the Evolution adapter.

import { hashText, type PlayerId, type StateHash } from '@evolution/shared';
import { defaultGameModuleFactory, type GameModule } from '../../game/game-module.js';
import type { PlayerCommand, ScenarioAdapter } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import { createFileReplaySink } from './replay-sink.js';
import { createScenarioDsl } from './scenario.js';

/** What the echo module stores per player: the command, stamped with its sequence. */
export interface EchoInput extends PlayerCommand {
  readonly sequence: number;
}

/** `{ players: { [playerId]: lastInput | null } }`, as `defaultGameModuleFactory` echoes it. */
export interface EchoSnapshot {
  readonly players: Readonly<Record<string, EchoInput | null>>;
}

export function hashEchoSnapshot(snapshot: EchoSnapshot): StateHash {
  return hashText(JSON.stringify(snapshot));
}

export const echoAdapter: ScenarioAdapter<EchoInput, EchoSnapshot, never> = {
  name: 'echo',
  createModule: (options): GameModule => defaultGameModuleFactory(options),
  readSnapshot: (module) => module.serializeRoomState() as EchoSnapshot,
  hashState: (module) => hashEchoSnapshot(module.serializeRoomState() as EchoSnapshot),
  toInput: (playerCommand, sequence) => ({ ...playerCommand, sequence }),
  locateCell: () => undefined,
  applyFixture: () => {
    throw new ScenarioSetupError('the echo module has no world: placed fixtures need the Evolution adapter (#98)');
  },
};

/** The last input the echo module holds for a player, or `null` when it has none. */
export function echoedInput(snapshot: EchoSnapshot, playerId: PlayerId): EchoInput | null {
  return snapshot.players[playerId] ?? null;
}

/** The DSL bound to the echo module; a failing run writes its replay to `qa/replays/`. */
export const echoScenario = createScenarioDsl(echoAdapter, { replaySink: createFileReplaySink() });
