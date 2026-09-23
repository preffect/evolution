import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  RENDER_STAGE_NAMES,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  entityId,
  type FoodMoteView,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView, createTestFoodMoteView } from '../../../testing/builders';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../testing/fake-pixi-app';
import { FIELD_TEXTURE_PX, RENDER_REPORT_EVERY_FRAMES } from './constants';
import { NO_HUD_INPUTS } from './game-renderer';
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

function session(overrides: Partial<RenderSessionDependencies> = {}) {
  const clock = new ManualClock(0);
  const pixi: FakePixiApp = createFakePixiApp();
  const audio = {
    ready: Promise.resolve(),
    observe: vi.fn(),
    updateOptions: vi.fn(),
    unlock: vi.fn(),
    disconnect: vi.fn(),
  };
  const acknowledgeSnapshot = vi.fn();
  const dependencies: RenderSessionDependencies = {
    host: document.createElement('div'),
    acknowledgeSnapshot,
    clock,
    devicePixelRatio: 1,
    createPixiApp: vi.fn(() => Promise.resolve(pixi)),
    connectAudio: vi.fn(() => audio),
    hudInputs: () => NO_HUD_INPUTS,
    shouldPreserveDrawingBuffer: false,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  };
  const subject = new RenderSession(dependencies);
  return { subject, clock, pixi, audio, dependencies, acknowledgeSnapshot };
}

function snapshotMessage(tick: number, spawned: FoodMoteView[] = [], seed = 1): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameSnapshot,
    snapshot: createTestSnapshot({
      tick,
      seed,
      cells: [createTestCellView()],
      food: { spawned, removedIds: [], moved: [] },
    }),
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The ticker's frames run a staged build one bake at a time (ticket #479): tick until every queued build is in. */
async function settle(subject: RenderSession, pixi: FakePixiApp): Promise<void> {
  for (let frame = 0; frame < SETTLE_FRAMES_MAX; frame += 1) {
    await flush();
    if (!subject.isBuildingRenderer) return;
    pixi.tick();
  }
  throw new Error(`The renderer build did not settle in ${SETTLE_FRAMES_MAX} frames.`);
}

const SETTLE_FRAMES_MAX = 100;

