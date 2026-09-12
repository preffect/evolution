// The cross-module wiring of slice C (docs/RENDERING.md §9): a frame's motes and fragments reach
// the food layer through the renderer, the server effects start both the cell-side clip (the
// packed pulse, dimple and alpha of the cell layer) and the effects sprites on the same render
// tick, and an absorbed prey's DNA streams flow toward the predator while its ghost dissolves.
// Frames come through the renderer's real contract, never its parts.

import { describe, expect, it } from 'vitest';
import { MILLISECONDS_PER_SECOND, MOTION_CLIPS, entityId, type DnaFragmentView } from '@evolution/shared';
import { ParticleContainer } from 'pixi.js';
import {
  TEST_OWN_PLAYER_ID,
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestFoodMoteView,
  createTestLevelUpEffect,
  createTestRenderFrame,
  createTestRespawnEffect,
} from '../../../testing/builders';
import { createFakePixiApp, createTestRenderTextures } from '../../../testing/fake-pixi-app';
import {
  BUMP_TEXEL_START,
  CELL_INSTANCE_FLOATS,
  TEXEL_FLOATS,
  instanceFieldLocation,
  type CellInstanceScalar,
} from './cells/cell-instance';
import { LAYER_Z, LEVEL_UP_RAYS, LEVEL_UP_RIPPLES } from './constants';
import { GameRenderer, NO_RETICLE, type RenderInputs } from './game-renderer';
import type { RenderFrame } from '../net/world-store';

const INPUTS: RenderInputs = { previewTraitId: null, reticle: NO_RETICLE };
const VIEWPORT = { width: 800, height: 600 };
const NO_SUBMIT = (): undefined => undefined;

function renderer(): { subject: GameRenderer; pixi: ReturnType<typeof createFakePixiApp> } {
  const pixi = createFakePixiApp(VIEWPORT);
  const textures = createTestRenderTextures({ seed: 11, baker: pixi.textures });
  return { subject: new GameRenderer(pixi.stage, textures, VIEWPORT), pixi };
}

function atMs(nowMs: number, overrides: Partial<RenderFrame>): RenderFrame {
  return createTestRenderFrame({ timeSeconds: nowMs / MILLISECONDS_PER_SECOND, ...overrides });
}

