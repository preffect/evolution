// How a bot reads a snapshot and speaks to a module (docs/TESTING.md §8.4): the same two
// duties a `ScenarioAdapter` has (`locateCell`, `toInput`) plus the perception the strategies
// look through. The echo binding is the template's: no cells, nothing to see, and an input that
// is the command stamped with its sequence. #98 adds the Evolution binding over its adapter.

import type { PlayerId } from '@evolution/shared';
import type { CellLocation, PlayerCommand } from '../gameplay/adapter.js';
import type { EchoInput, EchoSnapshot } from '../gameplay/echo-adapter.js';
import { NO_WORLD_PERCEPTION, type BotPerception } from '../gameplay/strategies/perception.js';

export interface BotWorldBinding<Input, Snapshot> {
  readonly name: string;
  /** The bot's own cell in `snapshot`, or `undefined` when it has none (a bot never throws here). */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** The wire input for a command, stamped with the bot's client tick as its sequence. */
  toInput(command: PlayerCommand, sequence: number): Input;
  readonly perception: BotPerception<Snapshot>;
}

export const echoBotBinding: BotWorldBinding<EchoInput, EchoSnapshot> = {
  name: 'echo',
  locateCell: () => undefined,
  toInput: (command, sequence) => ({ ...command, sequence }),
  perception: NO_WORLD_PERCEPTION,
};
