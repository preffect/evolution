import { describe, expect, it } from 'vitest';
import { MOTION_CLIPS, entityId, type CellView } from '@evolution/shared';
import {
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestLevelUpEffect,
  createTestRespawnEffect,
} from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { hexToNumber } from '../colour';
import { EFFECT_FALLBACK_RADIUS_WU, LEVEL_UP_RAYS, LEVEL_UP_RIPPLES, LIGHT_ACCENT } from '../constants';
import { paletteFor } from '../palette';
import { EffectsLayer, type EffectsLayerFrame } from './effects-layer';

const textures = createTestRenderTextures({ seed: 2 });
const HIDDEN_RETICLE = { isVisible: false, x: 0, y: 0, zoom: 1, ownCell: null };
const lookup = (views: CellView[]) => (id: string) => views.find((view) => view.id === id);

function frame(views: CellView[], nowMs: number, overrides: Partial<EffectsLayerFrame> = {}): EffectsLayerFrame {
  return { viewOf: lookup(views), nowMs, reticle: HIDDEN_RETICLE, ...overrides };
}

describe('EffectsLayer', () => {
  it('starts an eat halo on its cell in the cell colour, follows the cell, and drops it at 300 ms', () => {
    const subject = new EffectsLayer(textures);
    const eater = createTestCellView({ id: entityId('e'), x: 0, y: 0, radius: 10, avatarIndex: 2 });
    expect(subject.start([createTestEatEffect({ cellId: eater.id })], lookup([eater]), 1000)).toBe(1);
    const peak = subject.update(frame([{ ...eater, x: 5 }], 1160));
    expect(peak).toEqual({ sprites: 1, running: 1 });
    expect(subject.sprites[0]).toMatchObject({ x: 5, y: 0, visible: true, tint: hexToNumber(paletteFor(2).rim) });
    expect(subject.sprites[0]!.width).toBeCloseTo(1.5 * 10 * 2, 6);
    expect(subject.update(frame([eater], 1300))).toEqual({ sprites: 0, running: 0 });
    expect(subject.sprites[0]!.visible).toBe(false);
    subject.destroy();
  });

  it('bursts a level-up into rays, a shock ring and ripples, and blooms a respawn on a cell never drawn', () => {
    const subject = new EffectsLayer(textures);
    const cell = createTestCellView({ id: entityId('c'), radius: 20 });
    subject.start(
      [createTestLevelUpEffect({ cellId: cell.id }), createTestRespawnEffect({ cellId: entityId('new'), x: 7, y: 8 })],
      lookup([cell]),
      0,
    );
    const burst = subject.update(frame([cell], 250));
    expect(burst).toEqual({ sprites: LEVEL_UP_RAYS + 1 + LEVEL_UP_RIPPLES + 1, running: 2 });
    const bloom = subject.sprites[burst.sprites - 1]!;
    expect(bloom).toMatchObject({ x: 7, y: 8, tint: hexToNumber(LIGHT_ACCENT) });
    expect(bloom.width).toBeLessThanOrEqual(2 * EFFECT_FALLBACK_RADIUS_WU * 2);
    expect(subject.update(frame([cell], MOTION_CLIPS.respawn.duration)).running).toBe(1);
    subject.destroy();
  });

  it('streams DNA from the prey last view toward the predator wherever it moves', () => {
    const subject = new EffectsLayer(textures);
    const prey = createTestCellView({ id: entityId('prey'), x: 0, y: 0, radius: 10 });
    const predator = createTestCellView({ id: entityId('pred'), x: 100, y: 0, radius: 40 });
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id, x: 0, y: 0 });
    subject.start([absorbed], lookup([prey, predator]), 0);
    expect(subject.update(frame([predator], 100)).sprites).toBe(0);
    const streams = subject.update(frame([{ ...predator, y: 100 }], 500));
    expect(streams.sprites).toBe(3);
    expect(subject.sprites[1]!.x).toBeGreaterThan(0);
    expect(subject.sprites[1]!.y).toBeGreaterThan(0);
    // The predator left the frame: the streams keep flowing to where it was.
    subject.update(frame([], 550));
    expect(subject.sprites[1]!.y).toBeGreaterThan(0);
    subject.destroy();
  });

  it('draws the reticle in the same batch and ignores effects without a cell', () => {
    const subject = new EffectsLayer(textures);
    expect(
      subject.start([{ kind: 'world_level_up', tick: 0, level: 2, stage: 'prokaryote' }], () => undefined, 0),
    ).toBe(0);
    const reticle = { isVisible: true, x: 40, y: 0, zoom: 1, ownCell: { x: 0, y: 0, radius: 10 } };
    const outputs = subject.update(frame([], 0, { reticle }));
    expect(outputs.sprites).toBeGreaterThan(1);
    expect(subject.sprites[0]).toMatchObject({ x: 40, y: 0, tint: hexToNumber(LIGHT_ACCENT) });
    subject.destroy();
  });
});
