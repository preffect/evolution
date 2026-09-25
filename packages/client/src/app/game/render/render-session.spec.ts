import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  RENDER_STAGE_NAMES,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  TICK_INTERVAL_MS,
  entityId,
  playerId,
  type ServerMessage,
} from '@evolution/shared';
import { createTestFoodMoteView } from '../../../testing/builders';
import { createFakePixiApp, type FakePixiApp } from '../../../testing/fake-pixi-app';
import {
  flush,
  gameState,
  renderSessionUnderTest as session,
  settle,
  snapshotMessage,
} from '../../../testing/render-session-harness';
import { FIELD_TEXTURE_PX, RENDER_REPORT_EVERY_FRAMES } from './constants';

/** The soft disc, the vignette and the band edge ramp (#684): baked once per Pixi app. */
const RADIAL_BAKES_PER_APP = 3;

describe('RenderSession', () => {
  it('creates the Pixi app once, on the first game_state, and takes over its ticker', async () => {
    const { subject, pixi, dependencies } = session();
    expect(subject.debugApi().renderTick()).toBeNull();
    subject.onMessage(gameState());
    await settle(subject, pixi);
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.tickerCallbacks).toHaveLength(1);
    expect(pixi.bakedSpecs).toHaveLength(RADIAL_BAKES_PER_APP);
    subject.onMessage(gameState());
    await settle(subject, pixi);
    expect(dependencies.createPixiApp).toHaveBeenCalledTimes(1);
    expect(pixi.bakedSpecs).toHaveLength(RADIAL_BAKES_PER_APP);
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
    expect(pixi.bakedSpecs).toHaveLength(RADIAL_BAKES_PER_APP);
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
    // Two builds queued behind the one app, the first superseded before it began: it bakes nothing (#479 review),
    // and the second bakes the seed-independent half and its own seeded one.
    expect(pixi.bakedSpecs).toHaveLength(RADIAL_BAKES_PER_APP);
    expect(pixi.bakedCanvases.filter((canvas) => canvas.width === FIELD_TEXTURE_PX)).toHaveLength(1);
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

  it('#275: keeps the audio session through a resync game_state; another player starts a new one', () => {
    const { subject, audio, dependencies } = session();
    subject.onMessage(gameState());
    subject.onMessage(gameState());
    expect(dependencies.connectAudio).toHaveBeenCalledTimes(1);
    expect(audio.disconnect).not.toHaveBeenCalled();
    expect(audio.updateOptions).toHaveBeenCalledWith({ balance: DEFAULT_BALANCE });
    subject.onMessage({ ...gameState(), playerId: playerId('someone-else') } as ServerMessage);
    expect(dependencies.connectAudio).toHaveBeenCalledTimes(2);
    expect(audio.disconnect).toHaveBeenCalledTimes(1);
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
