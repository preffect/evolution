// Integration (docs/testing/tiers-and-builders.md §2): the lobby shell wired to the REAL MultiplayerService and
// WebSocketService over a fake browser socket — create a game, receive game_started, enter the
// room, where the game host alone fills the shell — and back: leave() and a drop whose seat is gone
// bring the lobby shell back and destroy the game host (#219, #220). Run with `./validate.sh integration`.
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  type GameSessionConfig,
} from '@evolution/shared';
import { AppComponent, LOBBY_NOTICE_TEXT } from './app.component';
import { GameHostComponent } from './game/game-host.component';
import { IdentityService } from './services/identity.service';
import { LOBBY_NOTICE } from './services/multiplayer.service';
import { RECONNECT_DELAY_MS } from './services/websocket.service';
import { FakeWebSocket } from '../testing/fake-websocket';

/** The server's game_started for alice, seated alone as the host of `g1`. */
function gameStartedFrame(config: GameSessionConfig): string {
  return JSON.stringify({
    type: SERVER_MESSAGE_TYPE.gameStarted,
    gameId: 'g1',
    playerId: 'alice',
    playerIds: ['alice'],
    isHost: true,
    config,
  });
}

/** Connects, opens the socket and enters `g1` the way the server starts it; returns the open socket. */
async function enterRoom(fixture: ComponentFixture<AppComponent>): Promise<FakeWebSocket> {
  fixture.componentInstance.connect();
  const socket = FakeWebSocket.latest();
  socket.open();
  socket.receive(gameStartedFrame(createTestSessionConfig({ maxPlayers: 4 })));
  await fixture.whenStable();
  expect(fixture.componentInstance.multiplayer.inGame()).toBe(true);
  return socket;
}

/** The lobby shell is whole again: header and panels back, no game host, no viewport-filling class. */
function expectLobbyShell(element: HTMLElement): void {
  expect(element.querySelector('header')).not.toBeNull();
  expect(element.querySelector('.panel')).not.toBeNull();
  expect(element.querySelector('app-game-host')).toBeNull();
  expect(element.classList.contains('in-game')).toBe(false);
}

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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    socket.receive(gameStartedFrame(config));
    const snapshot = createTestSnapshot({ tick: 3 });
    socket.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(component.multiplayer.inGame()).toBe(true);
    expect(component.multiplayer.gameId()).toBe('g1');
    expect(component.multiplayer.isHost()).toBe(true);
    expect(component.multiplayer.snapshot()).toEqual(snapshot);
    // In play the shell is the canvas with the HUD over it, filling the viewport (#217, #185, docs/ui/layout.md §1).
    expect(element.classList.contains('in-game')).toBe(true);
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.querySelector('app-game-host')).not.toBeNull();
  });

  it('leave() brings the lobby shell back without a notice and destroys the game host (#220)', async () => {
    const destroyGameHost = vi.spyOn(GameHostComponent.prototype, 'ngOnDestroy');
    const fixture = TestBed.createComponent(AppComponent);
    await enterRoom(fixture);
    expect(destroyGameHost).not.toHaveBeenCalled();

    fixture.componentInstance.multiplayer.leave();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expectLobbyShell(element);
    expect(element.querySelector('[data-testid="lobby-notice"]')).toBeNull();
    expect(destroyGameHost).toHaveBeenCalledTimes(1);
  });

  it('brings the lobby back with a notice when a dropped socket reopens to a server that no longer seats us (#219)', async () => {
    const destroyGameHost = vi.spyOn(GameHostComponent.prototype, 'ngOnDestroy');
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const socket = await enterRoom(fixture);

    // The server restarted: the socket drops and the room stays on screen while it is down.
    vi.useFakeTimers();
    socket.close();
    expect(component.multiplayer.inGame()).toBe(true);

    // The transport's own reconnect timer opens the new socket; the reopen is answered without a game_state.
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    vi.useRealTimers();
    const reopened = FakeWebSocket.latest();
    expect(reopened).not.toBe(socket);
    reopened.open();
    expect(reopened.sentMessages()).toEqual([
      { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Player', avatarIndex: 0 },
    ]);
    expect(destroyGameHost).not.toHaveBeenCalled();
    reopened.receive(JSON.stringify({ type: SERVER_MESSAGE_TYPE.lobbyUpdate, games: [] }));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(component.multiplayer.inGame()).toBe(false);
    expectLobbyShell(element);
    expect(element.querySelector('[data-testid="lobby-notice"]')?.textContent).toBe(
      LOBBY_NOTICE_TEXT[LOBBY_NOTICE.disconnectedFromGame],
    );
    expect(destroyGameHost).toHaveBeenCalledTimes(1);
  });
});