describe('RenderSession', () => {
  it('creates the Pixi app once, on the first game_state, and takes over its ticker', async () => {
    const { subject, pixi, dependencies } = session();
    expect(subject.debugApi().renderTick()).toBeNull();
    subject.onMessage(gameState());
    await settle(subject, pixi);
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.tickerCallbacks).toHaveLength(1);
    expect(pixi.bakedSpecs).toHaveLength(2);
    subject.onMessage(gameState());
    await settle(subject, pixi);
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.bakedSpecs).toHaveLength(2);
  });

  it('rebuilds the renderer once when a snapshot carries a new round seed (a rematch sends no game_state)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState(1));
    await settle(subject, pixi);
    const afterFirstBuild = pixi.bakedCanvases.length;
    subject.onMessage(snapshotMessage(3, [], 2));
    subject.onMessage(snapshotMessage(4, [], 2));
    await settle(subject, pixi);
    const oneRebuild = pixi.bakedCanvases.length - afterFirstBuild;
    expect(oneRebuild).toBeGreaterThan(0);
    // A third snapshot on the same seed asks for nothing; a third seed costs exactly one more rebuild.
    subject.onMessage(snapshotMessage(5, [], 2));
    await settle(subject, pixi);
    expect(pixi.bakedCanvases).toHaveLength(afterFirstBuild + oneRebuild);
    subject.onMessage(snapshotMessage(6, [], 3));
    await settle(subject, pixi);
    expect(pixi.bakedCanvases).toHaveLength(afterFirstBuild + oneRebuild * 2);
    // The seed-independent half was baked on the first build and kept across both rematches (ticket #442).
    expect(pixi.bakedSpecs).toHaveLength(2);
    expect(pixi.stage.children).toHaveLength(2);
    expect(subject.store.latestSnapshot()?.tick).toBe(6);
  });

  it('applies every snapshot on arrival, in order, so a frame hitch drops no delta; the frame loop only reads', async () => {
    const { subject, pixi, audio, clock } = session();
    subject.onMessage(gameState());
    await settle(subject, pixi);
    const first = snapshotMessage(3, [createTestFoodMoteView({ id: entityId('a') })]);
    const second = snapshotMessage(6, [createTestFoodMoteView({ id: entityId('b') })]);
    subject.onMessage(first);
    subject.onMessage(second);
    expect(audio.observe).toHaveBeenCalledTimes(2);
    clock.setMilliseconds(6 * TICK_INTERVAL_MS);
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
    expect(subject.debugApi().renderTick()).not.toBeNull();
    expect(subject.store.nextFrame()!.motes.map((mote) => mote.id)).toEqual(['a', 'b']);
  });

  it('acknowledges a game_state at once and then one snapshot in every SNAPSHOT_ACK_EVERY_SNAPSHOTS (#266)', async () => {
    const { subject, acknowledgeSnapshot } = session();
    const state = gameState();
    subject.onMessage(state);
    await flush();
    const stateTick = (state as { snapshot: { tick: number } }).snapshot.tick;
    expect(acknowledgeSnapshot.mock.calls).toEqual([[stateTick]]);

    const firstDeltaTick = stateTick + 1;
    for (let index = 0; index < SNAPSHOT_ACK_EVERY_SNAPSHOTS; index += 1) {
      subject.onMessage(snapshotMessage(firstDeltaTick + index));
    }
    expect(acknowledgeSnapshot.mock.calls).toEqual([[stateTick], [firstDeltaTick + SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1]]);
  });

  it('does not acknowledge a snapshot the store refused as stale (#266)', async () => {
    const { subject, acknowledgeSnapshot } = session();
    subject.onMessage(gameState());
    await flush();
    const applied = 10;
    for (let index = 0; index < SNAPSHOT_ACK_EVERY_SNAPSHOTS - 1; index += 1) {
      subject.onMessage(snapshotMessage(applied + index));
    }
    acknowledgeSnapshot.mockClear();
    subject.onMessage(snapshotMessage(1));
    expect(acknowledgeSnapshot).not.toHaveBeenCalled();
  });

  it('creates one Pixi app when two game_state messages arrive before the factory resolves; the last seed wins', async () => {
    const pixi = createFakePixiApp();
    let resolveApp: (handle: FakePixiApp) => void = () => undefined;
    const createPixiApp = vi.fn(() => new Promise<FakePixiApp>((resolve) => (resolveApp = resolve)));
    const { subject } = session({ createPixiApp });
    subject.onMessage(gameState(1));
    subject.onMessage(gameState(2));
    await flush();
    resolveApp(pixi);
    await settle(subject, pixi);
    await flush();
    expect(createPixiApp).toHaveBeenCalledTimes(1);
    // Two builds queued behind the one app: one seed-independent half, two seeded ones (ticket #442).
    expect(pixi.bakedSpecs).toHaveLength(2);
    expect(pixi.bakedCanvases.filter((canvas) => canvas.width === FIELD_TEXTURE_PX)).toHaveLength(2);
    expect(pixi.stage.children).toHaveLength(2);
    expect(subject.startupError).toBeNull();
  });

  it('records a factory rejection as the start-up error, logs it once, and lets the next game_state retry', async () => {
    const failure = new Error('no WebGL');
    const createPixiApp = vi.fn(() => Promise.reject(failure));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { subject, pixi } = session({ createPixiApp });
    subject.onMessage(gameState());
    await flush();
    expect(subject.startupError).toBe(failure);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(pixi.tickerCallbacks).toHaveLength(0);
    subject.onMessage(gameState());
    await flush();
    expect(createPixiApp).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('holds frames while paused and renders exactly the stepped ones', async () => {
    const { subject, pixi, clock } = session();
    subject.onMessage(gameState());
    await settle(subject, pixi);
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
  });

  it('rebuilds the frame-budget report every RENDER_REPORT_EVERY_FRAMES frames with every stage key (docs/rendering/budget.md §7)', async () => {
    const { subject, pixi, clock } = session();
    subject.onMessage(gameState());
    await settle(subject, pixi);
    const api = subject.debugApi();
    for (let frame = 0; frame < RENDER_REPORT_EVERY_FRAMES - 1; frame += 1) {
      clock.advanceMilliseconds(TICK_INTERVAL_MS);
      pixi.tick();
    }
    expect(api.performanceReport()).toBeNull();
    pixi.tick();
    const report = api.performanceReport()!;
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    expect(report).toMatchObject({ drawCalls: 0, gpuMs: null, heapMb: null, visibleCells: 1, visibleMotes: 0 });
    expect(subject.instrumentation.frameCount).toBe(RENDER_REPORT_EVERY_FRAMES);
  });

  it('bakes a room one step per frame, drawing nothing until the renderer swaps in (#479)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState());
    await flush();
    // The game_state baked nothing on arrival: every bake waits for a frame.
    expect(subject.isBuildingRenderer).toBe(true);
    expect(pixi.textures.texturedBakes).toHaveLength(0);
    pixi.tick();
    expect(pixi.textures.texturedBakes, 'the first frame ran more than the one bake').toHaveLength(1);
    expect(pixi.textures.bakedSpecs).toHaveLength(0);
    await settle(subject, pixi);
    expect(pixi.renderCalls.count, 'a frame drew before the renderer was built').toBe(0);
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
  });

  it('keeps drawing the old round while a rematch bakes, one bake per frame (#479)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState(1));
    await settle(subject, pixi);
    subject.onMessage(snapshotMessage(3, [], 2));
    await flush();
    expect(subject.isBuildingRenderer).toBe(true);
    pixi.tick();
    pixi.tick();
    expect(pixi.renderCalls.count, 'the old renderer stopped drawing during the rebake').toBe(2);
    await settle(subject, pixi);
    expect(pixi.stage.children).toHaveLength(2);
  });

  it('frees what a build had baked when the room is torn down mid-bake: every font it installed goes (#479)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState());
    await flush();
    while (pixi.textures.installedFonts.length === 0) pixi.tick();
    expect(subject.isBuildingRenderer).toBe(true);
    subject.destroy();
    expect(pixi.textures.uninstalledFonts).toEqual(pixi.textures.installedFonts.map((install) => install.name));
    expect(pixi.lifecycle.isDestroyed).toBe(true);
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
