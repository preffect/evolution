// Who a bot is in the lobby: a stable client id, a name and an avatar, all derived from the
// swarm seed and the bot's index so a rerun with the same seed takes over the same seats (the
// `?clientId=` takeover rule, `ws/websocket-handler.ts`) and two swarms with different seeds
// never collide. The same identity serves the over-the-wire client and the in-process bots.

import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN, playerId, type PlayerId } from '@evolution/shared';

const BOT_ID_PREFIX = 'bot_';
const BOT_NAME_PREFIX = 'Bot ';
/** Each bot forks its own stream from the swarm seed by this label plus its index (docs/DETERMINISM.md §3). */
const BOT_STREAM_LABEL_PREFIX = 'bot_';
const AVATAR_COUNT = AVATAR_INDEX_MAX - AVATAR_INDEX_MIN + 1;

export interface BotIdentity {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly avatarIndex: number;
}

export function createBotIdentity(seed: number, index: number): BotIdentity {
  return {
    playerId: playerId(`${BOT_ID_PREFIX}${seed}_${index}`),
    playerName: `${BOT_NAME_PREFIX}${index}`,
    avatarIndex: AVATAR_INDEX_MIN + (index % AVATAR_COUNT),
  };
}

export function botStreamLabel(index: number): string {
  return `${BOT_STREAM_LABEL_PREFIX}${index}`;
}
