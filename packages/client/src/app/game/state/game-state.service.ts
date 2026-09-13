// The HUD's one view of the world (docs/UI.md §7): derived signals only, never a second model.
// Every component reads facts from here rather than reaching into a service of its own, so what the
// chrome shows and what the wire said can never drift apart.
//
// The facts the chrome needs are the newest snapshot's and the room's, both of which
// `MultiplayerService` already mirrors as signals — `WorldStore` (`net/world-store.ts`) owns the
// *interpolated* world the renderer draws per frame, and nothing on the chrome is interpolated.
// The own-cell signals of docs/UI.md §7 (`ownCell`, `ownProgress`, `ownCellIndicators`, `threats`,
// `cameraExtent`) arrive with #186/#187 and read the store through the render seam.

import { Injectable, computed, inject } from '@angular/core';
import {
  ROUND_PHASE,
  type BalanceConfig,
  type LeaderboardRow,
  type PlayerId,
  type PlayerProgressView,
  type RoundPhase,
} from '@evolution/shared';
import { MultiplayerService } from '../../services/multiplayer.service';

const NO_LEADERBOARD: readonly LeaderboardRow[] = [];
const NO_PLAYERS: Readonly<Record<string, PlayerProgressView>> = {};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly multiplayer = inject(MultiplayerService);

  /** `MultiplayerService.playerId()`: who we are (docs/UI.md §1's `me`), `null` before the room names us. */
  readonly ownPlayerId = computed<PlayerId | null>(() => this.multiplayer.playerId());

  /** The round's phase; `playing` until the snapshot says otherwise, so the chrome shows on join. */
  readonly roundPhase = computed<RoundPhase>(() => this.multiplayer.snapshot()?.roundPhase ?? ROUND_PHASE.playing);

  /** Milliseconds left in the round, or `null` before the first snapshot. */
  readonly roundTimeLeftMs = computed<number | null>(() => this.multiplayer.snapshot()?.roundTimeLeftMs ?? null);

  /** The server's ranking, newest snapshot (docs/UI.md §3.1.1). */
  readonly leaderboard = computed<readonly LeaderboardRow[]>(
    () => this.multiplayer.snapshot()?.leaderboard ?? NO_LEADERBOARD,
  );

  /** Every player's progress by id: where the leaderboard's names come from. */
  readonly players = computed<Readonly<Record<string, PlayerProgressView>>>(
    () => this.multiplayer.snapshot()?.players ?? NO_PLAYERS,
  );

  /** Seat index per player: the palette and the seat-mark bead count (docs/VISUAL-STYLE.md §2). */
  readonly avatarAssignments = this.multiplayer.avatarAssignments.asReadonly();

  /** The room's config: the round length the clock's bloom threshold is a fraction of. */
  readonly sessionConfig = this.multiplayer.sessionConfig.asReadonly();

  /** The live balance of `game_state` / `balance_updated`; `null` before the room's arrives. */
  readonly balance = computed<BalanceConfig | null>(() => this.multiplayer.balance());
}
