import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DEBUG_JSON_INDENT_SPACES, DEFAULT_PLAYERS_PER_GAME } from '@evolution/shared';
import { MultiplayerService } from './services/multiplayer.service';

/**
 * Minimal, GAME-AGNOSTIC lobby / connection UI stub.
 *
 * It exercises the full multiplayer plumbing — connect, join lobby, create /
 * join / start a game, and view the live room state + latest snapshot JSON —
 * without implementing any specific game. The marked TODO(game) area is where the
 * real game canvas/board mounts (see `game/game-setup.ts`).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly title = 'Evolution';

  readonly multiplayer = inject(MultiplayerService);

  // Local lobby form state.
  readonly playerName = signal('Player');
  readonly newGameName = signal('New Game');
  readonly maxPlayers = signal(DEFAULT_PLAYERS_PER_GAME);

  readonly snapshotJson = computed(() => {
    const snapshot = this.multiplayer.snapshot();
    return snapshot == null ? '(no snapshot yet)' : JSON.stringify(snapshot, null, DEBUG_JSON_INDENT_SPACES);
  });

  connect(): void {
    this.multiplayer.connect();
    // Immediately announce ourselves to the lobby (queued until the WS opens).
    this.multiplayer.joinLobby(this.playerName(), 0);
  }

  disconnect(): void {
    this.multiplayer.disconnect();
  }

  createGame(): void {
    this.multiplayer.createGame(this.newGameName(), { maxPlayers: this.maxPlayers() });
  }

  joinGame(id: string): void {
    this.multiplayer.joinGame(id);
  }

  startGame(id: string): void {
    this.multiplayer.startGame(id);
  }

  deleteGame(id: string): void {
    this.multiplayer.deleteGame(id);
  }
}
