// Integration (docs/TESTING.md §2): the lobby shell wired to the REAL MultiplayerService and
// WebSocketService over a fake browser socket — create a game, receive game_started, enter the
// room. Run with `./validate.sh integration`.
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE } from '@evolution/shared';
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
    component.createGame();
    expect(socket.sentMessages()).toEqual([
      { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Player', avatarIndex: 0 },
      { type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'New Game', config: { maxPlayers: 4 } },
    ]);

    socket.receive(
      JSON.stringify({
        type: SERVER_MESSAGE_TYPE.gameStarted,
        gameId: 'g1',
        playerId: 'alice',
        playerIds: ['alice'],
        isHost: true,
        config: { maxPlayers: 4 },
      }),
    );
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot: { tick: 3 } }));
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.multiplayer.inGame()).toBe(true);
    expect(text).toContain('g1');
    expect(text).toContain('(host)');
    expect(component.multiplayer.latestSnapshot()).toEqual({ tick: 3 });
  });
});
