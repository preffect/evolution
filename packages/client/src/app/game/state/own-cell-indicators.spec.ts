import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_PHASE,
  createTestPlayerProgressView,
  entityId,
  levelUpCost,
  type BacteriumVariant,
  type CellView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { RELATION_RING, type Relation } from '../hud/format/relations-for';
import type { Threat } from '../hud/format/threats-for';
import { dnaFractionFor, ownCellIndicatorsFor, type OwnCellIndicators } from './own-cell-indicators';

const NOTHING_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 0, photosynthetic: 0 };

function eaten(overrides: Partial<Record<BacteriumVariant, number>>): Record<BacteriumVariant, number> {
  return { ...NOTHING_EATEN, ...overrides };
}

function threat(id: string, name: string): Threat {
  return { cellId: entityId(id), name, distanceSquared: 1 };
}

describe('dnaFractionFor', () => {
  it('is the progress toward the next level’s cost', () => {
    const cost = levelUpCost(1, DEFAULT_BALANCE.progression);
    const progress = createTestPlayerProgressView({ level: 1, dnaTowardNextLevel: cost / 2 });
    expect(dnaFractionFor(progress, DEFAULT_BALANCE)).toBeCloseTo(0.5);
  });

  it('is full at MAX_LEVEL, where there is no next cost to be a fraction of', () => {
    const progress = createTestPlayerProgressView({
      level: DEFAULT_BALANCE.progression.MAX_LEVEL,
      dnaTowardNextLevel: 0,
    });
    expect(dnaFractionFor(progress, DEFAULT_BALANCE)).toBe(1);
  });

  it('clamps rather than overflowing when a payout lands more than one level of DNA', () => {
    const cost = levelUpCost(1, DEFAULT_BALANCE.progression);
    const progress = createTestPlayerProgressView({ level: 1, dnaTowardNextLevel: cost * 3 });
    expect(dnaFractionFor(progress, DEFAULT_BALANCE)).toBe(1);
  });
});

describe('ownCellIndicatorsFor', () => {
  const ownCell = createTestCellView({ stage: CELL_STAGE.prokaryote, mass: 128 });
  const ownProgress = createTestPlayerProgressView({ level: 4, bacteriaEatenByVariant: eaten({ aerobic: 2 }) });
  const indicatorsOf = (cell: CellView, threats: readonly Threat[] = []): OwnCellIndicators =>
    ownCellIndicatorsFor({ ownCell: cell, ownProgress, balance: DEFAULT_BALANCE, threats, previewTraitId: null });

  it('gathers the level, the mass, the ladder and the sprint into one record', () => {
    const indicators = indicatorsOf(ownCell);
    expect(indicators).toMatchObject({
      level: 4,
      isMaxLevel: false,
      mass: 128,
      sprintFill: 1,
      isSprinting: false,
      escape: null,
      nearestThreat: null,
    });
    expect(indicators.ladder.counters).toHaveLength(2);
  });

  it('reports the nearest threat by name, since the list arrives nearest first', () => {
    const indicators = indicatorsOf(ownCell, [threat('near', 'Amoeboid'), threat('far', 'Other')]);
    expect(indicators.nearestThreat).toEqual({ cellId: entityId('near'), label: 'Amoeboid can engulf you' });
  });

  it('carries the relations and the rings by cell id the cell layer packs, none when absent', () => {
    const edible: Relation = {
      cellId: entityId('prey'),
      ring: RELATION_RING.edible,
      isEdible: true,
      isToxic: false,
      distanceSquared: 1,
    };
    const indicators = ownCellIndicatorsFor({
      ownCell,
      ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      relations: [edible],
      previewTraitId: null,
    });
    expect(indicators.relations).toEqual([edible]);
    expect(indicators.relationRings.get(entityId('prey'))).toBe(RELATION_RING.edible);
    expect(indicatorsOf(ownCell).relationRings.size).toBe(0);
  });

  it('opens the escape window while being engulfed and drains it toward the seal', () => {
    const seal = DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS;
    const held = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: seal / 2,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = indicatorsOf(held);
    // Half way to the seal is inside `wrap`: cover ends at 1/6 (ecology/absorption.md §6.1), well before it.
    expect(indicators.escape).toMatchObject({ phase: ENGULF_PHASE.wrap, predatorCellId: entityId('predator') });
    expect(indicators.escape?.fill).toBeCloseTo(0.5);
  });

  it('is still in cover, with a nearly full window, at first contact', () => {
    const justCaught = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: 0.05,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = indicatorsOf(justCaught);
    expect(indicators.escape?.phase).toBe(ENGULF_PHASE.cover);
    expect(indicators.escape?.fill).toBeGreaterThan(0.85);
  });

  it('locks the window at zero from the seal on, where escape is no longer the player’s to win', () => {
    const sealed = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = indicatorsOf(sealed);
    expect(indicators.escape?.phase).toBe(ENGULF_PHASE.absorb);
    expect(indicators.escape?.fill).toBe(0);
  });

  it('hides the threat label while the escape arc is showing, so two dangers never share a radius', () => {
    const held = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: 0.1,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = indicatorsOf(held, [threat('near', 'Amoeboid')]);
    expect(indicators.escape).not.toBeNull();
    expect(indicators.nearestThreat).toBeNull();
  });

  it('leaves the escape unset when the state says engulfed but no predator is named', () => {
    const inconsistent = createTestCellView({ states: [CELL_STATE.beingEngulfed], engulfedByCellId: null });
    expect(indicatorsOf(inconsistent).escape).toBeNull();
  });

  it('reads sprinting from the sprint clock rather than from the cooldown', () => {
    const sprinting = createTestCellView({ sprintRemainingTicks: 10, sprintCooldownRemainingTicks: 100 });
    const indicators = indicatorsOf(sprinting);
    expect(indicators.isSprinting).toBe(true);
    expect(indicators.sprintFill).toBeLessThan(1);
  });
});
