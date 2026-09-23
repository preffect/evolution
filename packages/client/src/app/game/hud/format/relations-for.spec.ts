import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, canEngulf, entityId, type CellView } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import type { CameraExtent } from '../../render/camera';
import { RELATIONS_MAX_RINGED } from '../../state/legibility-constants';
import { RELATION_RING, relationRingsOf, relationsFor } from './relations-for';

const ON_SCREEN: CameraExtent = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
const OWN_MASS = 100;
const OWN = createTestCellView({ id: entityId('own'), mass: OWN_MASS, radius: 10, x: 0, y: 0 });
const RATIO = DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO;
/** Just under the ratio: the own cell can engulf it. */
const PREY_MASS = (OWN_MASS / RATIO) * 0.9;
/** Just over the ratio: the own cell cannot. */
const TOO_BIG_MASS = (OWN_MASS / RATIO) * 1.1;
const TOXIN: CellView['traits'] = [{ traitId: 'toxin_vacuole', tier: 1 }];

function cellAt(id: string, x: number, overrides: Partial<CellView> = {}): CellView {
  return createTestCellView({ id: entityId(id), mass: PREY_MASS, radius: 4, x, y: 0, ...overrides });
}

function relationsOf(
  cells: readonly CellView[],
  ownCell: CellView = OWN,
  cameraExtent: CameraExtent | null = ON_SCREEN,
) {
  return relationsFor({ cells: [ownCell, ...cells], ownCell, cameraExtent, balance: DEFAULT_BALANCE });
}

describe('relationsFor', () => {
  it('rings a cell the shared canEngulf lets the own cell eat, and not one it cannot', () => {
    const prey = cellAt('prey', 50);
    const tooBig = cellAt('big', 60, { mass: TOO_BIG_MASS });
    expect(canEngulf(OWN, prey, DEFAULT_BALANCE.absorption)).toBe(true);
    expect(canEngulf(OWN, tooBig, DEFAULT_BALANCE.absorption)).toBe(false);

    const relations = relationsOf([prey, tooBig]);
    expect(relations).toEqual([expect.objectContaining({ cellId: prey.id, ring: RELATION_RING.edible })]);
  });

  it('follows the prey-side Cell Wall bonus: the same mass stops being edible behind a wall', () => {
    const walled = cellAt('walled', 50, { membraneRatioBonus: RATIO });
    expect(relationsOf([cellAt('bare', 50)])).toHaveLength(1);
    expect(relationsOf([walled])).toEqual([]);
  });

  it('gives a toxic cell the double-line ring whether it is edible or not', () => {
    const toxicPrey = cellAt('toxic-prey', 40, { traits: TOXIN });
    const toxicBig = cellAt('toxic-big', 80, { mass: TOO_BIG_MASS, traits: TOXIN });
    const relations = relationsOf([toxicPrey, toxicBig]);
    expect(relations.map((relation) => [relation.cellId, relation.ring, relation.isEdible])).toEqual([
      [toxicPrey.id, RELATION_RING.toxic, true],
      [toxicBig.id, RELATION_RING.toxic, false],
    ]);
  });

  it('leaves a threat to its warning ring, toxic or not', () => {
    const toxicPredator = cellAt('predator', 50, { mass: OWN_MASS * RATIO * 2, traits: TOXIN });
    expect(canEngulf(toxicPredator, OWN, DEFAULT_BALANCE.absorption)).toBe(true);
    expect(relationsOf([toxicPredator])).toEqual([]);
  });

  it('rings no prey held by another cell, and none while the own cell is already engulfing', () => {
    const held = cellAt('held', 50, { engulfedByCellId: entityId('other') });
    expect(relationsOf([held])).toEqual([]);
    const engulfing = { ...OWN, engulfingCellId: entityId('meal') };
    expect(relationsOf([cellAt('prey', 50)], engulfing)).toEqual([]);
  });

  it('rings only on-screen cells, never the own cell, and nothing before the camera exists', () => {
    expect(relationsOf([cellAt('far', 5000)])).toEqual([]);
    expect(relationsOf([cellAt('prey', 50)], OWN, null)).toEqual([]);
    const toxicOwn = { ...OWN, traits: TOXIN };
    expect(relationsOf([], toxicOwn)).toEqual([]);
  });

  it('keeps the nearest RELATIONS_MAX_RINGED, nearest first, ties on id', () => {
    const many = Array.from({ length: RELATIONS_MAX_RINGED + 4 }, (_unused, index) =>
      cellAt(`c${index}`, 900 - index * 10),
    );
    const relations = relationsOf([cellAt('tie-b', 20), cellAt('tie-a', -20), ...many]);
    expect(relations).toHaveLength(RELATIONS_MAX_RINGED);
    expect(relations.slice(0, 2).map((relation) => relation.cellId)).toEqual([entityId('tie-a'), entityId('tie-b')]);
    expect(relations.map((relation) => relation.cellId)).not.toContain(entityId('c0'));
  });

  it('maps the rings by cell id for the cell layer', () => {
    const rings = relationRingsOf(relationsOf([cellAt('prey', 50), cellAt('toxic', 60, { traits: TOXIN })]));
    expect(rings.get(entityId('prey'))).toBe(RELATION_RING.edible);
    expect(rings.get(entityId('toxic'))).toBe(RELATION_RING.toxic);
  });
});
