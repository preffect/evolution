import { TestBed } from '@angular/core/testing';
import { Component, signal, type OnDestroy } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLAYERS_PER_GAME,
  SEED_MAX,
  createTestSessionConfig,
  gameId,
  playerId,
  type LobbyGameInfo,
} from '@evolution/shared';
import { AppComponent } from './app.component';
import { DEVELOPMENT_ROUTE, type DevelopmentRoute } from './development-route/development-route';
import { DEVELOPMENT_ROUTE_COMPONENT_LOADER } from './development-route/development-route-loader';
import { GameHostComponent } from './game/game-host.component';
import { HUD_TEST_ID } from './game/test-ids/hud-test-ids';
import { IS_BENCH_ROUTE } from './game/render/bench/bench-route';
import { MultiplayerService, type LobbyNotice } from './services/multiplayer.service';

/**
 * Stands in for the game host, which would try to create a WebGL Pixi app under jsdom. It counts its
 * destructions: the real host's `ngOnDestroy` is what tears the Pixi app down.
 */
@Component({ selector: 'app-game-host', standalone: true, template: '<div data-testid="game-host-stub"></div>' })
class GameHostStubComponent implements OnDestroy {
  static destroyedCount = 0;

  ngOnDestroy(): void {
    GameHostStubComponent.destroyedCount += 1;
  }
}

/** Stands in for the bench route, which would create a WebGL Pixi app under jsdom; the stub loader hands it over. */
@Component({ selector: 'app-render-bench', standalone: true, template: '<div data-testid="render-bench-stub"></div>' })
class RenderBenchStubComponent {}

function createMultiplayerStub() {
  return {
    connected: signal(false),
    lastError: signal<string | null>(null),
    lobbyNotice: signal<LobbyNotice | null>(null),
    inGame: signal(false),
    games: signal<LobbyGameInfo[]>([]),
    snapshot: signal<unknown>(null),
    balance: signal(null),
    avatarAssignments: signal({}),
    sessionConfig: signal(null),
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
  const loadedRoutes: DevelopmentRoute[] = [];

  beforeEach(async () => {
    multiplayer = createMultiplayerStub();
    isBenchRoute.value = false;
    loadedRoutes.length = 0;
    GameHostStubComponent.destroyedCount = 0;
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: MultiplayerService, useValue: multiplayer },
        { provide: IS_BENCH_ROUTE, useFactory: () => isBenchRoute.value },
        {
          provide: DEVELOPMENT_ROUTE_COMPONENT_LOADER,
          useValue: (route: DevelopmentRoute) => {
            loadedRoutes.push(route);
            return Promise.resolve(RenderBenchStubComponent);
          },
        },
      ],
    })
      .overrideComponent(AppComponent, {
        remove: { imports: [GameHostComponent] },
        add: { imports: [GameHostStubComponent] },
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

  it('shows the game host with the HUD over it, filling the viewport, in play (docs/ui/layout.md §1)', () => {
    multiplayer.inGame.set(true);
    const element = render();
    expect(element.querySelector('[data-testid="game-host-stub"]')).not.toBeNull();
    expect(element.querySelector(`[data-testid="${HUD_TEST_ID.hud}"]`)).not.toBeNull();
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.querySelector('header')).toBeNull();
    expect(element.classList.contains('in-game')).toBe(true);
  });

  it('brings the header and lobby panels back and destroys the game host when play ends (#220)', () => {
    multiplayer.inGame.set(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="game-host-stub"]')).not.toBeNull();

    multiplayer.inGame.set(false);
    fixture.detectChanges();
    expect(element.querySelector('header')).not.toBeNull();
    expect(element.querySelectorAll('.panel').length).toBeGreaterThan(0);
    expect(element.querySelector('[data-testid="game-host-stub"]')).toBeNull();
    expect(element.querySelector(`[data-testid="${HUD_TEST_ID.hud}"]`)).toBeNull();
    expect(element.classList.contains('in-game')).toBe(false);
    expect(GameHostStubComponent.destroyedCount).toBe(1);
  });

  it('loads nothing on demand for the lobby or the room', () => {
    multiplayer.inGame.set(true);
    render();
    expect(loadedRoutes).toEqual([]);
  });

  it('renders the bench route alone, filling the viewport, in place of the lobby and the room (docs/rendering/budget.md §7)', async () => {
    isBenchRoute.value = true;
    multiplayer.inGame.set(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.classList.contains('in-game'), 'the shell gives way before the chunk arrives').toBe(true);
    expect(element.querySelector('.panel')).toBeNull();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(loadedRoutes).toEqual([DEVELOPMENT_ROUTE.bench]);
    expect(element.querySelector('[data-testid="render-bench-stub"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="game-host-stub"]')).toBeNull();
    expect(element.querySelector(`[data-testid="${HUD_TEST_ID.hud}"]`)).toBeNull();
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

  it('greys out Join on a full room, started or not, and keeps it on a room with a free seat (#365)', () => {
    const humans = (count: number) =>
      Array.from({ length: count }, (_unused, index) => ({
        playerId: playerId(`p${index}`),
        playerName: `P${index}`,
        avatarIndex: index,
      }));
    const row = (id: string, count: number, isStarted: boolean): LobbyGameInfo => ({
      gameId: gameId(id),
      gameName: id,
      players: humans(count),
      maxPlayers: 2,
      isStarted,
      creatorId: playerId('p0'),
    });
    multiplayer.games.set([row('full-started', 2, true), row('full-pending', 2, false), row('open-started', 1, true)]);
    const element = render();
    const join = (id: string) => element.querySelector(`[data-testid="game-join-${id}"]`);
    expect(join('full-started')?.getAttribute('aria-disabled')).toBe('true');
    expect(join('full-pending')?.getAttribute('aria-disabled')).toBe('true');
    expect(join('open-started')?.getAttribute('aria-disabled')).not.toBe('true');
    expect(element.querySelector('[data-testid="game-row-full-started"]')?.textContent).toContain('2/2');
  });
});
