// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  TICK_HZ,
  createTestPlayerProgressView,
  type OwnProgressView,
  type OwnedTrait,
} from '@evolution/shared';
import { TOAST_DURATION_SECONDS } from '../hud-constants';
import {
  INITIAL_TOAST_MEMORY,
  STAGE_TOAST_TEXT,
  TOAST_KIND,
  endosymbiontUnlockedToastText,
  lateJoinToastText,
  toastStepFor,
  type ToastMemory,
  type ToastSample,
} from './toasts';

const SEAT = 'game-1/player-me';
const OTHER_SEAT = 'game-2/player-me';
const START_TICK = 600;
const TOAST_DURATION_TICKS = TOAST_DURATION_SECONDS * TICK_HZ;
const LATE_JOIN_LEVEL = 2;
const LATE_JOIN_DNA = 60;

function progress(overrides: Partial<OwnProgressView> = {}): OwnProgressView {
  return createTestPlayerProgressView({ stage: CELL_STAGE.prokaryote, ...overrides });
}

function sample(tick: number, overrides: Partial<ToastSample> = {}): ToastSample {
  return { seatKey: SEAT, tick, ownProgress: progress(), ...overrides };
}

/** A seat already seen once, with nothing up: every later trigger is a change against it. */
function seenOnce(overrides: Partial<ToastSample> = {}): ToastMemory {
  return toastStepFor(INITIAL_TOAST_MEMORY, sample(START_TICK, overrides));
}

function aerobicEaten(count: number): OwnProgressView['bacteriaEatenByVariant'] {
  return { ...progress().bacteriaEatenByVariant, [BACTERIUM_VARIANT.aerobic]: count };
}

describe('toastStepFor: the first snapshot of a seat (docs/ui/overlays.md §3.6)', () => {
  it('fires late_join with the level and the catch-up DNA when the entry rule gave a gift', () => {
    const memory = seenOnce({
      ownProgress: progress({ level: LATE_JOIN_LEVEL, dnaCatchUpGift: LATE_JOIN_DNA }),
    });
    expect(memory.toast).toEqual({
      kind: TOAST_KIND.lateJoin,
      text: lateJoinToastText(LATE_JOIN_LEVEL, LATE_JOIN_DNA),
      shownAtTick: START_TICK,
    });
    expect(memory.toast?.text).toBe('Joined late · level 2 · 60 DNA catch-up · pick your traits');
  });

  it('fires nothing for a player who joined at the start, or for a stage already reached', () => {
    const memory = seenOnce({ ownProgress: progress({ stage: CELL_STAGE.eukaryote }) });
    expect(memory.toast).toBeNull();
  });

  it('does not replay late_join on a later snapshot of the same seat, as a reconnect inside the grace is', () => {
    const joined = seenOnce({ ownProgress: progress({ dnaCatchUpGift: LATE_JOIN_DNA }) });
    const later = START_TICK + TOAST_DURATION_TICKS;
    expect(
      toastStepFor(joined, sample(later, { ownProgress: progress({ dnaCatchUpGift: LATE_JOIN_DNA }) })).toast,
    ).toBeNull();
  });

  it('starts over in another room: its first snapshot only remembers', () => {
    const memory = seenOnce();
    const next = toastStepFor(
      memory,
      sample(START_TICK + 1, { seatKey: OTHER_SEAT, ownProgress: progress({ stage: CELL_STAGE.eukaryote }) }),
    );
    expect(next.toast).toBeNull();
    expect(next.seatKey).toBe(OTHER_SEAT);
  });

  it('remembers nothing before the room names us', () => {
    const memory = toastStepFor(INITIAL_TOAST_MEMORY, sample(START_TICK, { ownProgress: null }));
    expect(memory).toEqual(INITIAL_TOAST_MEMORY);
  });
});

