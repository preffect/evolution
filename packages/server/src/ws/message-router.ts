import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import type { Connection } from './connection.js';
import { clientMessageSchema, type ValidatedClientMessage } from './message-schemas.js';
import { sendMessage } from './connection.js';

type ClientMessageType = ValidatedClientMessage['type'];
type MessageOfType<T extends ClientMessageType> = Extract<ValidatedClientMessage, { type: T }>;
type MessageHandler<T extends ClientMessageType> = (connection: Connection, message: MessageOfType<T>) => void;

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

/**
 * Verb -> the handler typed for exactly that verb. The mapped type forces an entry for every
 * verb the schema accepts AND rejects a handler paired with the wrong verb at compile time.
 */
type DispatchTable = { [T in ClientMessageType]: MessageHandler<T> };

function buildDispatchTable(handlers: MessageHandlers): DispatchTable {
  return {
    [CLIENT_MESSAGE_TYPE.joinLobby]: handlers.onJoinLobby,
    [CLIENT_MESSAGE_TYPE.updatePlayerInfo]: handlers.onUpdatePlayerInfo,
    [CLIENT_MESSAGE_TYPE.createGame]: handlers.onCreateGame,
    [CLIENT_MESSAGE_TYPE.joinGame]: handlers.onJoinGame,
    [CLIENT_MESSAGE_TYPE.startGame]: handlers.onStartGame,
    [CLIENT_MESSAGE_TYPE.deleteGame]: handlers.onDeleteGame,
    [CLIENT_MESSAGE_TYPE.playerInput]: handlers.onPlayerInput,
    [CLIENT_MESSAGE_TYPE.clientPerformance]: handlers.onClientPerformance,
    // TODO(game): add game-specific verbs here.
  };
}

/** Looks the verb up under its own type parameter, so the handler and the message agree on `T`. */
function dispatch<T extends ClientMessageType>(
  table: DispatchTable,
  connection: Connection,
  message: MessageOfType<T>,
): void {
  const handler: MessageHandler<T> = table[message.type];
  handler(connection, message);
}

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
  const table = buildDispatchTable(handlers);
  return (connection: Connection, raw: string): void => {
    const { message, error } = parseClientMessage(raw);
    if (error !== undefined) {
      sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: error });
      return;
    }
    dispatch(table, connection, message);
  };
}
