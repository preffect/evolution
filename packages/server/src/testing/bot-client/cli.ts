// The headless bot client's composition root (docs/TESTING.md §8.3): the one place the bot
// client meets the process, the system clock and a real socket. Everything it wires is unit
// tested on its own; this file only names the production pieces, like `src/index.ts` does.
//   pnpm --filter @evolution/server bot-client --game <id> --bots 4 --strategy grazer --seed 42

import { DEBUG_JSON_INDENT_SPACES } from '@evolution/shared';
import { evolutionBotBinding } from '../../game/bots/evolution-binding.js';
import { createBotSwarm, type BotSwarm } from './bot-swarm.js';
import { createSystemBotClientTiming } from './bot-timing.js';
import { parseBotCliArguments } from './cli-arguments.js';
import { createWebSocketTransport } from './web-socket-transport.js';

const FAILURE_EXIT_CODE = 1;

function report(swarm: BotSwarm): void {
  process.stdout.write(`${JSON.stringify(swarm.stats(), null, DEBUG_JSON_INDENT_SPACES)}\n`);
}

async function main(commandLineArguments: readonly string[]): Promise<void> {
  const options = parseBotCliArguments(commandLineArguments);
  const swarm = createBotSwarm({
    ...options,
    binding: evolutionBotBinding,
    createTiming: createSystemBotClientTiming,
    connect: createWebSocketTransport,
  });
  await swarm.start();
  process.stdout.write(`${options.botCount} bot(s) running ${options.strategy} in game ${options.gameId}\n`);
  const finish = (): void => {
    swarm.stop();
    report(swarm);
  };
  if (options.tickLimit === undefined) {
    process.once('SIGINT', finish);
    return;
  }
  try {
    await swarm.whenAllReachedTick(options.tickLimit);
  } finally {
    // The stats print even when a bot lost its connection first; the error then still exits non-zero.
    finish();
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = FAILURE_EXIT_CODE;
});
