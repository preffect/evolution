import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  MASS_RATE_CAUSE,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createTestCellView, createTestRenderFrame } from '../../../../testing/builders';
import { MASS_TREND } from '../../state/mass-trend';
import { RATE_TAG_ROWS_MAX, RENDER_BENCH_CUES } from '../constants';
import { NO_HUD_INPUTS } from '../game-renderer';
import { BENCH_CUE_STEP, benchCueFrame, benchCueStepAt } from './bench-cues';

const OWN_PLAYER = playerId('bench-player-0');
const OWN = createTestCellView({ id: entityId('own'), playerId: OWN_PLAYER, mass: 312 });
const EVERY = RENDER_BENCH_CUES.floaterEveryFrames;

function frame(overrides: Parameters<typeof createTestRenderFrame>[0] = {}) {
  return createTestRenderFrame({
    cells: [OWN],
    latest: createTestSnapshot({ ownProgress: createTestPlayerProgressView() }),
    ...overrides,
  });
}

describe('benchCueStepAt', () => {
  it('lands the eat, the engulf and the sprint in turn every floaterEveryFrames, nothing between', () => {
    expect([0, EVERY, 2 * EVERY, 3 * EVERY].map(benchCueStepAt)).toEqual([
      BENCH_CUE_STEP.eat,
      BENCH_CUE_STEP.engulf,
      BENCH_CUE_STEP.sprint,
      BENCH_CUE_STEP.eat,
    ]);
    expect(benchCueStepAt(1)).toBeNull();
  });
});

describe('benchCueFrame', () => {
  it('leaves the frame as it is and draws no record without an own cell or its progress', () => {
    const lonely = frame({ cells: [] });
    expect(benchCueFrame(lonely, OWN_PLAYER, 0)).toEqual({ frame: lonely, inputs: NO_HUD_INPUTS });
    const spectating = frame({ latest: createTestSnapshot({ ownProgress: null }) });
    expect(benchCueFrame(spectating, OWN_PLAYER, 0).inputs).toBe(NO_HUD_INPUTS);
  });

  it('draws the worst case: a shrinking chip, every tag row with the DECAY share, the zone pill', () => {
    const record = benchCueFrame(frame(), OWN_PLAYER, 1).inputs.ownCellIndicators!;
    expect(record.massChip.trend).toBe(MASS_TREND.down);
    expect(record.rateTags).toHaveLength(RATE_TAG_ROWS_MAX);
    const decay = record.rateTags.find((tag) => tag.cause === MASS_RATE_CAUSE.decay);
    expect(decay?.traitShare?.traitId).toBe('mitochondrion');
    expect(record.zone?.pillText).not.toBeNull();
    expect(record.sprintSpent).toBeNull();
  });

  it('adds the own eat on its frame, the engulf payout on the next, and hands the sprint over with its own tick', () => {
    const eat = benchCueFrame(frame(), OWN_PLAYER, 0).frame.effects;
    expect(eat.map((effect) => effect.kind)).toEqual([EFFECT_KIND.eat]);
    const engulf = benchCueFrame(frame(), OWN_PLAYER, EVERY).frame.effects;
    expect(engulf).toMatchObject([{ kind: EFFECT_KIND.cellAbsorbed, predatorCellId: OWN.id }]);
    const sprint = benchCueFrame(frame(), OWN_PLAYER, 2 * EVERY);
    expect(sprint.frame.effects).toEqual([]);
    expect(sprint.inputs.ownCellIndicators?.sprintSpent).toEqual({
      amount: RENDER_BENCH_CUES.sprintSpent,
      tick: 2 * EVERY,
    });
  });
});
