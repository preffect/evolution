// The deterministic screenshot hook (docs/TESTING.md, docs/RENDERING.md §1): `window.__evolutionDebug`
// in dev builds only, mirroring the debug MCP's pause / step / resume for the client loop and
// the bench's seed. A paused loop holds the render tick, so every frame is identical until it
// resumes; `step` renders exactly that many frames (bench: that many ticks).

import type { ClientPerformanceReport } from '@evolution/shared';

export const EVOLUTION_DEBUG_MODE = { live: 'live', bench: 'bench' } as const;
export type EvolutionDebugMode = (typeof EVOLUTION_DEBUG_MODE)[keyof typeof EVOLUTION_DEBUG_MODE];

export interface EvolutionDebugApi {
  readonly mode: EvolutionDebugMode;
  pause(): void;
  resume(): void;
  /** Renders `frames` frames while paused (the bench advances that many ticks); default 1. */
  step(frames?: number): void;
  /** Bench only: rebuilds the scene from `seed`; `false` in live mode. */
  setSeed(seed: number): boolean;
  isPaused(): boolean;
  renderTick(): number | null;
  performanceReport(): ClientPerformanceReport | null;
}

export const EVOLUTION_DEBUG_KEY = '__evolutionDebug';

export interface EvolutionDebugHost {
  [EVOLUTION_DEBUG_KEY]?: EvolutionDebugApi;
}

/** Installs the hook when `isDevMode`; returns the uninstaller (a no-op in production). */
export function installEvolutionDebug(
  host: EvolutionDebugHost,
  api: EvolutionDebugApi,
  isDevelopmentMode: boolean,
): () => void {
  if (!isDevelopmentMode) return () => undefined;
  host[EVOLUTION_DEBUG_KEY] = api;
  return () => {
    if (host[EVOLUTION_DEBUG_KEY] === api) delete host[EVOLUTION_DEBUG_KEY];
  };
}

/** The pause / step bookkeeping both modes share: a frame runs when not paused, or when stepped. */
export class FrameGate {
  private isPausedValue = false;
  private pendingSteps = 0;

  pause(): void {
    this.isPausedValue = true;
  }

  resume(): void {
    this.isPausedValue = false;
    this.pendingSteps = 0;
  }

  step(frames = 1): void {
    this.isPausedValue = true;
    this.pendingSteps += Math.max(0, Math.floor(frames));
  }

  isPaused(): boolean {
    return this.isPausedValue;
  }

  /** Whether this frame should run; consumes one pending step while paused. */
  claimFrame(): boolean {
    if (!this.isPausedValue) return true;
    if (this.pendingSteps <= 0) return false;
    this.pendingSteps -= 1;
    return true;
  }
}
