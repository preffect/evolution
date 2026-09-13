import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  createTestPlayerProgressView,
  entityId,
  levelUpCost,
  type BacteriumVariant,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { WILD_CELL_THREAT_NAME } from './threats-for';
import {
  ownCellIndicatorsFor,
  type OwnCellIndicators,
  type OwnCellIndicatorsInput,
} from '../../state/own-cell-indicators';
import { STATUS_ANNOUNCE_DNA_STEP_PERCENT } from '../hud-constants';
import { SPRINT_STATUS, dnaPercentOf, formatOwnCellStatus, formatTraits, shouldAnnounce } from './own-cell-status';

const NOTHING_EATEN: Record<BacteriumVariant, number> = { plain: 0, aerobic: 0, photosynthetic: 0 };

function indicatorsWith(
  ownCell = createTestCellView(),
  ownProgress = createTestPlayerProgressView(),
  threats: OwnCellIndicatorsInput['threats'] = [],
): OwnCellIndicators {
  return ownCellIndicatorsFor({ ownCell, ownProgress, balance: DEFAULT_BALANCE, threats, previewTraitId: null });
}

describe('dnaPercentOf', () => {
  it('floors, so the mirror never claims a percent the ring has not filled', () => {
    expect(dnaPercentOf(0.629)).toBe(62);
    expect(dnaPercentOf(0)).toBe(0);
    expect(dnaPercentOf(1)).toBe(100);
  });
});

describe('formatTraits', () => {
  it('lists owned traits in catalog order, so two equal loadouts always read the same', () => {
    const forwards = formatTraits([
      { traitId: 'simple_flagellum', tier: 2 },
      { traitId: 'nucleoid', tier: 1 },
    ]);
    const backwards = formatTraits([
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'simple_flagellum', tier: 2 },
    ]);
    expect(forwards).toBe(backwards);
    expect(forwards).toBe('nucleoid:1 simple_flagellum:2');
  });

  it('is empty with nothing owned', () => {
    expect(formatTraits([])).toBe('');
  });
});

describe('formatOwnCellStatus attributes', () => {
  it('carries the level, DNA percent, mass and sprint word every snapshot', () => {
    const cost = levelUpCost(3, DEFAULT_BALANCE.progression);
    const status = formatOwnCellStatus(
      indicatorsWith(
        createTestCellView({ mass: 128.4 }),
        createTestPlayerProgressView({ level: 3, dnaTowardNextLevel: cost * 0.62 }),
      ),
    );
    expect(status.attributes['data-level']).toBe('3');
    expect(status.attributes['data-max-level']).toBe('false');
    expect(status.attributes['data-dna-percent']).toBe('62');
    expect(status.attributes['data-mass']).toBe('128');
    expect(status.attributes['data-sprint']).toBe(SPRINT_STATUS.ready);
  });

  it('names the ladder as a ghost, as counters, or as none', () => {
    expect(formatOwnCellStatus(indicatorsWith()).attributes['data-ladder']).toBe('ghost:nucleoid');
    const prokaryote = createTestCellView({ stage: CELL_STAGE.prokaryote });
    expect(formatOwnCellStatus(indicatorsWith(prokaryote)).attributes['data-ladder']).toBe('counters');
  });

  it('writes a counter attribute per visible counter and omits a hidden one', () => {
    const prokaryote = createTestCellView({
      stage: CELL_STAGE.prokaryote,
      traits: [{ traitId: 'chloroplast', tier: 1 }],
    });
    const progress = createTestPlayerProgressView({ bacteriaEatenByVariant: { ...NOTHING_EATEN, aerobic: 2 } });
    const status = formatOwnCellStatus(indicatorsWith(prokaryote, progress));
    expect(status.attributes['data-aerobic']).toBe(`2/${ENDOSYMBIOSIS_BACTERIA_REQUIRED}`);
    // The owned chloroplast has no counter left, so the attribute is absent rather than `0/10`.
    expect(status.attributes['data-photosynthetic']).toBeUndefined();
  });

  it('omits every engulf and threat attribute while nothing is happening', () => {
    const status = formatOwnCellStatus(indicatorsWith());
    expect(status.attributes['data-engulfed']).toBeNull();
    expect(status.attributes['data-engulf-phase']).toBeNull();
    expect(status.attributes['data-threat']).toBeNull();
  });

  it('reports the engulf progress as a percent with the phase that progress falls in', () => {
    // The bands are ECOLOGY §6.1's: cover to 1/6, wrap to the seal at 0.5, absorb from there.
    const statusAt = (progress: number): ReturnType<typeof formatOwnCellStatus> =>
      formatOwnCellStatus(
        indicatorsWith(
          createTestCellView({
            states: [CELL_STATE.beingEngulfed],
            engulfProgress: progress,
            engulfedByCellId: entityId('predator'),
          }),
        ),
      );
    expect(statusAt(0.1).attributes['data-engulf-phase']).toBe('cover');
    const wrapping = statusAt(0.35);
    expect(wrapping.attributes['data-engulfed']).toBe('35');
    expect(wrapping.attributes['data-engulf-phase']).toBe('wrap');
    expect(statusAt(DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS).attributes['data-engulf-phase']).toBe('absorb');
  });

  it('reports the nearest threat by cell id', () => {
    const status = formatOwnCellStatus(
      indicatorsWith(createTestCellView(), createTestPlayerProgressView(), [
        { cellId: entityId('hunter'), name: 'Amoeboid', distanceSquared: 1 },
      ]),
    );
    expect(status.attributes['data-threat']).toBe('hunter');
  });
});

