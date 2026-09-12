import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, entityId, type CellView } from '@evolution/shared';
import {
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestEatEffect,
  createTestLevelUpEffect,
  createTestRespawnEffect,
} from '../../../../testing/builders';
import { cellClipStarts, startAbsorbedGhosts } from './cell-effects';
import { GhostRegistry } from './ghost-cells';

const lookup = (views: CellView[]) => (id: string) => views.find((view) => view.id === id);

describe('cellClipStarts', () => {
  it('names the eat clip aimed at the mote, the level-up and the respawn clips on their cells', () => {
    const eater = createTestCellView({ id: entityId('e'), x: 0, y: 0 });
    const starts = cellClipStarts(
      [
        createTestEatEffect({ cellId: eater.id, x: 0, y: 20 }),
        createTestLevelUpEffect({ cellId: eater.id }),
        createTestRespawnEffect({ cellId: entityId('new') }),
        { kind: 'world_level_up', tick: 0, level: 2, stage: 'prokaryote' },
      ],
      lookup([eater]),
    );
    expect(starts).toEqual([
      { cellId: 'e', clipId: MOTION_CLIP.eat, angle: Math.PI / 2 },
      { cellId: 'e', clipId: MOTION_CLIP.levelUp, angle: null },
      { cellId: 'new', clipId: MOTION_CLIP.respawn, angle: null },
    ]);
  });

  it('leaves an eat unaimed when the cell was never drawn', () => {
    expect(cellClipStarts([createTestEatEffect({ cellId: entityId('nobody') })], () => undefined)).toEqual([
      { cellId: 'nobody', clipId: MOTION_CLIP.eat, angle: null },
    ]);
  });
});

describe('startAbsorbedGhosts', () => {
  it('ghosts an absorbed cell from its last view toward its predator and ignores unknown prey', () => {
    const prey = createTestCellView({ id: entityId('prey'), x: 10, y: 0, radius: 12 });
    const predator = createTestCellView({ id: entityId('p'), x: 0, y: 0, radius: 40 });
    const ghosts = new GhostRegistry();
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id });
    expect(startAbsorbedGhosts([absorbed], lookup([prey, predator]), ghosts, 100)).toBe(1);
    const ghost = ghosts.active(100)[0]!;
    expect(ghost.view.radius).toBe(12);
    expect(ghost.angleFromPredator).toBe(0);
    const unknown = createTestCellAbsorbedEffect({ cellId: entityId('nobody'), predatorCellId: predator.id });
    expect(startAbsorbedGhosts([unknown, createTestEatEffect()], lookup([predator]), ghosts, 100)).toBe(0);
    expect(ghosts.size).toBe(1);
  });

  it('places the predator at the effect when its view is unknown', () => {
    const prey = createTestCellView({ id: entityId('prey'), x: 0, y: 5 });
    const ghosts = new GhostRegistry();
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: entityId('gone'), x: 0, y: 0 });
    startAbsorbedGhosts([absorbed], lookup([prey]), ghosts, 0);
    expect(ghosts.active(0)[0]!.angleFromPredator).toBeCloseTo(Math.PI / 2, 9);
  });
});
