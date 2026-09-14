// The room this client left while the server still seats it (#219). The wire has no leave verb yet (#319), so
// the server keeps sending that room's frames, and a reconnect inside its grace answers with that room's
// `game_state`. Until another room starts, those frames are dropped, so a `leave()` stays left. #319's verb
// makes this filter unnecessary.

import { SERVER_MESSAGE_TYPE, type GameId, type ServerMessage } from '@evolution/shared';

export class LeftRoomFilter {
  private leftGameId: GameId | null = null;

  /** Left `gameId`; a room that was never named (`null`) leaves nothing to filter. */
  left(gameId: GameId | null): void {
    this.leftGameId = gameId;
  }

  /** The player asked for a room again: nothing is filtered any more. */
  forget(): void {
    this.leftGameId = null;
  }

  /** Whether the frame may reach the room state. A frame that starts or names another room ends the filter. */
  admits(message: ServerMessage): boolean {
    if (this.leftGameId === null) return true;
    switch (message.type) {
      case SERVER_MESSAGE_TYPE.gameStarted:
        this.forget();
        return true;
      case SERVER_MESSAGE_TYPE.gameState:
        if (message.gameId === this.leftGameId) return false;
        this.forget();
        return true;
      // These carry no room id, and while the filter holds the only room sending them is the one left.
      case SERVER_MESSAGE_TYPE.gameSnapshot:
      case SERVER_MESSAGE_TYPE.balanceUpdated:
      case SERVER_MESSAGE_TYPE.playerJoined:
      case SERVER_MESSAGE_TYPE.playerDisconnected:
        return false;
      default:
        return true;
    }
  }
}
