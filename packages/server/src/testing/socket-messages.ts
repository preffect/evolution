// The message waits the lobby harness drives rooms with (docs/testing/tiers-and-builders.md §4, §6): each one resolves
// from what the recording socket has already received, so a reply that lands before the wait is made is not missed,
// and each rejects naming what it waited for when the socket closes first (`untilReceived`).
import { SERVER_MESSAGE_TYPE, type ClientMessage, type LobbyGameInfo, type ServerMessage } from '@evolution/shared';
import { untilReceived, type RecordingSocket } from './wait-for.js';

/** Accepts the message a wait is for; its function name is what a failed wait reports. */
export type MessagePredicate = (message: ServerMessage) => boolean;

/** A recording socket with the identity it connected as. */
export interface TestClient extends RecordingSocket {
  readonly clientId: string;
}

const UNNAMED_PREDICATE = 'the awaited message';

function namedPredicate(name: string, predicate: MessagePredicate): MessagePredicate {
  return Object.defineProperty(predicate, 'name', { value: name });
}

function firstAwaitedFrom(
  received: readonly ServerMessage[],
  isAwaited: MessagePredicate,
  firstIndex: number,
): ServerMessage | undefined {
  return received.slice(firstIndex).find(isAwaited);
}

/**
 * Resolves with the first message `isAwaited` accepts among those recorded from index `firstIndex` on (by default,
 * those recorded after this call); rejects when the socket closes before one arrives.
 */
export async function nextMatchingMessage(
  recording: RecordingSocket,
  isAwaited: MessagePredicate,
  firstIndex = recording.received.length,
): Promise<ServerMessage> {
  const condition = `${isAwaited.name || UNNAMED_PREDICATE} from message ${firstIndex}`;
  const holds = (received: readonly ServerMessage[]): boolean =>
    firstAwaitedFrom(received, isAwaited, firstIndex) !== undefined;
  await untilReceived(recording, holds, condition);
  return firstAwaitedFrom(recording.received, isAwaited, firstIndex)!;
}

/** Sends `frame`, then resolves with the first message `isAwaited` accepts among those recorded since the send. */
export function sendAndAwait(client: TestClient, frame: ClientMessage, isAwaited: MessagePredicate) {
  const firstIndex = client.received.length;
  client.socket.send(JSON.stringify(frame));
  return nextMatchingMessage(client, isAwaited, firstIndex);
}

export function messageOfType(type: string): MessagePredicate {
  return namedPredicate(`a ${type}`, (message) => message.type === type);
}

/**
 * A `lobby_update` whose list passes `isShown`. Every lobby change is broadcast to every socket, so a bare
 * `lobby_update` may be another client's earlier change still in flight; waiting for the list the frame produces
 * is what shows the server has handled it.
 */
export function lobbyShows(isShown: (games: readonly LobbyGameInfo[]) => boolean): MessagePredicate {
  const name = `a ${SERVER_MESSAGE_TYPE.lobbyUpdate} whose list passes ${isShown.name || 'the check'}`;
  return namedPredicate(name, (message) => message.type === SERVER_MESSAGE_TYPE.lobbyUpdate && isShown(message.games));
}

export function isSeated(games: readonly LobbyGameInfo[], gameId: string, clientId: string): boolean {
  return games.some((game) => game.gameId === gameId && game.players.some((player) => player.playerId === clientId));
}
