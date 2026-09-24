// The facts every ranked table reads off the room (docs/ui/hud.md §3.1.1, docs/ui/overlays.md §3.4): the server's
// ranking, the names, the seats and who we are. Read in one place, so the leaderboard and the round results can never
// rank from different sources.

import type { GameStateService } from '../state/game-state.service';
import type { LeaderboardSource } from './format/leaderboard-rows';

export function rankingSourceFrom(gameState: GameStateService): LeaderboardSource {
  return {
    rows: gameState.leaderboard(),
    players: gameState.players(),
    avatarAssignments: gameState.avatarAssignments(),
    ownPlayerId: gameState.ownPlayerId(),
  };
}
