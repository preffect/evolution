// One bot's brain: a strategy instance, its own random stream and its input sequence. Both the
// over-the-wire client and the in-process bots hand it the latest snapshot and the client tick
// and get back the input to send, so a strategy behaves the same whichever way it reaches the
// module. The sequence is the client tick (docs/ARCHITECTURE.md §5), stamped only on ticks the
// strategy answers on, so a coalesced input is never mistaken for a lost one.

import type { PlayerId, RandomSource } from '@evolution/shared';
import type { BotStrategy, BotStrategyFactory } from '../gameplay/bots.js';
import type { ScriptContext } from '../gameplay/scripts.js';
import type { BotWorldBinding } from './bot-binding.js';

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
