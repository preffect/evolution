import { describe, expect, it, vi } from 'vitest';
import {
  SETTLE_FRAMES_MAX,
  flush,
  gameState,
  renderSessionUnderTest as session,
  settle,
  snapshotMessage,
} from '../../../testing/render-session-harness';

/** The live room's staged renderer build (ticket #479): one bake per frame, the old round drawing meanwhile. */
describe('RenderSession: the staged renderer build', () => {
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
    const bakedBeforeTeardown = [...pixi.textures.madeTextures];
    subject.destroy();
    expect(pixi.textures.uninstalledFonts).toEqual(pixi.textures.installedFonts.map((install) => install.name));
    expect(bakedBeforeTeardown.length).toBeGreaterThan(0);
    expect(
      bakedBeforeTeardown.every((texture) => texture.destroyed),
      'a texture baked before the teardown leaked',
    ).toBe(true);
    expect(pixi.lifecycle.isDestroyed).toBe(true);
  });

  it('records a bake that throws partway as the start-up error; the ticker runs on and the next build proceeds (#479 review)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { subject, pixi } = session();
    const failure = new Error('context lost mid-bake');
    const bakeRadial = pixi.textures.bakeRadial.bind(pixi.textures);
    const failing = vi.spyOn(pixi.textures, 'bakeRadial').mockImplementationOnce(() => {
      throw failure;
    });
    subject.onMessage(gameState(1));
    await flush();
    for (let frame = 0; frame < SETTLE_FRAMES_MAX && subject.startupError === null; frame += 1) {
      expect(() => pixi.tick(), 'a failing bake escaped into the ticker').not.toThrow();
      await flush();
    }
    expect(subject.startupError).toBe(failure);
    expect(subject.isBuildingRenderer).toBe(false);
    expect(pixi.tickerCallbacks).toHaveLength(1);

    failing.mockImplementation(bakeRadial);
    subject.onMessage(snapshotMessage(3, [], 2));
    await settle(subject, pixi);
    pixi.tick();
    expect(pixi.renderCalls.count, 'the next build did not proceed after the failure').toBe(1);
    consoleError.mockRestore();
  });
});
