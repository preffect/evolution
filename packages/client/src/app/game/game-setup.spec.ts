import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  playerId,
  type ServerMessage,
} from '@evolution/shared';
import { EVOLUTION_DEBUG_KEY, type EvolutionDebugHost } from './debug/evolution-debug';
import { setupGame, type GameSetupDependencies } from './game-setup';
import type { TransitionOptions } from './state/snapshot-transitions';

function dependencies(overrides: Partial<GameSetupDependencies> = {}): GameSetupDependencies {
  const handle = {
    ready: Promise.resolve(),
    observe: vi.fn(),
    updateOptions: vi.fn(),
    unlock: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    clock: new ManualClock(),
    connectAudio: vi.fn((_options: TransitionOptions) => handle),
    reportPerformance: vi.fn(),
    documentReference: document,
    devicePixelRatio: 1,
    debugHost: {},
    isDevMode: true,
    previewTraitId: () => null,
    reticle: () => ({ isVisible: false, x: 0, y: 0 }),
    ...overrides,
  };
}

describe('setupGame', () => {
  it('returns a teardown that unsubscribes and uninstalls the debug hook', () => {
    const messages$ = new Subject<ServerMessage>();
    const debugHost: EvolutionDebugHost = {};
    const teardown = setupGame(
      { send: vi.fn(), messages$, drainLatestSnapshot: () => null, host: document.createElement('div') },
      dependencies({ debugHost }),
    );
    expect(debugHost[EVOLUTION_DEBUG_KEY]?.mode).toBe('live');
    expect(messages$.observed).toBe(true);
    teardown();
    expect(messages$.observed).toBe(false);
    expect(debugHost[EVOLUTION_DEBUG_KEY]).toBeUndefined();
  });

  it('connects the audio hooks once per game_state with the own player, the balance and the round length', () => {
    const messages$ = new Subject<ServerMessage>();
    const injected = dependencies();
    setupGame(
      { send: vi.fn(), messages$, drainLatestSnapshot: () => null, host: document.createElement('div') },
      injected,
    );
    const config = createTestSessionConfig({ roundDurationSeconds: 90 });
    messages$.next({
      type: SERVER_MESSAGE_TYPE.gameState,
      gameId: gameId('g'),
      playerId: playerId('me'),
      snapshot: createTestSnapshot(),
      balance: DEFAULT_BALANCE,
      config,
      playerIds: [playerId('me')],
      avatarAssignments: {},
    });
    expect(injected.connectAudio).toHaveBeenCalledWith({
      ownPlayerId: 'me',
      balance: DEFAULT_BALANCE,
      roundDurationSeconds: 90,
    });
  });
});
