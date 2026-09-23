import { UiButtonComponent } from './ui-kit/ui-button.component';
import { UiSurfaceDirective } from './ui-kit/ui-surface.directive';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DEFAULT_PLAYERS_PER_GAME,
  GAME_MODE,
  MAX_PLAYERS_PER_GAME,
  MIN_PLAYERS_PER_GAME,
  ROUND_DURATION_MAX_SECONDS,
  ROUND_DURATION_MIN_SECONDS,
  ROUND_DURATION_SECONDS,
  ROUND_END_CONDITION,
  SEED_MAX,
  isRoomJoinable,
} from '@evolution/shared';
import type { GameSessionConfig, LobbyGameInfo } from '@evolution/shared';
import { EncyclopediaComponent } from './game/encyclopedia/encyclopedia.component';
import { EncyclopediaStateService } from './game/encyclopedia/encyclopedia-state.service';
import { IS_PREVIEW_ROUTE } from './game/encyclopedia/preview-route';
import { EncyclopediaPreviewRouteComponent } from './game/encyclopedia/preview-route.component';
import { ENCYCLOPEDIA_TEST_ID } from './game/encyclopedia/test-ids';
import { GameHostComponent } from './game/game-host.component';
import { HudComponent } from './game/hud/hud.component';
import { SERVER_ERROR_CAPTION } from './game/hud/server-error-notice.component';
import { IS_BENCH_ROUTE } from './game/render/bench/bench-route';
import { RenderBenchComponent } from './game/render/bench/render-bench.component';
import { LOBBY_NOTICE, MultiplayerService, type LobbyNotice } from './services/multiplayer.service';
import { IS_UI_KIT_STATES_ROUTE } from './ui-kit/kit-states/kit-states-route';
import { UiKitStatesComponent } from './ui-kit/kit-states/kit-states.component';

/** The lobby's words for why it came back on its own (docs/ui/overlays.md §3.6). */
export const LOBBY_NOTICE_TEXT: Readonly<Record<LobbyNotice, string>> = {
  [LOBBY_NOTICE.disconnectedFromGame]: 'You were disconnected from the game.',
};

