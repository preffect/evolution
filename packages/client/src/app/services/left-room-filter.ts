// The room this client left (#219). `leave()` sends `leave_game` and the server drops the seat at once (#319),
// but frames that room sent before the verb arrived are still in flight, and a leave during a drop reaches the
// server only after the reopen's `game_state`. Until another room starts, those frames are dropped, so a
// `leave()` stays left.

import { SERVER_MESSAGE_TYPE, type GameId, type ServerMessage } from '@evolution/shared';

export class LeftRoomFilter {
  private leftGameId: GameId | null = null;

  /** Left `gameId`; a room that was never named (`null`) leaves nothing to filter. */
  left(gameId: GameId | null): void {
    this.leftGameId = gameId;
  }

  /**
   * The player asked to join `gameId`. Joining the room that was left asks for its frames again; any other
   * room releases the filter through its own `game_started` or `game_state`, so a failed join elsewhere keeps it.
   */
  joiningRoom(gameId: string): void {
    if (gameId === this.leftGameId) this.forget();
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

  private forget(): void {
    this.leftGameId = null;
  }
}
