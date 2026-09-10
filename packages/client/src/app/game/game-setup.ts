import type { Observable } from 'rxjs';
import type { GameInput, ServerMessage } from '@evolution/shared';

/**
 * THE client-side game extension point.
 *
 * The template ships with NO game. When the game is defined (init step), this
 * is where the entire client game loop + renderer lives:
 *
 *   - an input loop that builds the per-tick/turn `GameInput` and sends it via
 *     `options.send(input)` (-> ws `player_input { payload }`),
 *   - a render loop that calls `options.drainLatestSnapshot()` each frame to get
 *     the freshest `game_snapshot` and draws it (canvas / DOM / Pixi / Three / text),
 *   - optional handling of non-snapshot server messages via `options.messages$`
 *     (player_joined / player_disconnected / game-specific variants).
 *
 * It returns a teardown function the host component calls on destroy.
 *
 * Local-only / client-trusted: the client may compute and send authoritative-
 * looking input freely; the server's GameModule decides what to do with it.
 */
export interface GameSetupOptions {
  /** Send one unit of game input to the server (wraps `player_input`). */
  send: (input: GameInput) => void;
  /** Stream of non-coalesced server messages (everything except hot snapshots). */
  messages$: Observable<ServerMessage>;
  /** Drain the freshest un-rendered `game_snapshot` frame, or null. */
  drainLatestSnapshot: () => ServerMessage | null;
  /** Optional canvas/host element the game should render into. */
  host?: HTMLElement;
}

/** Teardown handle returned by `setupGame`. */
export type GameTeardown = () => void;

/**
 * TODO(game): implement the full game loop + rendering here. This is the big
 * extension point. The default is an inert no-op so the template runs and the
 * lobby/connection flow can be exercised end-to-end with the echo GameModule.
 */
export function setupGame(options: GameSetupOptions): GameTeardown {
  // TODO(game): subscribe to options.messages$ for player_joined / player_disconnected
  //             and any game-specific server messages.
  // TODO(game): start an input loop that calls options.send(localInput) each tick/turn.
  // TODO(game): start a render loop:
  //   const frame = () => {
  //     const snap = options.drainLatestSnapshot();
  //     if (snap && snap.type === 'game_snapshot') render(snap.snapshot);
  //     raf = requestAnimationFrame(frame);
  //   };
  //   let raf = requestAnimationFrame(frame);

  // No-op placeholder so the template is runnable before a game is defined.
  void options;

  return () => {
    // TODO(game): cancel loops, unsubscribe, release renderer resources here.
  };
}
