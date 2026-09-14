// What a reopened socket must do, and whether a dropped round still has a seat (docs/ui/overlays.md §3.6).
//
// A socket that drops mid-round does not end the round for this client: the server keeps the seat
// for `DISCONNECT_GRACE_MS` and answers a reconnect inside it with a `game_state` from its connect
// handler, before it reads a single client frame. The client re-announces itself (`join_lobby`, which
// the server answers to the sender alone) as soon as the socket reopens, so a frame always follows:
// the **first** frame after the reopen is `game_state` when the seat survived, and anything else
// means the server no longer holds it (the grace ran out, or the server restarted). A socket that drops
// in the lobby has no seat, but the server keeps the name and avatar on the connection, so its reopen
// re-announces them all the same.

import { SERVER_MESSAGE_TYPE, type ServerMessage, type ValueOf } from '@evolution/shared';

export const SEAT_RECOVERY_OUTCOME = {
  /** Nothing is pending: the frame is ordinary traffic. */
  none: 'none',
  /** The server resent the room: play on. */
  resynced: 'resynced',
  /** The server answered without the room: the seat is gone and the lobby returns. */
  seatLost: 'seat_lost',
} as const;

export type SeatRecoveryOutcome = ValueOf<typeof SEAT_RECOVERY_OUTCOME>;

/** What the caller does the moment the socket reopens. */
export interface SocketReopenAction {
  /** Send the newest `join_lobby` again: the new connection has no name, and its answer decides a pending seat. */
  readonly shouldReannounce: boolean;
  /** A round dropped with nothing to re-announce, so no frame will ever decide: the seat counts as gone. */
  readonly isSeatLost: boolean;
}

const NO_REOPEN_ACTION: SocketReopenAction = { shouldReannounce: false, isSeatLost: false };

const RECOVERY_PHASE = {
  idle: 'idle',
  /** The socket dropped in the lobby and has not reopened. */
  droppedInLobby: 'dropped_in_lobby',
  /** The socket dropped mid-round and has not reopened. */
  droppedInGame: 'dropped_in_game',
  /** The socket reopened after a mid-round drop; the next frame decides. */
  awaitingFirstFrame: 'awaiting_first_frame',
} as const;

type RecoveryPhase = ValueOf<typeof RECOVERY_PHASE>;

export class SeatRecovery {
  private phase: RecoveryPhase = RECOVERY_PHASE.idle;

  /** The socket dropped on its own. Only a drop mid-round has a seat worth waiting for. */
  socketDropped(isInGame: boolean): void {
    this.phase = isInGame ? RECOVERY_PHASE.droppedInGame : RECOVERY_PHASE.droppedInLobby;
  }

  /** The socket reopened. `hasAnnouncement`: a name and avatar were announced, so there is something to resend. */
  socketReopened(hasAnnouncement: boolean): SocketReopenAction {
    const droppedPhase = this.phase;
    if (droppedPhase !== RECOVERY_PHASE.droppedInGame && droppedPhase !== RECOVERY_PHASE.droppedInLobby) {
      return NO_REOPEN_ACTION;
    }
    if (droppedPhase === RECOVERY_PHASE.droppedInGame && hasAnnouncement) {
      this.phase = RECOVERY_PHASE.awaitingFirstFrame;
      return { shouldReannounce: true, isSeatLost: false };
    }
    this.phase = RECOVERY_PHASE.idle;
    return { shouldReannounce: hasAnnouncement, isSeatLost: droppedPhase === RECOVERY_PHASE.droppedInGame };
  }

  /** Reads one inbound frame; only the first one after a mid-round reopen decides anything. */
  frameReceived(message: ServerMessage): SeatRecoveryOutcome {
    if (this.phase !== RECOVERY_PHASE.awaitingFirstFrame) return SEAT_RECOVERY_OUTCOME.none;
    this.phase = RECOVERY_PHASE.idle;
    return message.type === SERVER_MESSAGE_TYPE.gameState
      ? SEAT_RECOVERY_OUTCOME.resynced
      : SEAT_RECOVERY_OUTCOME.seatLost;
  }

  /** The player left the room: no seat is pending any more, though a socket still down reopens as a lobby one. */
  cancel(): void {
    const isSocketDown = this.phase === RECOVERY_PHASE.droppedInGame || this.phase === RECOVERY_PHASE.droppedInLobby;
    this.phase = isSocketDown ? RECOVERY_PHASE.droppedInLobby : RECOVERY_PHASE.idle;
  }
}
