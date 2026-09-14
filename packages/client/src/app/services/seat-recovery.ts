// Whether a dropped socket still has a seat to come back to (docs/ui/overlays.md §3.6).
//
// A socket that drops mid-round does not end the round for this client: the server keeps the seat
// for `DISCONNECT_GRACE_MS` and answers a reconnect inside it with a `game_state` from its connect
// handler, before it reads a single client frame. The client re-announces itself (`join_lobby`, which
// the server answers to the sender alone) as soon as the socket reopens, so a frame always follows:
// the **first** frame after the reopen is `game_state` when the seat survived, and anything else
// means the server no longer holds it (the grace ran out, or the server restarted).

import { SERVER_MESSAGE_TYPE, type ServerMessage } from '@evolution/shared';

export const SEAT_RECOVERY_OUTCOME = {
  /** Nothing is pending: the frame is ordinary traffic. */
  none: 'none',
  /** The server resent the room: play on. */
  resynced: 'resynced',
  /** The server answered without the room: the seat is gone and the lobby returns. */
  seatLost: 'seat_lost',
} as const;

export type SeatRecoveryOutcome = (typeof SEAT_RECOVERY_OUTCOME)[keyof typeof SEAT_RECOVERY_OUTCOME];

const RECOVERY_PHASE = {
  idle: 'idle',
  /** The socket dropped mid-round and has not reopened. */
  awaitingReopen: 'awaiting_reopen',
  /** The socket reopened; the next frame decides. */
  awaitingFirstFrame: 'awaiting_first_frame',
} as const;

type RecoveryPhase = (typeof RECOVERY_PHASE)[keyof typeof RECOVERY_PHASE];

export class SeatRecovery {
  private phase: RecoveryPhase = RECOVERY_PHASE.idle;

  /** The socket dropped on its own. Only a drop mid-round has a seat worth waiting for. */
  socketDropped(isInGame: boolean): void {
    this.phase = isInGame ? RECOVERY_PHASE.awaitingReopen : RECOVERY_PHASE.idle;
  }

  /** The socket reopened. `true` when a seat is pending, so the caller re-announces itself. */
  socketReopened(): boolean {
    if (this.phase !== RECOVERY_PHASE.awaitingReopen) return false;
    this.phase = RECOVERY_PHASE.awaitingFirstFrame;
    return true;
  }

  /** Reads one inbound frame; only the first one after a reopen decides anything. */
  frameReceived(message: ServerMessage): SeatRecoveryOutcome {
    if (this.phase !== RECOVERY_PHASE.awaitingFirstFrame) return SEAT_RECOVERY_OUTCOME.none;
    this.phase = RECOVERY_PHASE.idle;
    return message.type === SERVER_MESSAGE_TYPE.gameState
      ? SEAT_RECOVERY_OUTCOME.resynced
      : SEAT_RECOVERY_OUTCOME.seatLost;
  }

  /** The user left or disconnected: nothing is pending any more. */
  cancel(): void {
    this.phase = RECOVERY_PHASE.idle;
  }
}