function packed(subject: GameRenderer, row: number, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return subject.cellInstances[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

describe('food and effects through the renderer', () => {
  it('uploads every mote as a particle of one container and every fragment as a sprite, and counts them', () => {
    const { subject, pixi } = renderer();
    const motes = [
      createTestFoodMoteView({ id: entityId('a'), x: 10, y: 0 }),
      createTestFoodMoteView({ id: entityId('r'), kind: 'bacterium', bacteriumVariant: 'aerobic', x: -10, y: 0 }),
    ];
    const fragments: DnaFragmentView[] = [{ id: entityId('f'), x: 0, y: 30, tag: 'photic' }];
    const outputs = subject.render(atMs(0, { motes, fragments }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    expect(outputs).toMatchObject({ visibleMotes: 2, fragments: 1, effectSprites: 0 });
    const world = pixi.stage.children[0]!;
    const foodLayer = world.children.find((layer) => layer.zIndex === LAYER_Z.food)!;
    const particles = foodLayer.children[0]!.children[0] as ParticleContainer;
    expect(particles).toBeInstanceOf(ParticleContainer);
    // Two motes plus the rod's unrotated glint particle.
    expect(particles.particleChildren).toHaveLength(3);
    expect(new Set(particles.particleChildren.map((particle) => particle.texture.source)).size).toBe(1);
    const fragmentLayer = world.children.find((layer) => layer.zIndex === LAYER_Z.fragments)!;
    expect(fragmentLayer.children[0]!.children).toHaveLength(1);
    subject.destroy();
  });

  it('plays the eat on both sides of the seam: the dimple and pulse in the packed row, the halo sprite above', () => {
    const { subject } = renderer();
    const eater = createTestCellView({ x: 0, y: 0, radius: 10 });
    subject.render(atMs(0, { cells: [eater] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    const eat = createTestEatEffect({ cellId: eater.id, x: 0, y: 20 });
    subject.render(atMs(1000, { cells: [eater], effects: [eat] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    const atPulse = subject.render(atMs(1160, { cells: [eater] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    expect(atPulse.effectSprites).toBe(2);
    expect(packed(subject, 0, 'pulse')).toBeCloseTo(1.09, 5);
    const dimpleSlot = BUMP_TEXEL_START * TEXEL_FLOATS;
    expect(subject.cellInstances[dimpleSlot]).toBeCloseTo(-0.12, 5);
    expect(subject.cellInstances[dimpleSlot + 1]).toBeCloseTo(Math.PI / 2, 5);
    const settled = subject.render(atMs(1300, { cells: [eater] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    expect(settled.effectSprites).toBe(0);
    expect(packed(subject, 0, 'pulse')).toBe(1);
    subject.destroy();
  });

  it('bursts a level-up and fades a respawn in, on the same tick the effects arrive', () => {
    const { subject } = renderer();
    const leveller = createTestCellView({ radius: 20 });
    const reborn = createTestCellView({ id: entityId('new'), playerId: null, x: 100, y: 0 });
    const effects = [createTestLevelUpEffect({ cellId: leveller.id }), createTestRespawnEffect({ cellId: reborn.id })];
    const start = subject.render(
      atMs(0, { cells: [leveller, reborn], effects }),
      TEST_OWN_PLAYER_ID,
      INPUTS,
      NO_SUBMIT,
    );
    // Only the respawn bloom at t = 0: the level-up burst waits for its keyframe.
    expect(start.effectSprites).toBe(1);
    // Rows are radius-ascending: the reborn protocell packs first, the leveller second.
    expect(packed(subject, 0, 'alpha')).toBeCloseTo(0, 5);
    const burst = subject.render(atMs(250, { cells: [leveller, reborn] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    expect(burst.effectSprites).toBe(LEVEL_UP_RAYS + 1 + LEVEL_UP_RIPPLES + 1);
    expect(packed(subject, 1, 'pulse')).toBeCloseTo(1.14, 5);
    expect(packed(subject, 0, 'alpha')).toBeGreaterThan(0);
    subject.render(
      atMs(MOTION_CLIPS.respawn.duration, { cells: [leveller, reborn] }),
      TEST_OWN_PLAYER_ID,
      INPUTS,
      NO_SUBMIT,
    );
    expect(packed(subject, 0, 'alpha')).toBe(1);
    subject.destroy();
  });

  it('streams DNA from the ghost of an absorbed prey to its predator until the ghost leaves', () => {
    const { subject } = renderer();
    const predator = createTestCellView({ id: entityId('pred'), x: 0, y: 0, mass: 200, radius: 40 });
    const prey = createTestCellView({ id: entityId('prey'), playerId: null, x: 60, y: 0, radius: 10 });
    subject.render(atMs(0, { cells: [prey, predator] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id, x: 60, y: 0 });
    subject.render(atMs(100, { cells: [predator], effects: [absorbed] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    const streaming = subject.render(atMs(600, { cells: [predator] }), TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
    expect(streaming.effectSprites).toBe(3);
    // The ghost row still precedes the predator's and dissolves at half alpha.
    expect(packed(subject, 0, 'x')).toBe(60);
    expect(packed(subject, 0, 'alpha')).toBeLessThan(1);
    const done = subject.render(
      atMs(100 + MOTION_CLIPS.absorbed.duration, { cells: [predator] }),
      TEST_OWN_PLAYER_ID,
      INPUTS,
      NO_SUBMIT,
    );
    expect(done.effectSprites).toBe(0);
    expect(packed(subject, 0, 'x')).toBe(0);
    subject.destroy();
  });
});
