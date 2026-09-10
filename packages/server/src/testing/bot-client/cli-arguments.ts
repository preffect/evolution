// The bot client's command line, parsed into swarm options (docs/TESTING.md §8.4):
//   pnpm --filter @evolution/server bot-client --game <id> [--bots 4] [--strategy grazer] [--seed 42]
//                                              [--prey <playerId>] [--url ws://host:port/ws] [--ticks 600]
// Pure: no process, no output. Anything unusable throws `BotClientError` carrying the usage text.

import { DEFAULT_BOT_SEED, DEFAULT_SERVER_PORT, playerId, type PlayerId } from '@evolution/shared';
import { BOT_STRATEGY_NAME, BOT_STRATEGY_NAMES } from '../gameplay/strategies/strategy-constants.js';
import { BotClientError } from './errors.js';

export const BOT_CLI_FLAG = {
  game: '--game',
  bots: '--bots',
  strategy: '--strategy',
  seed: '--seed',
  prey: '--prey',
  url: '--url',
  ticks: '--ticks',
} as const;

export const DEFAULT_BOT_COUNT = 1;
export const DEFAULT_BOT_STRATEGY = BOT_STRATEGY_NAME.wander;
export const DEFAULT_BOT_CLIENT_URL = `ws://localhost:${DEFAULT_SERVER_PORT}/ws`;

export const BOT_CLI_USAGE = [
  'usage: pnpm --filter @evolution/server bot-client --game <gameId> [options]',
  `  ${BOT_CLI_FLAG.game} <id>          the game to join (pending or in progress); required`,
  `  ${BOT_CLI_FLAG.bots} <n>           how many bots (default ${DEFAULT_BOT_COUNT})`,
  `  ${BOT_CLI_FLAG.strategy} <name>    ${BOT_STRATEGY_NAMES.join(' | ')} (default ${DEFAULT_BOT_STRATEGY})`,
  `  ${BOT_CLI_FLAG.seed} <n>           swarm seed; bot i draws from bot_<i> forked from it (default ${DEFAULT_BOT_SEED})`,
  `  ${BOT_CLI_FLAG.prey} <playerId>    hunter only: hunt this player alone`,
  `  ${BOT_CLI_FLAG.url} <ws url>       the server's /ws endpoint (default ${DEFAULT_BOT_CLIENT_URL})`,
  `  ${BOT_CLI_FLAG.ticks} <n>          stop after this many client ticks and print the stats (default: run until Ctrl-C)`,
].join('\n');

export interface BotCliOptions {
  readonly gameId: string;
  readonly botCount: number;
  readonly strategy: string;
  readonly seed: number;
  readonly preyPlayerId?: PlayerId;
  readonly url: string;
  /** Client ticks to run before stopping; `undefined` runs until the process is interrupted. */
  readonly tickLimit?: number;
}

type FlagName = (typeof BOT_CLI_FLAG)[keyof typeof BOT_CLI_FLAG];

function isFlagName(value: string): value is FlagName {
  return (Object.values(BOT_CLI_FLAG) as string[]).includes(value);
}

function usageError(problem: string): BotClientError {
  return new BotClientError(`${problem}\n${BOT_CLI_USAGE}`);
}

/** Pairs every `--flag value`; a repeated flag keeps its last value. */
function collectFlags(commandLineArguments: readonly string[]): Map<FlagName, string> {
  const values = new Map<FlagName, string>();
  for (let index = 0; index < commandLineArguments.length; index += 2) {
    const flag = commandLineArguments[index]!;
    const value = commandLineArguments[index + 1];
    if (!isFlagName(flag)) throw usageError(`unknown argument "${flag}"`);
    if (value === undefined) throw usageError(`${flag} needs a value`);
    values.set(flag, value);
  }
  return values;
}

function wholeNumber(flag: FlagName, raw: string, minimum: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw usageError(`${flag} needs a whole number of at least ${minimum}, not "${raw}"`);
  }
  return value;
}

export function parseBotCliArguments(commandLineArguments: readonly string[]): BotCliOptions {
  const flags = collectFlags(commandLineArguments);
  const gameId = flags.get(BOT_CLI_FLAG.game);
  if (gameId === undefined) throw usageError(`${BOT_CLI_FLAG.game} is required`);
  const bots = flags.get(BOT_CLI_FLAG.bots);
  const seed = flags.get(BOT_CLI_FLAG.seed);
  const prey = flags.get(BOT_CLI_FLAG.prey);
  const ticks = flags.get(BOT_CLI_FLAG.ticks);
  return {
    gameId,
    botCount: bots === undefined ? DEFAULT_BOT_COUNT : wholeNumber(BOT_CLI_FLAG.bots, bots, 1),
    strategy: flags.get(BOT_CLI_FLAG.strategy) ?? DEFAULT_BOT_STRATEGY,
    seed: seed === undefined ? DEFAULT_BOT_SEED : wholeNumber(BOT_CLI_FLAG.seed, seed, 0),
    ...(prey === undefined ? {} : { preyPlayerId: playerId(prey) }),
    url: flags.get(BOT_CLI_FLAG.url) ?? DEFAULT_BOT_CLIENT_URL,
    ...(ticks === undefined ? {} : { tickLimit: wholeNumber(BOT_CLI_FLAG.ticks, ticks, 1) }),
  };
}
