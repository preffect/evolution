// One bot's brain: a strategy instance, its own random stream and its input sequence. Both the
// over-the-wire client and the in-process bots hand it the latest snapshot and the client tick
// and get back the input to send, so a strategy behaves the same whichever way it reaches the
// module. The sequence is the client tick (docs/ARCHITECTURE.md §5), stamped only on ticks the
// strategy answers on, so a coalesced input is never mistaken for a lost one.

import { createSeededRandom, type PlayerId, type RandomSource } from '@evolution/shared';
import type { BotStrategy, BotStrategyFactory } from '../gameplay/bots.js';
import type { ScriptContext } from '../gameplay/scripts.js';
import { createStrategyByName } from '../gameplay/strategies/strategy-catalog.js';
import type { BotWorldBinding } from './bot-binding.js';
import { botStreamLabel } from './bot-identity.js';

export interface BotPilotOptions<Input, Snapshot> {
  readonly playerIndex: number;
  readonly playerId: PlayerId;
  readonly seed: number;
  /** This bot's own stream, forked from the swarm seed: its only source of randomness. */
  readonly random: RandomSource;
  readonly binding: BotWorldBinding<Input, Snapshot>;
  readonly createStrategy: BotStrategyFactory<Snapshot>;
}

export interface BotPilotStats {
  readonly decisions: number;
  readonly inputsProduced: number;
  readonly lastSequence: number;
}

export interface BotPilot<Input, Snapshot> {
  readonly playerId: PlayerId;
  readonly strategyName: string;
  /** The input for client tick `tick` given the latest `snapshot`, or `null` when the strategy holds. */
  decide(snapshot: Snapshot, tick: number): Input | null;
  stats(): BotPilotStats;
}

export function createBotPilot<Input, Snapshot>(options: BotPilotOptions<Input, Snapshot>): BotPilot<Input, Snapshot> {
  const { playerIndex, playerId, seed, random, binding, createStrategy } = options;
  const strategy: BotStrategy<Snapshot> = createStrategy();
  let decisions = 0;
  let inputsProduced = 0;
  let lastSequence = 0;
  return {
    playerId,
    strategyName: strategy.name,
    decide(snapshot, tick) {
      const context: ScriptContext<Snapshot> = {
        tick,
        stepTick: tick + 1,
        playerIndex,
        playerId,
        snapshot,
        cell: binding.locateCell(snapshot, playerId),
        seed,
        random,
      };
      decisions += 1;
      const command = strategy.decide(context);
      if (command === null) {
        return null;
      }
      inputsProduced += 1;
      lastSequence = tick;
      return binding.toInput(command, tick);
    },
    stats: () => ({ decisions, inputsProduced, lastSequence }),
  };
}

export interface NamedBotPilotOptions<Input, Snapshot> {
  /** A catalogue name (`strategy-catalog.ts`). */
  readonly behavior: string;
  readonly seed: number;
  readonly playerIndex: number;
  readonly playerId: PlayerId;
  readonly binding: BotWorldBinding<Input, Snapshot>;
  /** `hunter` only: hunt this player alone. */
  readonly preyPlayerId?: PlayerId;
}

/**
 * The pilot both bot hosts build: a catalogue strategy on the bot's own stream, `bot_<index>`
 * forked from the swarm seed (docs/DETERMINISM.md §3), so the same seed and index decide the
 * same way in-process and over the wire. Throws `UnknownBotStrategyError` for a name not in the catalogue.
 */
export function createNamedBotPilot<Input, Snapshot>(
  options: NamedBotPilotOptions<Input, Snapshot>,
): BotPilot<Input, Snapshot> {
  const { behavior, seed, playerIndex, playerId, binding, preyPlayerId } = options;
  const createStrategy = createStrategyByName(behavior, binding.perception, { preyPlayerId });
  const random = createSeededRandom(seed).fork(botStreamLabel(playerIndex));
  return createBotPilot({ playerIndex, playerId, seed, random, binding, createStrategy });
}
