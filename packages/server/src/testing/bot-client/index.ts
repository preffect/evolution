// The headless bot client (docs/TESTING.md §8.4): what a test, the CLI and the echo module import.
export { echoBotBinding, type BotWorldBinding } from './bot-binding.js';
export { botStreamLabel, createBotIdentity, type BotIdentity } from './bot-identity.js';
export {
  createBotPilot,
  createNamedBotPilot,
  type BotPilot,
  type BotPilotOptions,
  type BotPilotStats,
  type NamedBotPilotOptions,
} from './bot-pilot.js';
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
export { createInProcessBotRoster, type InProcessBotRoster } from './in-process-bots.js';
export { createWebSocketTransport, type SocketFactory, type SocketLike } from './web-socket-transport.js';