describe('formatOwnCellStatus text', () => {
  it('reads as a sentence in the order §3.1.4 sets', () => {
    const prokaryote = createTestCellView({ stage: CELL_STAGE.prokaryote });
    expect(formatOwnCellStatus(indicatorsWith(prokaryote)).text).toBe(
      'Level 1 · DNA 0 % · Aerobic 0 of 10 · Photosynthetic 0 of 10 · Sprint ready',
    );
  });

  it('says what is happening while engulfed, and says Sealed once the hold is won', () => {
    const held = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: 0.1,
      engulfedByCellId: entityId('predator'),
    });
    expect(formatOwnCellStatus(indicatorsWith(held)).text).toContain('Engulfed · sprint to escape');

    const sealed = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: DEFAULT_BALANCE.absorption.ENGULF_SEAL_PROGRESS,
      engulfedByCellId: entityId('predator'),
    });
    expect(formatOwnCellStatus(indicatorsWith(sealed)).text).toContain('Sealed');
  });

  it('speaks the threat when one is near and nothing is holding us', () => {
    const status = formatOwnCellStatus(
      indicatorsWith(createTestCellView(), createTestPlayerProgressView(), [
        { cellId: entityId('hunter'), name: 'Amoeboid', distanceSquared: 1 },
      ]),
    );
    expect(status.text).toContain('Amoeboid can engulf you');
  });
});

