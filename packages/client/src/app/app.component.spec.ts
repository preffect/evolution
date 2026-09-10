import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYERS_PER_GAME } from '@evolution/shared';
import { AppComponent } from './app.component';
import { MultiplayerService } from './services/multiplayer.service';

function createMultiplayerStub() {
  return {
    connected: signal(false),
    lastError: signal<string | null>(null),
    inGame: signal(false),
    games: signal([]),
    snapshot: signal<unknown>(null),
    gameId: signal(null),
    playerId: signal(null),
    playerIds: signal([]),
    isHost: signal(false),
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinLobby: vi.fn(),
    createGame: vi.fn(),
    joinGame: vi.fn(),
    startGame: vi.fn(),
    deleteGame: vi.fn(),
  };
}

describe('AppComponent', () => {
  let multiplayer: ReturnType<typeof createMultiplayerStub>;

  beforeEach(async () => {
    multiplayer = createMultiplayerStub();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: MultiplayerService, useValue: multiplayer }],
    }).compileComponents();
  });

  it('renders the lobby shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Evolution');
  });

  it('connect joins the lobby with the chosen name', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.playerName.set('Zed');
    component.connect();
    expect(multiplayer.connect).toHaveBeenCalled();
    expect(multiplayer.joinLobby).toHaveBeenCalledWith('Zed', 0);
  });

  it('forwards the game verbs with the form state', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    component.createGame();
    component.joinGame('g1');
    component.startGame('g1');
    component.deleteGame('g1');
    component.disconnect();
    expect(multiplayer.createGame).toHaveBeenCalledWith('New Game', { maxPlayers: DEFAULT_PLAYERS_PER_GAME });
    expect(multiplayer.joinGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.startGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.deleteGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.disconnect).toHaveBeenCalled();
  });

  it('pretty-prints the latest snapshot or a placeholder', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    expect(component.snapshotJson()).toBe('(no snapshot yet)');
    multiplayer.snapshot.set({ tick: 1 });
    expect(component.snapshotJson()).toContain('"tick": 1');
  });
});
