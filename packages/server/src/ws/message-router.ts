import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { Connection } from './connection.js';
import { clientMessageSchema, type ValidatedClientMessage } from './message-schemas.js';
import { sendMessage } from './connection.js';

type MessageOfType<T extends string> = Extract<ValidatedClientMessage, { type: T }>;
type MessageHandler<T extends string> = (connection: Connection, message: MessageOfType<T>) => void;

/**
 * The set of handlers the lobby provides. This is the generic seam between the
 * transport (router) and the application (lobby). Game-specific verbs are added
 * by extending the schema + this interface + the dispatch table below.
 */
export interface MessageHandlers {
  onJoinLobby: MessageHandler<typeof CLIENT_MESSAGE_TYPE.joinLobby>;
  onUpdatePlayerInfo: MessageHandler<typeof CLIENT_MESSAGE_TYPE.updatePlayerInfo>;
  onCreateGame: MessageHandler<typeof CLIENT_MESSAGE_TYPE.createGame>;
  onJoinGame: MessageHandler<typeof CLIENT_MESSAGE_TYPE.joinGame>;
  onStartGame: MessageHandler<typeof CLIENT_MESSAGE_TYPE.startGame>;
  onDeleteGame: MessageHandler<typeof CLIENT_MESSAGE_TYPE.deleteGame>;
  onPlayerInput: MessageHandler<typeof CLIENT_MESSAGE_TYPE.playerInput>;
  onClientPerformance: MessageHandler<typeof CLIENT_MESSAGE_TYPE.clientPerformance>;
}

/** Verb -> handler name. The type forces an entry for every verb the schema accepts. */
const HANDLER_FOR_TYPE: Record<ValidatedClientMessage['type'], keyof MessageHandlers> = {
  [CLIENT_MESSAGE_TYPE.joinLobby]: 'onJoinLobby',
  [CLIENT_MESSAGE_TYPE.updatePlayerInfo]: 'onUpdatePlayerInfo',
  [CLIENT_MESSAGE_TYPE.createGame]: 'onCreateGame',
  [CLIENT_MESSAGE_TYPE.joinGame]: 'onJoinGame',
  [CLIENT_MESSAGE_TYPE.startGame]: 'onStartGame',
  [CLIENT_MESSAGE_TYPE.deleteGame]: 'onDeleteGame',
  [CLIENT_MESSAGE_TYPE.playerInput]: 'onPlayerInput',
  [CLIENT_MESSAGE_TYPE.clientPerformance]: 'onClientPerformance',
  // TODO(game): add game-specific verbs here.
};

type ParseResult = { message: ValidatedClientMessage; error?: never } | { message?: never; error: string };

/** JSON-decode and schema-validate one inbound frame; the error text is what the client is told. */
export function parseClientMessage(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON' };
  }
  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    return { error: `Invalid message: ${result.error.issues[0]?.message ?? 'unknown'}` };
  }
  return { message: result.data };
}

/**
 * Build a per-message dispatcher. Parses JSON, validates against the schema,
 * and routes to the matching handler. Invalid messages get an `error` reply.
 */
export function createMessageRouter(handlers: MessageHandlers) {
  return (connection: Connection, raw: string): void => {
    const { message, error } = parseClientMessage(raw);
    if (error !== undefined) {
      sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: error });
      return;
    }
    // The table pairs each verb with the handler typed for it; the union is narrowed by construction.
    const handler = handlers[HANDLER_FOR_TYPE[message.type]] as MessageHandler<ValidatedClientMessage['type']>;
    handler(connection, message);
  };
}
