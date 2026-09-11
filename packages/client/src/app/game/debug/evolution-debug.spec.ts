import { describe, expect, it } from 'vitest';
import {
  EVOLUTION_DEBUG_KEY,
  EVOLUTION_DEBUG_MODE,
  FrameGate,
  installEvolutionDebug,
  type EvolutionDebugApi,
  type EvolutionDebugHost,
} from './evolution-debug';

const api: EvolutionDebugApi = {
  mode: EVOLUTION_DEBUG_MODE.live,
  pause: () => undefined,
  resume: () => undefined,
  step: () => undefined,
  setSeed: () => false,
  isPaused: () => false,
  renderTick: () => null,
  performanceReport: () => null,
};

describe('installEvolutionDebug', () => {
  it('installs the hook in dev mode and removes it again', () => {
    const host: EvolutionDebugHost = {};
    const uninstall = installEvolutionDebug(host, api, true);
    expect(host[EVOLUTION_DEBUG_KEY]).toBe(api);
    uninstall();
    expect(host[EVOLUTION_DEBUG_KEY]).toBeUndefined();
  });

  it('installs nothing in production and never removes another hook', () => {
    const host: EvolutionDebugHost = {};
    installEvolutionDebug(host, api, false)();
    expect(host[EVOLUTION_DEBUG_KEY]).toBeUndefined();
    const other = { ...api };
    const uninstall = installEvolutionDebug(host, api, true);
    host[EVOLUTION_DEBUG_KEY] = other;
    uninstall();
    expect(host[EVOLUTION_DEBUG_KEY]).toBe(other);
  });
});

describe('FrameGate', () => {
  it('runs every frame until paused, then only the stepped ones', () => {
    const gate = new FrameGate();
    expect(gate.claimFrame()).toBe(true);
    gate.pause();
    expect(gate.isPaused()).toBe(true);
    expect(gate.claimFrame()).toBe(false);
    gate.step(2);
    expect([gate.claimFrame(), gate.claimFrame(), gate.claimFrame()]).toEqual([true, true, false]);
    gate.resume();
    expect(gate.claimFrame()).toBe(true);
  });

  it('pauses on a step from a running state and ignores a non-positive step', () => {
    const gate = new FrameGate();
    gate.step(0);
    expect(gate.isPaused()).toBe(true);
    expect(gate.claimFrame()).toBe(false);
    gate.step();
    expect(gate.claimFrame()).toBe(true);
  });
});
