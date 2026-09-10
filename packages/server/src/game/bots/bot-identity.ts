// Who a bot is in the lobby: a stable player id, a name and an avatar, all derived from the
// seed and the bot's index so a rerun with the same seed takes over the same seats (the
// `?clientId=` takeover rule, `ws/websocket-handler.ts`) and two swarms with different seeds
// never collide. Each host mints under its own prefix, so an in-process bot can never take a
// wire bot's seat even when both start from `DEFAULT_BOT_SEED`.

import { AVATAR_INDEX_MAX, AVATAR_INDEX_MIN, playerId, type PlayerId } from '@evolution/shared';

/** The id prefix per bot host: the over-the-wire client and the module's in-process roster. */
export const BOT_ID_PREFIX = {
  wire: 'bot_',
  inProcess: 'sim_bot_',
} as const;

export type BotHost = keyof typeof BOT_ID_PREFIX;

const BOT_NAME_PREFIX = 'Bot ';
/** Each bot forks its own stream from the seed by this label plus its index (docs/DETERMINISM.md §3). */
const BOT_STREAM_LABEL_PREFIX = 'bot_';
const AVATAR_COUNT = AVATAR_INDEX_MAX - AVATAR_INDEX_MIN + 1;

export interface BotIdentity {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly avatarIndex: number;
}

export function createBotIdentity(host: BotHost, seed: number, index: number): BotIdentity {
  return {
    playerId: playerId(`${BOT_ID_PREFIX[host]}${seed}_${index}`),
    playerName: `${BOT_NAME_PREFIX}${index}`,
    avatarIndex: AVATAR_INDEX_MIN + (index % AVATAR_COUNT),
  };
}

export function botStreamLabel(index: number): string {
  return `${BOT_STREAM_LABEL_PREFIX}${index}`;
}
