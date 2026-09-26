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
  onLeaveGame: MessageHandler<typeof CLIENT_MESSAGE_TYPE.leaveGame>;
  onPlayerInput: MessageHandler<typeof CLIENT_MESSAGE_TYPE.playerInput>;
  onClientPerformance: MessageHandler<typeof CLIENT_MESSAGE_TYPE.clientPerformance>;
  onSnapshotAck: MessageHandler<typeof CLIENT_MESSAGE_TYPE.snapshotAck>;
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
    [CLIENT_MESSAGE_TYPE.leaveGame]: handlers.onLeaveGame,
    [CLIENT_MESSAGE_TYPE.playerInput]: handlers.onPlayerInput,
    [CLIENT_MESSAGE_TYPE.clientPerformance]: handlers.onClientPerformance,
    [CLIENT_MESSAGE_TYPE.snapshotAck]: handlers.onSnapshotAck,
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

/**
 * Verbs whose frames are dropped without a reply when they fail the schema (ticket #256, docs/architecture/wire-contract.md
 * §4). They are telemetry: they carry no player intent, and a tab left open across a deploy may keep sending them in
 * an old shape, which must never surface to the player as an `error`. The schema stays strict, so nothing is stored.
 */
export const SILENTLY_DROPPED_INVALID_VERBS: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>([
  CLIENT_MESSAGE_TYPE.clientPerformance,
]);

type ParseResult =
  | { message: ValidatedClientMessage; error?: never; claimedType?: never }
  | { message?: never; error: string; claimedType: string | null };

/** The `type` a decoded frame claims, when it is an object with a string `type`; `null` otherwise. */
function claimedTypeOf(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) return null;
  const { type } = parsed as { type: unknown };
  return typeof type === 'string' ? type : null;
}

/**
 * JSON-decode and schema-validate one inbound frame; the error text is what the client is told, and a frame that
 * fails the schema also carries the verb it claimed, so the router can tell a telemetry frame from the rest.
 */
export function parseClientMessage(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON', claimedType: null };
  }
  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    return {
      error: `Invalid message: ${result.error.issues[0]?.message ?? 'unknown'}`,
      claimedType: claimedTypeOf(parsed),
    };
  }
  return { message: result.data };
}

/** Whether a frame that failed the schema is one of the verbs dropped without a reply. */
function isSilentlyDropped(claimedType: string | null): boolean {
  return claimedType !== null && SILENTLY_DROPPED_INVALID_VERBS.has(claimedType as ClientMessageType);
}

/**
 * Build a per-message dispatcher. Parses JSON, validates against the schema,
 * and routes to the matching handler. Invalid messages get an `error` reply,
 * except a verb of `SILENTLY_DROPPED_INVALID_VERBS`, which is dropped without one.
 */
export function createMessageRouter(handlers: MessageHandlers) {
  const table = buildDispatchTable(handlers);
  return (connection: Connection, raw: string): void => {
    const { message, error, claimedType } = parseClientMessage(raw);
    if (error !== undefined) {
      if (isSilentlyDropped(claimedType)) return;
      sendMessage(connection, { type: SERVER_MESSAGE_TYPE.error, message: error });
      return;
    }
    dispatch(table, connection, message);
  };
}
