import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  ENGULF_PHASE,
  createTestPlayerProgressView,
  entityId,
  levelUpCost,
  type BacteriumVariant,
  type CellStage,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { LADDER_ORBIT_ANGLES_PAIR_DEG, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../render/constants';
import type { Threat } from '../hud/format/threats-for';
import { LADDER_KIND, LADDER_SILHOUETTE, dnaFractionFor, ladderFor, ownCellIndicatorsFor } from './own-cell-indicators';

const NO_TRAITS = [] as const;
const NOTHING_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 0, photosynthetic: 0 };

function eaten(overrides: Partial<Record<BacteriumVariant, number>>): Record<BacteriumVariant, number> {
  return { ...NOTHING_EATEN, ...overrides };
}

function threat(id: string, name: string): Threat {
  return { cellId: entityId(id), name, distanceSquared: 1 };
}

describe('ladderFor', () => {
  it('shows the nucleoid ghost at the protocell, which is the first rung', () => {
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, NOTHING_EATEN, null)).toEqual({
      kind: LADDER_KIND.ghost,
      silhouette: LADDER_SILHOUETTE.nucleoid,
      angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG,
    });
  });

  it('shows the envelope then the form ghost as the stages climb, and nothing at the top', () => {
    const silhouetteAt = (stage: CellStage): unknown => {
      const ladder = ladderFor(stage, NO_TRAITS, NOTHING_EATEN, null);
      return ladder.kind === LADDER_KIND.ghost ? ladder.silhouette : ladder.kind;
    };
    expect(silhouetteAt(CELL_STAGE.endosymbiosis)).toBe(LADDER_SILHOUETTE.envelope);
    // Five forms gate `specialised`, so the ghost is keyed by the stage and never by one trait.
    expect(silhouetteAt(CELL_STAGE.eukaryote)).toBe(LADDER_SILHOUETTE.form);
    expect(silhouetteAt(CELL_STAGE.specialised)).toBe(LADDER_KIND.none);
  });

  it('shows both endosymbiosis counters at the prokaryote, on the angles §9 sets', () => {
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, eaten({ aerobic: 3 }), null);
    expect(ladder.kind).toBe(LADDER_KIND.counters);
    if (ladder.kind !== LADDER_KIND.counters) return;
    expect(ladder.counters.map((counter) => [counter.traitId, counter.variant, counter.angleDeg])).toEqual([
      ['mitochondrion', BACTERIUM_VARIANT.aerobic, LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic],
      ['chloroplast', BACTERIUM_VARIANT.photosynthetic, LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic],
    ]);
  });

  it('tallies each counter from its own variant, which is what makes the vent trip visible', () => {
    // gameplay-qa's finding on this ticket: without a counter, "eat ten aerobic bacteria" is a
    // hidden requirement. The tally and the unlock flag are the whole of that signal.
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, eaten({ aerobic: 4, photosynthetic: 1 }), null);
    if (ladder.kind !== LADDER_KIND.counters) throw new Error('expected counters');
    const [aerobic, photosynthetic] = ladder.counters;
    expect(aerobic).toMatchObject({ eaten: 4, required: ENDOSYMBIOSIS_BACTERIA_REQUIRED, isUnlocked: false });
    expect(photosynthetic).toMatchObject({ eaten: 1, isUnlocked: false });
  });

  it('tops the tally out at the requirement, because the orbit has no eleventh pip', () => {
    // The regression this pins (#282 review): a counter stays up until the trait is *picked*, so
    // the raw tally kept climbing while the player was still at the vent — `12/10` in the mirror,
    // a number §3.1.2's two rows of five cannot draw, and a fresh announce on every bacterium.
    const ladder = ladderFor(
      CELL_STAGE.prokaryote,
      NO_TRAITS,
      eaten({ aerobic: ENDOSYMBIOSIS_BACTERIA_REQUIRED + 2 }),
      null,
    );
    if (ladder.kind !== LADDER_KIND.counters) throw new Error('expected counters');
    expect(ladder.counters[0]).toMatchObject({ eaten: ENDOSYMBIOSIS_BACTERIA_REQUIRED, isUnlocked: true });
  });

  it('marks a counter unlocked at the requirement, so the player is told to go and pick it', () => {
    const ladder = ladderFor(
      CELL_STAGE.prokaryote,
      NO_TRAITS,
      eaten({ aerobic: ENDOSYMBIOSIS_BACTERIA_REQUIRED }),
      null,
    );
    if (ladder.kind !== LADDER_KIND.counters) throw new Error('expected counters');
    expect(ladder.counters[0]?.isUnlocked).toBe(true);
    expect(ladder.counters[1]?.isUnlocked).toBe(false);
  });

  it('drops an owned endosymbiont’s counter and leaves the other on its own angle', () => {
    const ladder = ladderFor(
      CELL_STAGE.prokaryote,
      [{ traitId: 'mitochondrion', tier: 1 }],
      eaten({ photosynthetic: 2 }),
      null,
    );
    if (ladder.kind !== LADDER_KIND.counters) throw new Error('expected counters');
    expect(ladder.counters).toHaveLength(1);
    expect(ladder.counters[0]).toMatchObject({
      traitId: 'chloroplast',
      angleDeg: LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic,
    });
  });

  it('shows nothing once both endosymbionts are owned, rather than an empty orbit', () => {
    const ladder = ladderFor(
      CELL_STAGE.prokaryote,
      [
        { traitId: 'mitochondrion', tier: 1 },
        { traitId: 'chloroplast', tier: 1 },
      ],
      NOTHING_EATEN,
      null,
    );
    expect(ladder.kind).toBe(LADDER_KIND.none);
  });

  it('hides the ghost while the picker previews that rung, so the card shows the real organelle', () => {
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, NOTHING_EATEN, 'nucleoid').kind).toBe(LADDER_KIND.none);
    // A preview of something else leaves the ghost alone.
    expect(ladderFor(CELL_STAGE.protocell, NO_TRAITS, NOTHING_EATEN, 'simple_flagellum').kind).toBe(LADDER_KIND.ghost);
  });

  it('hides only the previewed counter’s ghost and keeps its pips', () => {
    const ladder = ladderFor(CELL_STAGE.prokaryote, NO_TRAITS, eaten({ aerobic: 6 }), 'mitochondrion');
    if (ladder.kind !== LADDER_KIND.counters) throw new Error('expected counters');
    expect(ladder.counters[0]).toMatchObject({ isGhostHidden: true, eaten: 6 });
    expect(ladder.counters[1]?.isGhostHidden).toBe(false);
  });
});

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

  it('gathers the level, the mass, the ladder and the sprint into one record', () => {
    const indicators = ownCellIndicatorsFor({
      ownCell: ownCell,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    expect(indicators).toMatchObject({
      level: 4,
      isMaxLevel: false,
      mass: 128,
      sprintFill: 1,
      isSprinting: false,
      escape: null,
      nearestThreat: null,
    });
    expect(indicators.ladder.kind).toBe(LADDER_KIND.counters);
  });

  it('reports the nearest threat by name, since the list arrives nearest first', () => {
    const indicators = ownCellIndicatorsFor({
      ownCell: ownCell,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [threat('near', 'Amoeboid'), threat('far', 'Other')],
      previewTraitId: null,
    });
    expect(indicators.nearestThreat).toEqual({ cellId: entityId('near'), label: 'Amoeboid can engulf you' });
  });

  it('opens the escape window while being engulfed and drains it toward the seal', () => {
    const seal = DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS;
    const held = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: seal / 2,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = ownCellIndicatorsFor({
      ownCell: held,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    // Half way to the seal is inside `wrap`: cover ends at 1/6 (ECOLOGY §6.1), well before it.
    expect(indicators.escape).toMatchObject({ phase: ENGULF_PHASE.wrap, predatorCellId: entityId('predator') });
    expect(indicators.escape?.fill).toBeCloseTo(0.5);
  });

  it('is still in cover, with a nearly full window, at first contact', () => {
    const justCaught = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: 0.05,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = ownCellIndicatorsFor({
      ownCell: justCaught,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    expect(indicators.escape?.phase).toBe(ENGULF_PHASE.cover);
    expect(indicators.escape?.fill).toBeGreaterThan(0.85);
  });

  it('locks the window at zero from the seal on, where escape is no longer the player’s to win', () => {
    const sealed = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = ownCellIndicatorsFor({
      ownCell: sealed,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    expect(indicators.escape?.phase).toBe(ENGULF_PHASE.absorb);
    expect(indicators.escape?.fill).toBe(0);
  });

  it('hides the threat label while the escape arc is showing, so two dangers never share a radius', () => {
    const held = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: 0.1,
      engulfedByCellId: entityId('predator'),
    });
    const indicators = ownCellIndicatorsFor({
      ownCell: held,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [threat('near', 'Amoeboid')],
      previewTraitId: null,
    });
    expect(indicators.escape).not.toBeNull();
    expect(indicators.nearestThreat).toBeNull();
  });

  it('leaves the escape unset when the state says engulfed but no predator is named', () => {
    const inconsistent = createTestCellView({ states: [CELL_STATE.beingEngulfed], engulfedByCellId: null });
    expect(
      ownCellIndicatorsFor({
        ownCell: inconsistent,
        ownProgress: ownProgress,
        balance: DEFAULT_BALANCE,
        threats: [],
        previewTraitId: null,
      }).escape,
    ).toBeNull();
  });

  it('reads sprinting from the sprint clock rather than from the cooldown', () => {
    const sprinting = createTestCellView({ sprintRemainingTicks: 10, sprintCooldownRemainingTicks: 100 });
    const indicators = ownCellIndicatorsFor({
      ownCell: sprinting,
      ownProgress: ownProgress,
      balance: DEFAULT_BALANCE,
      threats: [],
      previewTraitId: null,
    });
    expect(indicators.isSprinting).toBe(true);
    expect(indicators.sprintFill).toBeLessThan(1);
  });
});
