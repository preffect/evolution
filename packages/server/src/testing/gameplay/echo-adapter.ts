// The adapter for the template's echo module (docs/TESTING.md §8): it proves the harness before
// any rule exists. It is the echo bot binding (`game/bots/bot-binding.ts`: no perception, the
// echo's input mapping) plus the scenario duties: the hash is the FNV lanes over the bytes of
// `JSON.stringify(serializeRoomState())` (docs/DETERMINISM.md §7), cells cannot be located (a
// script that needs one fails the run, it does not idle) and nothing can be placed. #98 replaces
// this with the Evolution adapter.

import { hashText, type GameInput, type PlayerId, type StateHash } from '@evolution/shared';
import { echoBotBinding } from '../../game/bots/bot-binding.js';
import { createEchoModule, type EchoSnapshot } from '../../game/game-module.js';
import type { ScenarioAdapter } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import { createFileReplaySink } from './replay-sink.js';
import { createScenarioDsl } from './scenario.js';

export { toEchoInput } from '../../game/bots/bot-binding.js';
export type { EchoSnapshot } from '../../game/game-module.js';

const NO_WORLD = 'the echo module has no world';

export function hashEchoSnapshot(snapshot: EchoSnapshot): StateHash {
  return hashText(JSON.stringify(snapshot));
}

export const echoAdapter: ScenarioAdapter<GameInput, EchoSnapshot, never> = {
  ...echoBotBinding,
  createModule: (options) => createEchoModule(options),
  readSnapshot: (module) => module.serializeRoomState(),
  hashState: (module) => hashEchoSnapshot(module.serializeRoomState()),
  locateCell: (): never => {
    throw new ScenarioSetupError(
      `${NO_WORLD}: cells cannot be located; use targetPoint or the Evolution adapter (#98)`,
    );
  },
  applyFixture: () => {
    throw new ScenarioSetupError(`${NO_WORLD}: placed fixtures need the Evolution adapter (#98)`);
  },
};

/** The last input the echo module holds for a player, or `null` when it has none. */
export function echoedInput(snapshot: EchoSnapshot, playerId: PlayerId): GameInput | null {
  return snapshot.players[playerId] ?? null;
}

/** The DSL bound to the echo module; a failing run writes its replay to `qa/replays/`. */
export const echoScenario = createScenarioDsl(echoAdapter, { replaySink: createFileReplaySink() });
