import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYERS_PER_GAME, SEED_MAX, createTestSessionConfig } from '@evolution/shared';
import { AppComponent } from './app.component';
import { GameHostComponent } from './game/game-host.component';
import { IS_BENCH_ROUTE } from './game/render/bench/bench-route';
import { RenderBenchComponent } from './game/render/bench/render-bench.component';
import { MultiplayerService } from './services/multiplayer.service';

/** Stands in for the game host, which would try to create a WebGL Pixi app under jsdom. */
@Component({ selector: 'app-game-host', standalone: true, template: '<div data-testid="game-host-stub"></div>' })
class GameHostStubComponent {}

/** Stands in for the bench route, which would create a WebGL Pixi app under jsdom. */
@Component({ selector: 'app-render-bench', standalone: true, template: '<div data-testid="render-bench-stub"></div>' })
class RenderBenchStubComponent {}

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
  const isBenchRoute = { value: false };

  beforeEach(async () => {
    multiplayer = createMultiplayerStub();
    isBenchRoute.value = false;
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: MultiplayerService, useValue: multiplayer },
        { provide: IS_BENCH_ROUTE, useFactory: () => isBenchRoute.value },
      ],
    })
      .overrideComponent(AppComponent, {
        remove: { imports: [GameHostComponent, RenderBenchComponent] },
        add: { imports: [GameHostStubComponent, RenderBenchStubComponent] },
      })
      .compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the lobby shell', () => {
    expect(render().querySelector('h1')?.textContent).toContain('Evolution');
  });

  it('keeps the lobby panels and no game host before the game starts', () => {
    const element = render();
    expect(element.querySelectorAll('.panel').length).toBeGreaterThan(0);
    expect(element.querySelector('[data-testid="game-host-stub"]')).toBeNull();
    expect(element.classList.contains('in-game')).toBe(false);
  });

  it('shows only the game host, filling the viewport, once the room is in play (docs/UI.md §1)', () => {
    multiplayer.inGame.set(true);
    const element = render();
    expect(element.querySelector('[data-testid="game-host-stub"]')).not.toBeNull();
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.querySelector('header')).toBeNull();
    expect(element.classList.contains('in-game')).toBe(true);
  });

  it('renders the bench route alone, filling the viewport, in place of the lobby and the room (docs/RENDERING.md §7)', () => {
    isBenchRoute.value = true;
    multiplayer.inGame.set(true);
    const element = render();
    expect(element.querySelector('[data-testid="render-bench-stub"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="game-host-stub"]')).toBeNull();
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.classList.contains('in-game')).toBe(true);
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
    component.seed.set(42);
    component.createGame();
    component.joinGame('g1');
    component.startGame('g1');
    component.deleteGame('g1');
    component.disconnect();
    expect(multiplayer.createGame).toHaveBeenCalledWith(
      'New Game',
      createTestSessionConfig({ maxPlayers: DEFAULT_PLAYERS_PER_GAME, seed: 42 }),
    );
    expect(multiplayer.joinGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.startGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.deleteGame).toHaveBeenCalledWith('g1');
    expect(multiplayer.disconnect).toHaveBeenCalled();
  });

  it('draws a fresh seed inside the accepted range on request', () => {
    const component = TestBed.createComponent(AppComponent).componentInstance;
    const seeds = new Set<number>();
    for (let draw = 0; draw < 8; draw += 1) {
      component.newSeed();
      const seed = component.seed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(SEED_MAX);
      seeds.add(seed);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});
