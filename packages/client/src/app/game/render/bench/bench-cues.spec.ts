import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  MASS_RATE_CAUSE,
  MILLISECONDS_PER_SECOND,
  createTestPlayerProgressView,
  createTestSnapshot,
  entityId,
  playerId,
} from '@evolution/shared';
import { createTestCellView, createTestRenderFrame } from '../../../../testing/builders';
import { MASS_TREND } from '../../state/mass-trend';
import {
  FLOATER_LIFETIME_MS,
  FLOATER_MAX_VISIBLE,
  RATE_TAG_ROWS_MAX,
  RENDER_BENCH_CUES,
  RENDER_BENCH_FRAMES_PER_SECOND,
} from '../constants';
import { FLOATER_CAUSE, FloaterStack, floaterSpawnsOf } from '../effects/floater-stack';
import { NO_HUD_INPUTS } from '../game-renderer';
import { BENCH_CUE_STEP, benchCueFrame, benchCueStepAt } from './bench-cues';

const OWN_PLAYER = playerId('bench-player-0');
const OWN = createTestCellView({ id: entityId('own'), playerId: OWN_PLAYER, mass: 312 });
const CYCLE = RENDER_BENCH_CUES.floaterCycleFrames;
const MS_PER_FRAME = MILLISECONDS_PER_SECOND / RENDER_BENCH_FRAMES_PER_SECOND;
const FLOATER_LEFT_PX = 40;

/** The frame's own-cell floaters, spawned the way `CueLayer` spawns them: the eat and engulf effects, then the sprint. */
function spawnBenchFloaters(stack: FloaterStack, frameIndex: number): void {
  const { frame: benched, inputs } = benchCueFrame(frame(), OWN_PLAYER, frameIndex);
  const nowMs = frameIndex * MS_PER_FRAME;
  for (const spawn of floaterSpawnsOf(benched.effects, OWN.id)) stack.spawn(spawn, nowMs, FLOATER_LEFT_PX);
  const sprint = inputs.ownCellIndicators?.sprintSpent ?? null;
  if (sprint !== null) stack.spawn({ cause: FLOATER_CAUSE.sprint, amount: -sprint.amount }, nowMs, FLOATER_LEFT_PX);
}

function frame(overrides: Parameters<typeof createTestRenderFrame>[0] = {}) {
  return createTestRenderFrame({
    cells: [OWN],
    latest: createTestSnapshot({ ownProgress: createTestPlayerProgressView() }),
    ...overrides,
  });
}

describe('benchCueStepAt', () => {
  it('lands the eat, the engulf and the sprint on the first frames of each cycle, nothing through the rest of it', () => {
    expect([0, 1, 2].map(benchCueStepAt)).toEqual([BENCH_CUE_STEP.eat, BENCH_CUE_STEP.engulf, BENCH_CUE_STEP.sprint]);
    // The four floaters the three steps put up are alive for the rest of the cycle, so nothing lands inside it.
    expect([3, CYCLE - 1].map(benchCueStepAt)).toEqual([null, null]);
    expect([CYCLE, CYCLE + 2].map(benchCueStepAt)).toEqual([BENCH_CUE_STEP.eat, BENCH_CUE_STEP.sprint]);
  });
});

describe('the cue cycle', () => {
  it(`holds ${FLOATER_MAX_VISIBLE} floaters, one per cause, from its last step to its end — and again next cycle`, () => {
    const stack = new FloaterStack();
    const causesByFrame = new Map<number, string[]>();
    for (let frameIndex = 0; frameIndex < 2 * CYCLE; frameIndex += 1) {
      spawnBenchFloaters(stack, frameIndex);
      causesByFrame.set(
        frameIndex,
        stack.placements(frameIndex * MS_PER_FRAME).map((floater) => floater.cause),
      );
    }
    const causes = Object.values(FLOATER_CAUSE);
    // The eat spawns FOOD and DNA together, so the three steps fill all four rows by the last of them.
    const lastStepFrame = Object.values(BENCH_CUE_STEP).length - 1;
    for (const frameIndex of [lastStepFrame, CYCLE - 1, CYCLE + lastStepFrame, 2 * CYCLE - 1]) {
      // Sorted: the assertion is about which causes are up, not the row order the push rule gives them.
      expect([...(causesByFrame.get(frameIndex) ?? [])].sort(), `frame ${frameIndex}`).toEqual([...causes].sort());
    }
  });

  it('is a whole floater lifetime long, so a cycle never merges into the one before it', () => {
    expect(CYCLE * MS_PER_FRAME).toBeGreaterThanOrEqual(FLOATER_LIFETIME_MS);
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
    const engulf = benchCueFrame(frame(), OWN_PLAYER, 1).frame.effects;
    expect(engulf).toMatchObject([{ kind: EFFECT_KIND.cellAbsorbed, predatorCellId: OWN.id }]);
    const sprint = benchCueFrame(frame(), OWN_PLAYER, 2);
    expect(sprint.frame.effects).toEqual([]);
    expect(sprint.inputs.ownCellIndicators?.sprintSpent).toEqual({ amount: RENDER_BENCH_CUES.sprintSpent, tick: 2 });
  });
});