describe('toastStepFor: the changes', () => {
  it('fires no stage toast when a rematch puts the cell back to a protocell', () => {
    const eukaryote = seenOnce({ ownProgress: progress({ stage: CELL_STAGE.eukaryote }) });
    const rematch = sample(START_TICK + 1, { ownProgress: progress({ stage: CELL_STAGE.protocell }) });
    expect(toastStepFor(eukaryote, rematch).toast).toBeNull();
  });

  it('fires stage when the own stage climbs, in its rung’s words', () => {
    const memory = toastStepFor(
      seenOnce(),
      sample(START_TICK + 1, { ownProgress: progress({ stage: CELL_STAGE.eukaryote }) }),
    );
    expect(memory.toast?.kind).toBe(TOAST_KIND.stage);
    expect(memory.toast?.text).toBe(STAGE_TOAST_TEXT.eukaryote);
    expect(STAGE_TOAST_TEXT.eukaryote).toBe('You are a eukaryote');
  });

  it('fires endosymbiont_unlocked the snapshot a tally reaches its count, naming the organelle', () => {
    const before = seenOnce({
      ownProgress: progress({ bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED - 1) }),
    });
    const memory = toastStepFor(
      before,
      sample(START_TICK + 1, {
        ownProgress: progress({ bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED) }),
      }),
    );
    expect(memory.toast?.kind).toBe(TOAST_KIND.endosymbiontUnlocked);
    expect(memory.toast?.text).toBe(endosymbiontUnlockedToastText('Mitochondrion'));
    expect(memory.toast?.text).toBe('Mitochondrion unlocked · offered at your next level-up');
  });

  it('fires no unlock past the count, or for an organelle already owned', () => {
    const atCount = seenOnce({
      ownProgress: progress({ bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED) }),
    });
    const pastCount = sample(START_TICK + 1, {
      ownProgress: progress({ bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED + 1) }),
    });
    expect(toastStepFor(atCount, pastCount).toast).toBeNull();

    const owned: OwnedTrait[] = [{ traitId: 'mitochondrion', tier: 1 }];
    const ownedBefore = seenOnce({
      ownProgress: progress({
        ownedTraits: owned,
        bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED - 1),
      }),
    });
    const ownedAtCount = sample(START_TICK + 1, {
      ownProgress: progress({
        ownedTraits: owned,
        bacteriaEatenByVariant: aerobicEaten(ENDOSYMBIOSIS_BACTERIA_REQUIRED),
      }),
    });
    expect(toastStepFor(ownedBefore, ownedAtCount).toast).toBeNull();
  });

  it('lets the newest replace the one up', () => {
    const joined = seenOnce({ ownProgress: progress({ dnaCatchUpGift: LATE_JOIN_DNA }) });
    const stage = toastStepFor(
      joined,
      sample(START_TICK + 1, { ownProgress: progress({ stage: CELL_STAGE.eukaryote, dnaCatchUpGift: LATE_JOIN_DNA }) }),
    );
    expect(stage.toast?.kind).toBe(TOAST_KIND.stage);
  });
});

describe('toastStepFor: the duration', () => {
  const stageAt = START_TICK + 1;
  const stage = toastStepFor(seenOnce(), sample(stageAt, { ownProgress: progress({ stage: CELL_STAGE.eukaryote }) }));
  const later = (tick: number, ownProgress: OwnProgressView | null = progress({ stage: CELL_STAGE.eukaryote })) =>
    toastStepFor(stage, sample(tick, { ownProgress })).toast;

  it('stays up for TOAST_DURATION_SECONDS of ticks, then goes', () => {
    const lastTickUp = stageAt + TOAST_DURATION_TICKS - 1;
    expect(later(lastTickUp)?.kind).toBe(TOAST_KIND.stage);
    expect(later(lastTickUp + 1)).toBeNull();
  });

  it('keeps counting while the own progress is missing', () => {
    const lastTickUp = stageAt + TOAST_DURATION_TICKS - 1;
    expect(later(lastTickUp, null)?.kind).toBe(TOAST_KIND.stage);
    expect(later(lastTickUp + 1, null)).toBeNull();
  });
});
