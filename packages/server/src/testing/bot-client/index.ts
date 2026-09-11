// The headless bot client's wire side (docs/TESTING.md §8.4): the session, the swarm, its timing
// and transport seams, the CLI parser and the error. The decision stack (strategies, perception,
// pilot, identity, bindings) lives in `game/bots/`. The `ws` transport is deliberately not here:
// `cli.ts` and the integration test import `web-socket-transport.ts` directly, so nothing that
// imports this barrel loads `ws` by accident.
export { BotSession, type BotSessionOptions, type BotSessionStats } from './bot-session.js';
export { createBotSwarm, socketUrlFor, type BotSwarm, type BotSwarmOptions } from './bot-swarm.js';
export { createSystemBotClientTiming, type BotClientTiming, type BotClientTimingFactory } from './bot-timing.js';
export type { BotTransport, BotTransportFactory } from './bot-transport.js';
export {
  BOT_CLI_FLAG,
  BOT_CLI_USAGE,
  DEFAULT_BOT_CLIENT_URL,
  DEFAULT_BOT_COUNT,
  DEFAULT_BOT_STRATEGY,
  parseBotCliArguments,
  type BotCliOptions,
} from './cli-arguments.js';
export { BotClientError } from './errors.js';
