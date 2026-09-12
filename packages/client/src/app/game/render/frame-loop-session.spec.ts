import { describe, expect, it } from 'vitest';
import { ManualClock } from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestRenderFrame } from '../../../testing/builders';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp } from '../../../testing/fake-pixi-app';
import { FrameLoopSession } from './frame-loop-session';
import { NO_RETICLE, type GameRenderer, type RenderOutputs } from './game-renderer';
import type { RenderFrame } from '../net/world-store';

/** The smallest loop: one fixed frame, counting what came after each render. */
class FixedFrameSession extends FrameLoopSession {
  readonly outputs: RenderOutputs[] = [];
  frameToDraw: RenderFrame | null = null;

  constructor() {
    super(new ManualClock(0));
  }

  adopt(pixi: ReturnType<typeof createFakePixiApp>): GameRenderer | null {
    this.adoptPixiApp(pixi);
    return this.buildRenderer({
      seed: 1,
      gelPatches: [],
      devicePixelRatio: 1,
      noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    });
  }

  hook() {
    return this.gateDebugMembers();
  }

  dispose(): void {
    this.disposeLoop();
  }

  protected nextFrame(): RenderFrame | null {
    return this.frameToDraw;
  }

  protected renderFrame(renderer: GameRenderer, frame: RenderFrame, submit: () => void): RenderOutputs {
    return renderer.render(frame, TEST_OWN_PLAYER_ID, { previewTraitId: null, reticle: NO_RETICLE }, submit);
  }

  protected afterFrame(outputs: RenderOutputs): void {
    this.outputs.push(outputs);
  }
}

describe('FrameLoopSession', () => {
  it('renders nothing before an app is adopted and a renderer built, then one frame per ticker fire', () => {
    const session = new FixedFrameSession();
    const pixi = createFakePixiApp();
    session.frame();
    expect(session.outputs).toEqual([]);
    expect(session.lastRenderedTick).toBeNull();
    expect(session.adopt(pixi)).not.toBeNull();
    expect(pixi.tickerCallbacks).toHaveLength(1);
    pixi.tick();
    expect(session.outputs).toEqual([]);
    session.frameToDraw = createTestRenderFrame({ renderTick: 7 });
    pixi.tick();
    expect(session.outputs).toHaveLength(1);
    expect(session.lastRenderedTick).toBe(7);
    expect(session.hook().renderTick()).toBe(7);
    expect(pixi.renderCalls.count).toBe(1);
    expect(session.instrumentation.frameCount).toBe(1);
  });

  it('holds frames while the gate is paused and drops everything on dispose', () => {
    const session = new FixedFrameSession();
    const pixi = createFakePixiApp();
    session.adopt(pixi);
    session.frameToDraw = createTestRenderFrame({ renderTick: 3 });
    const hook = session.hook();
    hook.pause();
    pixi.tick();
    expect(hook.isPaused()).toBe(true);
    expect(pixi.renderCalls.count).toBe(0);
    hook.resume();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
    session.dispose();
    expect(session.lastRenderedTick).toBeNull();
    expect(pixi.lifecycle.isDestroyed).toBe(true);
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
  });
});
