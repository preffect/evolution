// Integration (docs/TESTING.md §2): the lobby shell wired to the REAL MultiplayerService and
// WebSocketService over a fake browser socket — create a game, receive game_started, enter the
// room, where the game host alone fills the shell. Run with `./validate.sh integration`.
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
} from '@evolution/shared';
import { AppComponent } from './app.component';
import { IdentityService } from './services/identity.service';
import { FakeWebSocket } from '../testing/fake-websocket';

describe('lobby shell + multiplayer services', () => {
  beforeEach(async () => {
    FakeWebSocket.reset();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: IdentityService, useValue: { clientId: 'alice' } }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects, creates a game and enters the room when the server starts it', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    component.connect();
    const socket = FakeWebSocket.latest();
    socket.open();
    component.seed.set(42);
    component.createGame();
    const config = createTestSessionConfig({ maxPlayers: 4, seed: 42 });
    expect(socket.sentMessages()).toEqual([
      { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Player', avatarIndex: 0 },
      { type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'New Game', config },
    ]);

    socket.receive(
      JSON.stringify({
        type: SERVER_MESSAGE_TYPE.gameStarted,
        gameId: 'g1',
        playerId: 'alice',
        playerIds: ['alice'],
        isHost: true,
        config,
      }),
    );
    const snapshot = createTestSnapshot({ tick: 3 });
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(component.multiplayer.inGame()).toBe(true);
    expect(component.multiplayer.gameId()).toBe('g1');
    expect(component.multiplayer.isHost()).toBe(true);
    expect(component.multiplayer.snapshot()).toEqual(snapshot);
    // In play the shell is the game host alone, filling the viewport (#217, docs/UI.md §1).
    expect(element.classList.contains('in-game')).toBe(true);
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.querySelector('app-game-host')).not.toBeNull();
  });
});