/**
 * Minimal, GAME-AGNOSTIC lobby / connection UI stub.
 *
 * It exercises the full multiplayer plumbing — connect, join lobby, create /
 * join / start a game — without implementing any specific game. Once the room is in play the
 * game host (`game/game-host.component.ts`) fills the viewport with the HUD overlay
 * (`game/hud/hud.component.ts`) over it (#217, #185, docs/ui/layout.md §1). A dev build
 * opened with `?bench` renders the fixed-seed bench route instead (docs/rendering/budget.md §7), one opened
 * with `?preview` the encyclopedia preview evidence route (docs/architecture/encyclopedia.md §12.7), and one opened
 * with `?kit` the UI kit states page (docs/ui/components-and-constants.md §10.2).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    EncyclopediaComponent,
    UiButtonComponent,
    UiSurfaceDirective,
    EncyclopediaPreviewRouteComponent,
    FormsModule,
    GameHostComponent,
    HudComponent,
    RenderBenchComponent,
    UiKitStatesComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  // In play the shell fills the viewport and the lobby panels hide (#217, docs/ui/layout.md §1).
  host: { '[class.in-game]': 'multiplayer.inGame() || isBenchRoute || isPreviewRoute || isUiKitStatesRoute' },
})
export class AppComponent {
  readonly title = 'Evolution';

  /** The create form's input bounds: the server schema's, so an out-of-range value is refused here first. */
  readonly bounds = {
    minPlayers: MIN_PLAYERS_PER_GAME,
    maxPlayers: MAX_PLAYERS_PER_GAME,
    roundMinSeconds: ROUND_DURATION_MIN_SECONDS,
    roundMaxSeconds: ROUND_DURATION_MAX_SECONDS,
    seedMax: SEED_MAX,
  } as const;

  readonly multiplayer = inject(MultiplayerService);
  readonly lobbyNoticeText = LOBBY_NOTICE_TEXT;
  /** The same caption the in-play error line uses, so the two cannot drift. */
  readonly serverErrorCaption = SERVER_ERROR_CAPTION;
  /** The dev-only bench route (docs/rendering/budget.md §7) replaces the shell for the page's lifetime. */
  readonly isBenchRoute = inject(IS_BENCH_ROUTE);
  /** The dev-only encyclopedia preview evidence route (docs/architecture/encyclopedia.md §12.7), likewise. */
  readonly isPreviewRoute = inject(IS_PREVIEW_ROUTE);
  /** The dev-only UI kit states page, likewise for the page's lifetime. */
  readonly isUiKitStatesRoute = inject(IS_UI_KIT_STATES_ROUTE);

  /**
   * The encyclopedia over the lobby (docs/ui/encyclopedia.md §11.1). The room's copy is the HUD's, over
   * `HudStateService`; outside a room there is no overlay stack to join, so the one open flag lives here.
   */
  private readonly encyclopedia = inject(EncyclopediaStateService);
  private readonly isEncyclopediaOpenValue = signal(false);
  readonly isEncyclopediaOpen = this.isEncyclopediaOpenValue.asReadonly();
  readonly encyclopediaTestId = ENCYCLOPEDIA_TEST_ID;

  // Local lobby form state.
  readonly playerName = signal('Player');
  readonly newGameName = signal('New Game');
  readonly maxPlayers = signal(DEFAULT_PLAYERS_PER_GAME);
  readonly roundDurationSeconds = signal(ROUND_DURATION_SECONDS);
  readonly seed = signal(drawSeed());

  connect(): void {
    this.multiplayer.connect();
    // Immediately announce ourselves to the lobby (queued until the WS opens).
    this.multiplayer.joinLobby(this.playerName(), 0);
  }

  disconnect(): void {
    this.multiplayer.disconnect();
  }

  newSeed(): void {
    this.seed.set(drawSeed());
  }

  constructor() {
    // **The round starting underneath the reader is a close path too** (#449's review). The panel is mounted inside
    // the lobby's own `@else`, so when `inGame()` flips — which any non-host gets the moment the host presses Start,
    // with the panel modal and focus-trapped so they cannot have closed it themselves — that branch unmounts it
    // without anyone calling `closeEncyclopedia()`. The open flag and the query would then both survive the round and
    // the panel would reappear unbidden, showing a search from before it. #449's own "Done when" covers every close
    // path on every host, and this is one; the core cannot enforce it, because it cannot see either host's state.
    effect(() => {
      if (this.multiplayer.inGame()) this.closeEncyclopedia();
    });
  }

  /** At the last location this session, with a blank query; there is no entry to ask for from the lobby (§11.1). */
  openEncyclopedia(): void {
    this.encyclopedia.openAt(null);
    this.isEncyclopediaOpenValue.set(true);
  }

  /** The location stays as the session's reading position; the query does not (§11.5). */
  closeEncyclopedia(): void {
    this.isEncyclopediaOpenValue.set(false);
    this.encyclopedia.close();
  }

  createGame(): void {
    this.multiplayer.createGame(this.newGameName(), this.sessionConfig());
  }

  /** Join is greyed out on a full room, started or not; the count is humans only (#337, game-design/session.md §5). */
  isJoinable(game: LobbyGameInfo): boolean {
    return isRoomJoinable({ playerCount: game.players.length, maxPlayers: game.maxPlayers });
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

  /** Mode and end condition are fixed in build 1 and not shown (docs/ui/layout.md §2). */
  private sessionConfig(): GameSessionConfig {
    return {
      maxPlayers: this.maxPlayers(),
      seed: this.seed(),
      mode: GAME_MODE.freeForAll,
      roundDurationSeconds: this.roundDurationSeconds(),
      endCondition: ROUND_END_CONDITION.timer,
    };
  }
}

/**
 * The round seed is generated by the creating client, never by the server
 * (docs/architecture/wire-contract.md §4). It is the one root the seeded streams grow from, so it is the one
 * place entropy enters. An unsigned 32-bit read is exactly the `0 .. SEED_MAX` range (pinned
 * in session.test.ts), so nothing is clamped here.
 */
function drawSeed(): number {
  const bytes = crypto.getRandomValues(new Uint8Array(Uint32Array.BYTES_PER_ELEMENT));
  return new DataView(bytes.buffer).getUint32(0);
}
