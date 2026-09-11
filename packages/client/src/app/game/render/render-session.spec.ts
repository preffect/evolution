import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../../testing/builders';
import { createFakePixiApp, type FakePixiApp } from '../../../testing/fake-pixi-app';
import { RenderSession, type RenderSessionDependencies } from './render-session';

function gameState(seed = 1): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('g'),
    playerId: TEST_OWN_PLAYER_ID,
    snapshot: createTestSnapshot({ seed, cells: [createTestCellView()] }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [TEST_OWN_PLAYER_ID],
    avatarAssignments: {},
  };
}

function session(snapshots: ServerMessage[] = []) {
  const clock = new ManualClock(0);
  const pixi: FakePixiApp = createFakePixiApp();
  const audio = {
    ready: Promise.resolve(),
    observe: vi.fn(),
    updateOptions: vi.fn(),
    unlock: vi.fn(),
    disconnect: vi.fn(),
  };
  const dependencies: RenderSessionDependencies = {
    host: document.createElement('div'),
    clock,
    devicePixelRatio: 1,
    createPixiApp: vi.fn(() => Promise.resolve(pixi)),
    connectAudio: vi.fn(() => audio),
    hudInputs: () => ({ previewTraitId: null, reticle: { isVisible: false, x: 0, y: 0 } }),
  };
  const subject = new RenderSession(dependencies, () => snapshots.shift() ?? null);
  return { subject, clock, pixi, audio, dependencies };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('RenderSession', () => {
  it('creates the Pixi app once, on the first game_state, and takes over its ticker', async () => {
    const { subject, pixi, dependencies } = session();
    expect(subject.debugApi().renderTick()).toBeNull();
    subject.onMessage(gameState());
    await flush();
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.tickerCallbacks).toHaveLength(1);
    expect(pixi.bakedSpecs).toHaveLength(2);
    subject.onMessage(gameState());
    await flush();
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.bakedSpecs).toHaveLength(2);
  });

  it('rebuilds the renderer when the seed changes (a rematch)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState(1));
    await flush();
    subject.onMessage(gameState(2));
    await flush();
    expect(pixi.bakedSpecs).toHaveLength(4);
    expect(pixi.stage.children).toHaveLength(2);
  });

  it('renders one frame per tick from the drained snapshot and feeds the audio handle', async () => {
    const snapshot = createTestSnapshot({ tick: 3, cells: [createTestCellView()] });
    const { subject, pixi, audio, clock } = session([{ type: SERVER_MESSAGE_TYPE.gameSnapshot, snapshot }]);
    subject.onMessage(gameState());
    await flush();
    clock.setMilliseconds(3 * TICK_INTERVAL_MS);
    pixi.tick();
    expect(audio.observe).toHaveBeenCalledWith(snapshot);
    expect(pixi.renderCalls.count).toBe(1);
    expect(subject.debugApi().renderTick()).not.toBeNull();
  });

  it('holds frames while paused and renders exactly the stepped ones', async () => {
    const { subject, pixi, clock } = session();
    subject.onMessage(gameState());
    await flush();
    const api = subject.debugApi();
    expect(api.renderTick()).toBeNull();
    pixi.tick();
    const renderedTick = api.renderTick();
    expect(renderedTick).not.toBeNull();
    api.pause();
    clock.advanceMilliseconds(TICK_INTERVAL_MS);
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
    expect(api.renderTick()).toBe(renderedTick);
    pixi.renderCalls.count = 0;
    api.step(2);
    pixi.tick();
    pixi.tick();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(2);
    expect(api.isPaused()).toBe(true);
    api.resume();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(3);
    expect(api.mode).toBe('live');
    expect(api.setSeed(9)).toBe(false);
    expect(api.performanceReport()).toBeNull();
  });

  it('applies balance updates to the store and the audio handle', async () => {
    const { subject, audio } = session();
    subject.onMessage(gameState());
    await flush();
    subject.onMessage({ type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: DEFAULT_BALANCE });
    expect(audio.updateOptions).toHaveBeenCalledWith({ balance: DEFAULT_BALANCE });
    expect(subject.store.balance).toBe(DEFAULT_BALANCE);
  });

  it('destroys the app and the audio, and drops a Pixi app that arrives after destroy', async () => {
    const { subject, pixi, audio } = session();
    subject.onMessage(gameState());
    subject.destroy();
    await flush();
    expect(audio.disconnect).toHaveBeenCalled();
    expect(pixi.lifecycle.isDestroyed).toBe(true);
    expect(pixi.tickerCallbacks).toHaveLength(0);
  });
});
