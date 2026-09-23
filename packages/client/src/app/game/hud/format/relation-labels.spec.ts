import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestCellView, createTestEatEffect } from '../../../../testing/builders';
import { RELATION_LABEL_RIM, hasEngulfedIn, relationLabelsFor } from './relation-labels';
import { RELATION_RING, type Relation } from './relations-for';

const OWN = createTestCellView({ id: entityId('own') });

function relation(id: string, overrides: Partial<Relation> = {}): Relation {
  const isToxic = overrides.isToxic ?? false;
  return {
    cellId: entityId(id),
    ring: isToxic ? RELATION_RING.toxic : RELATION_RING.edible,
    isEdible: true,
    isToxic,
    isSpiny: false,
    distanceSquared: 1,
    ...overrides,
  };
}

function labelsOf(relations: readonly Relation[], hasEngulfed = false, ownCell = OWN) {
  return relationLabelsFor({ relations, ownCell, hasEngulfed });
}

describe('relationLabelsFor', () => {
  it('labels the nearest edible cell EDIBLE in gain, and a cell that is not edible gets no edible label', () => {
    const labels = labelsOf([relation('near'), relation('far')]);
    expect(labels.edible).toEqual({ cellId: entityId('near'), text: 'Edible', rim: RELATION_LABEL_RIM.gain });
    expect(labelsOf([relation('big', { isEdible: false, isToxic: true })]).edible).toBeNull();
  });

  it('labels the nearest toxic cell TOXIC in danger, or EDIBLE · TOXIC when the own cell could eat it', () => {
    const toxicOnly = relation('toxic', { isEdible: false, isToxic: true });
    expect(labelsOf([toxicOnly]).toxic).toEqual({ cellId: toxicOnly.cellId, text: 'Toxic', rim: 'danger' });
    expect(labelsOf([relation('both', { isToxic: true })]).toxic?.text).toBe('Edible · Toxic');
  });

  it('keeps one label per kind: an edible toxic cell takes the toxic label, the edible one goes to a non-toxic cell', () => {
    const labels = labelsOf([
      relation('both', { isToxic: true }),
      relation('toxic-2', { isToxic: true }),
      relation('prey'),
    ]);
    expect(labels.toxic?.cellId).toBe(entityId('both'));
    expect(labels.edible?.cellId).toBe(entityId('prey'));
  });

  it('says SPINY on an edible spiny cell, and not on a spiny cell the own cell cannot eat', () => {
    expect(labelsOf([relation('spiny', { isSpiny: true })]).edible?.text).toBe('Edible · Spiny');
    expect(labelsOf([relation('all', { isSpiny: true, isToxic: true })]).toxic?.text).toBe('Edible · Spiny · Toxic');
    expect(labelsOf([relation('shell', { isSpiny: true, isToxic: true, isEdible: false })]).toxic?.text).toBe('Toxic');
  });

  it('after the first engulf drops the plain EDIBLE but keeps SPINY, on the nearest spiny prey', () => {
    const labels = labelsOf([relation('plain'), relation('spiny', { isSpiny: true })], true);
    expect(labels.edible).toEqual({ cellId: entityId('spiny'), text: 'Edible · Spiny', rim: 'gain' });
    expect(labelsOf([relation('plain')], true).edible).toBeNull();
    expect(labelsOf([relation('toxic', { isToxic: true })], true).toxic?.text).toBe('Edible · Toxic');
  });

  it('puts no label on the prey the own cell is already engulfing', () => {
    const engulfing = { ...OWN, engulfingCellId: entityId('meal') };
    const labels = labelsOf([relation('meal', { isEdible: false, isToxic: true })], false, engulfing);
    expect(labels.toxic).toBeNull();
  });
});

describe('hasEngulfedIn', () => {
  it('is true for a cell_absorbed naming the own cell as predator, and false for another predator or an eat', () => {
    const own = entityId('own');
    expect(hasEngulfedIn([createTestCellAbsorbedEffect({ predatorCellId: own })], own)).toBe(true);
    expect(hasEngulfedIn([createTestCellAbsorbedEffect({ predatorCellId: entityId('rival') })], own)).toBe(false);
    expect(hasEngulfedIn([createTestEatEffect({ cellId: own })], own)).toBe(false);
  });
});