describe('shouldAnnounce', () => {
  const cost = levelUpCost(1, DEFAULT_BALANCE.progression);

  function statusAtDna(fractionOfCost: number, mass = 20): ReturnType<typeof formatOwnCellStatus> {
    return formatOwnCellStatus(
      indicatorsWith(
        createTestCellView({ mass }),
        createTestPlayerProgressView({ level: 1, dnaTowardNextLevel: cost * fractionOfCost }),
      ),
    );
  }

  it('speaks the first status it is given', () => {
    expect(shouldAnnounce(null, statusAtDna(0))).toBe(true);
  });

  it('stays silent while only the mass drifts, which is every snapshot', () => {
    const first = statusAtDna(0.1, 20);
    const later = statusAtDna(0.1, 74);
    expect(later.attributes['data-mass']).not.toBe(first.attributes['data-mass']);
    expect(shouldAnnounce(first.announceKey, later)).toBe(false);
  });

  it('stays silent inside one DNA step and speaks when the step is crossed', () => {
    const justUnder = statusAtDna((STATUS_ANNOUNCE_DNA_STEP_PERCENT - 5) / 100);
    const sameStep = statusAtDna((STATUS_ANNOUNCE_DNA_STEP_PERCENT - 1) / 100);
    const nextStep = statusAtDna((STATUS_ANNOUNCE_DNA_STEP_PERCENT + 1) / 100);
    expect(shouldAnnounce(justUnder.announceKey, sameStep)).toBe(false);
    expect(shouldAnnounce(justUnder.announceKey, nextStep)).toBe(true);
  });

  it('speaks again when a different predator becomes the nearest, even with an identical label', () => {
    // The regression this pins (#282 review): the key recorded only that *a* threat existed, so a
    // swap left `data-threat` pointing at one cell while the spoken line still named another.
    //
    // Both predators are wild cells, so both labels read `Wild cell` and the two sentences are
    // byte-identical. That is what makes this the only case that can tell an identity key from a
    // label key, and so the only case that pins the choice — a label key handles Bot 1 → Bot 2
    // correctly, because the label changes with the text.
    //
    // To be accurate about what the choice buys, since an earlier version of this comment
    // overstated it: a label key is not *wrong* here. It would leave the sentence reading
    // `Wild cell can engulf you`, which is true of the new predator too. The identity key is a
    // strict refinement — it never misses an announce and may add a redundant one, harmless
    // because the rendered string is unchanged and so the DOM does not mutate. It is worth pinning
    // because the day the sentence carries anything predator-specific beyond the label, a label
    // key becomes wrong silently, and this test is what stops someone simplifying back to one.
    const near = (id: string): ReturnType<typeof formatOwnCellStatus> =>
      formatOwnCellStatus(
        indicatorsWith(createTestCellView(), createTestPlayerProgressView(), [
          { cellId: entityId(id), name: WILD_CELL_THREAT_NAME, distanceSquared: 1 },
        ]),
      );
    const first = near('wild-a');
    const second = near('wild-b');
    // The premise, asserted rather than assumed: the sentences are byte-identical, so nothing but
    // the id can tell these two apart and a label key cannot pass.
    expect(second.text).toBe(first.text);
    expect(first.text).toContain(`${WILD_CELL_THREAT_NAME} can engulf you`);
    expect(shouldAnnounce(first.announceKey, second)).toBe(true);
    // The same predator staying nearest must not re-speak.
    expect(shouldAnnounce(first.announceKey, near('wild-a'))).toBe(false);
  });

  it('speaks again when a named predator is replaced by another, the case with distinct labels', () => {
    const near = (id: string, name: string): ReturnType<typeof formatOwnCellStatus> =>
      formatOwnCellStatus(
        indicatorsWith(createTestCellView(), createTestPlayerProgressView(), [
          { cellId: entityId(id), name, distanceSquared: 1 },
        ]),
      );
    const first = near('hunter-a', 'Bot 1');
    const second = near('hunter-b', 'Bot 2');
    expect(first.text).toContain('Bot 1 can engulf you');
    expect(second.text).toContain('Bot 2 can engulf you');
    expect(shouldAnnounce(first.announceKey, second)).toBe(true);
  });

  it('speaks on a level change, a counter change, a threat and a phase change', () => {
    const base = statusAtDna(0);
    const levelled = formatOwnCellStatus(
      indicatorsWith(createTestCellView(), createTestPlayerProgressView({ level: 2 })),
    );
    expect(shouldAnnounce(base.announceKey, levelled)).toBe(true);

    const prokaryote = createTestCellView({ stage: CELL_STAGE.prokaryote });
    const oneEaten = formatOwnCellStatus(indicatorsWith(prokaryote));
    const twoEaten = formatOwnCellStatus(
      indicatorsWith(
        prokaryote,
        createTestPlayerProgressView({ bacteriaEatenByVariant: { ...NOTHING_EATEN, aerobic: 1 } }),
      ),
    );
    expect(shouldAnnounce(oneEaten.announceKey, twoEaten)).toBe(true);

    const threatened = formatOwnCellStatus(
      indicatorsWith(createTestCellView(), createTestPlayerProgressView(), [
        { cellId: entityId('hunter'), name: 'Amoeboid', distanceSquared: 1 },
      ]),
    );
    expect(shouldAnnounce(base.announceKey, threatened)).toBe(true);
  });
});
