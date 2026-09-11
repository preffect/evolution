import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, MOTION_CLIP, createSeededRandom, entityId, type CellView } from '@evolution/shared';
import {
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestLevelUpEffect,
  createTestRespawnEffect,
} from '../../../../testing/builders';
import { buildNoiseStrip } from '../noise/noise-strip';
import { ViewRegistry } from '../view-registry';
import { applyCellEffects } from './cell-effects';
import { CellRenderState } from './cell-render-state';
import { GhostRegistry } from './ghost-cells';

function registryWith(views: CellView[]): ViewRegistry<CellView, CellRenderState> {
  const random = createSeededRandom(1);
  const registry = new ViewRegistry<CellView, CellRenderState>({
    create: (view) => new CellRenderState(view.id, random),
    destroy: () => undefined,
  });
  const sync = registry.sync(views);
  sync.pairs.forEach(([view, state]) => {
    state.update(view, {
      timeSeconds: 0,
      nowMs: 0,
      zoom: 1,
      balance: DEFAULT_BALANCE,
      ownCell: null,
      strip: buildNoiseStrip(createSeededRandom(1)),
      previewTraitId: null,
      contactDent: null,
      absorbedSealByPredator: new Map(),
      preyProgressByPredator: new Map(),
    });
  });
  return registry;
}

describe('applyCellEffects', () => {
  it('starts the eat clip aimed at the mote, the level-up and the respawn clips on their cells', () => {
    const eater = createTestCellView({ id: entityId('e'), x: 0, y: 0, radius: 20 });
    const registry = registryWith([eater]);
    const ghosts = new GhostRegistry();
    applyCellEffects(
      [
        createTestEatEffect({ cellId: eater.id, x: 0, y: 20 }),
        createTestLevelUpEffect({ cellId: eater.id }),
        createTestRespawnEffect({ cellId: eater.id }),
      ],
      registry,
      ghosts,
      500,
    );
    const state = registry.get('e')!;
    expect(state.angles.moteAngle).toBeCloseTo(Math.PI / 2, 9);
    expect(state.clips.isPlaying(MOTION_CLIP.eat, 500)).toBe(true);
    expect(state.clips.isPlaying(MOTION_CLIP.levelUp, 500)).toBe(true);
    expect(state.clips.isPlaying(MOTION_CLIP.respawn, 500)).toBe(true);
  });

  it('ghosts an absorbed cell from its last view and ignores effects for unknown cells', () => {
    const prey = createTestCellView({ id: entityId('prey'), radius: 12 });
    const registry = registryWith([prey]);
    const ghosts = new GhostRegistry();
    applyCellEffects(
      [createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: entityId('p') })],
      registry,
      ghosts,
      100,
    );
    expect(ghosts.size).toBe(1);
    expect(ghosts.active(100)[0]!.view.radius).toBe(12);
    applyCellEffects(
      [
        createTestEatEffect({ cellId: entityId('nobody') }),
        { kind: 'world_level_up', tick: 0, level: 2, stage: 'prokaryote' },
      ],
      registry,
      ghosts,
      100,
    );
    expect(ghosts.size).toBe(1);
  });
});
