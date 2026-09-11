import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { Container } from 'pixi.js';
import {
  TEST_OTHER_PLAYER_ID,
  TEST_OWN_PLAYER_ID,
  createTestCellView,
  createTestRenderFrame,
} from '../../../testing/builders';
import { createFakePixiApp } from '../../../testing/fake-pixi-app';
import { GameRenderer, type RenderInputs } from './game-renderer';
import { createRenderTextures } from './render-textures';

const INPUTS: RenderInputs = { previewTraitId: null, reticle: { isVisible: false, x: 0, y: 0 } };
const VIEWPORT = { width: 800, height: 600 };

function renderer(): { renderer: GameRenderer; stage: Container; submits: { count: number } } {
  const pixi = createFakePixiApp(VIEWPORT);
  const textures = createRenderTextures({ seed: 3, baker: pixi.textures });
  const submits = { count: 0 };
  return { renderer: new GameRenderer(pixi.stage, textures, VIEWPORT), stage: pixi.stage, submits };
}

describe('GameRenderer', () => {
  it('builds the world and screen roots on the stage and reports the seed', () => {
    const { renderer: subject, stage } = renderer();
    expect(stage.children).toHaveLength(2);
    expect(subject.seed).toBe(3);
  });

  it('renders a frame: follows the own cell, submits once, reports the extent and the visible count', () => {
    const { renderer: subject } = renderer();
    const submits = { count: 0 };
    const cells = [
      createTestCellView({ x: 40, y: 30 }),
      createTestCellView({ id: entityId('c-far'), playerId: TEST_OTHER_PLAYER_ID, x: 5000, y: 5000 }),
    ];
    const outputs = subject.render(createTestRenderFrame({ cells }), TEST_OWN_PLAYER_ID, INPUTS, () => {
      submits.count += 1;
    });
    expect(submits.count).toBe(1);
    expect(outputs.visibleCells).toBe(1);
    expect(outputs.visibleMotes).toBe(0);
    expect(outputs.zoom).toBeGreaterThan(0);
    expect(outputs.cameraExtent.minX).toBeLessThan(40);
    expect(outputs.cameraExtent.maxX).toBeGreaterThan(40);
    const centre = subject.screenToWorld(VIEWPORT.width / 2, VIEWPORT.height / 2);
    expect(centre.x).toBeCloseTo(40);
    expect(centre.y).toBeCloseTo(30);
  });

  it('holds a fixed zoom when asked and releases it', () => {
    const { renderer: subject } = renderer();
    const frame = createTestRenderFrame();
    subject.setFixedZoom(2);
    expect(subject.render(frame, TEST_OWN_PLAYER_ID, INPUTS, () => undefined).zoom).toBeCloseTo(2);
    subject.setFixedZoom(null);
    subject.parkOn({ x: 0, y: 0, radius: 4 });
    expect(subject.render(frame, TEST_OWN_PLAYER_ID, INPUTS, () => undefined).zoom).not.toBeCloseTo(2);
  });

  it('resizes the vignette to the viewport and destroys the roots', () => {
    const { renderer: subject, stage } = renderer();
    subject.resize({ width: 300, height: 200 });
    const screen = stage.children[1]!;
    expect(screen.children[0]?.width).toBe(300);
    expect(screen.children[0]?.height).toBe(200);
    subject.destroy();
    expect(stage.children).toHaveLength(0);
  });
});
