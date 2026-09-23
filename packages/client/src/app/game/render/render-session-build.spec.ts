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

  it('projects the pointer through the camera the new renderer will open on, while it still bakes (#479)', async () => {
    const { subject, pixi } = session();
    expect(subject.projectPointer({ x: 0, y: 0 }), 'no snapshot yet, nothing to project through').toBeNull();
    subject.onMessage(gameState());
    await flush();
    expect(subject.isBuildingRenderer).toBe(true);
    const centre = subject.projectPointer({ x: pixi.screen.width / 2, y: pixi.screen.height / 2 })!;
    const [own] = subject.store.latestSnapshot()!.cells;
    expect(centre.offsetFromViewCentre.x).toBeCloseTo(0, 6);
    expect(centre.offsetFromViewCentre.y).toBeCloseTo(0, 6);
    expect(centre.worldPoint.x).toBeCloseTo(own!.x, 6);
    const right = subject.projectPointer({ x: pixi.screen.width, y: pixi.screen.height / 2 })!;
    expect(right.offsetFromViewCentre.x).toBeGreaterThan(0);

    await settle(subject, pixi);
    pixi.tick();
    const drawn = subject.projectPointer({ x: pixi.screen.width / 2, y: pixi.screen.height / 2 })!;
    expect(drawn.worldPoint.x, 'the live camera opened somewhere else than the one steered through').toBeCloseTo(
      centre.worldPoint.x,
      6,
    );
  });

  it('warms the new renderer off the stage before the reveal: uploads, one muted draw, one off-screen render (#603)', async () => {
    const { subject, pixi } = session();
    subject.onMessage(gameState());
    // Spied after the game_state, whose arrival accrues to `net`: from here on only the build runs.
    const measured = vi.spyOn(subject.instrumentation.timer, 'measure');
    const accrued = vi.spyOn(subject.instrumentation.timer, 'accrue');
    await settle(subject, pixi);
    expect(pixi.warmUpCalls.uploads.length).toBeGreaterThan(0);
    expect(pixi.warmUpCalls.offscreenRenders).toHaveLength(1);
    expect(pixi.warmUpCalls.offscreenRenders[0]).not.toBe(pixi.stage);
    // The warm-up draw neither submitted nor sampled: no render call, no stage bracket reached the timer.
    expect(pixi.renderCalls.count).toBe(0);
    expect(
      measured.mock.calls.map(([stage]) => stage),
      'the warm-up draw put a stage sample in the report',
    ).toEqual([]);
    expect(
      accrued.mock.calls.map(([stage]) => stage),
      'the warm-up draw accrued to a stage',
    ).toEqual([]);
    expect(subject.instrumentation.frameCount).toBe(0);
  });
});
