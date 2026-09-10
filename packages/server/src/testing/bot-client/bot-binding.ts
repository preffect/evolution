// How a bot reads a snapshot and speaks to a module (docs/TESTING.md §8.4): the same two
// duties a `ScenarioAdapter` has (`locateCell`, `toInput`) plus the perception the strategies
// look through. The echo binding is the template's: no cells, nothing to see, and the echo
// adapter's own input mapping. It is typed over `unknown` because the echo has no snapshot
// shape worth naming: the same binding serves the in-process roster (fed `EchoSnapshot`) and
// the over-the-wire client (fed the wire `GameSnapshot`). #98 adds the Evolution binding.

import type { GameInput, PlayerId } from '@evolution/shared';
import type { CellLocation, PlayerCommand } from '../gameplay/adapter.js';
import { toWireInput } from '../gameplay/wire-input.js';
import { NO_WORLD_PERCEPTION, type BotPerception } from '../gameplay/strategies/perception.js';

export interface BotWorldBinding<Input, Snapshot> {
  readonly name: string;
  /** The bot's own cell in `snapshot`, or `undefined` when it has none (a bot never throws here). */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** The wire input for a command, stamped with the bot's client tick as its sequence. */
  toInput(command: PlayerCommand, sequence: number): Input;
  readonly perception: BotPerception<Snapshot>;
}

export const echoBotBinding: BotWorldBinding<GameInput, unknown> = {
  name: 'echo',
  locateCell: () => undefined,
  toInput: toWireInput,
  perception: NO_WORLD_PERCEPTION,
};
