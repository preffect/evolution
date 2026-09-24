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
  TOAST_TEXT,
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
  return { seatKey: SEAT, tick, ownProgress: progress(), isBloom: false, ...overrides };
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
    expect(memory.toast?.text).toBe('Joined late: you start at level 2 with 60 DNA of catch-up. Pick your traits.');
  });

  it('fires nothing for a player who joined at the start, or for a bloom or stage already reached', () => {
    const memory = seenOnce({ isBloom: true, ownProgress: progress({ stage: CELL_STAGE.eukaryote }) });
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
    const next = toastStepFor(memory, sample(START_TICK + 1, { seatKey: OTHER_SEAT, isBloom: true }));
    expect(next.toast).toBeNull();
    expect(next.seatKey).toBe(OTHER_SEAT);
  });

  it('remembers nothing before the room names us', () => {
    const memory = toastStepFor(INITIAL_TOAST_MEMORY, sample(START_TICK, { ownProgress: null }));
    expect(memory).toEqual(INITIAL_TOAST_MEMORY);
  });
});

describe('toastStepFor: the changes', () => {
  it('fires bloom the snapshot the clock enters it', () => {
    const memory = toastStepFor(seenOnce(), sample(START_TICK + 1, { isBloom: true }));
    expect(memory.toast).toEqual({ kind: TOAST_KIND.bloom, text: TOAST_TEXT.bloom, shownAtTick: START_TICK + 1 });
    expect(TOAST_TEXT.bloom).toBe('Bloom: food and DNA multiply.');
  });

  it('fires stage when the own stage moves, in its rung’s words', () => {
    const memory = toastStepFor(
      seenOnce(),
      sample(START_TICK + 1, { ownProgress: progress({ stage: CELL_STAGE.eukaryote }) }),
    );
    expect(memory.toast?.kind).toBe(TOAST_KIND.stage);
    expect(memory.toast?.text).toBe(STAGE_TOAST_TEXT.eukaryote);
    expect(STAGE_TOAST_TEXT.eukaryote).toBe('You are a eukaryote.');
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
    expect(memory.toast?.text).toBe('Mitochondrion unlocked: offered at your next level-up.');
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
    const bloom = toastStepFor(seenOnce(), sample(START_TICK + 1, { isBloom: true }));
    const stage = toastStepFor(
      bloom,
      sample(START_TICK + 2, { isBloom: true, ownProgress: progress({ stage: CELL_STAGE.eukaryote }) }),
    );
    expect(stage.toast?.kind).toBe(TOAST_KIND.stage);
  });
});

describe('toastStepFor: the duration', () => {
  const bloomAt = START_TICK + 1;
  const bloom = toastStepFor(seenOnce(), sample(bloomAt, { isBloom: true }));

  it('stays up for TOAST_DURATION_SECONDS of ticks, then goes', () => {
    const lastTickUp = bloomAt + TOAST_DURATION_TICKS - 1;
    expect(toastStepFor(bloom, sample(lastTickUp, { isBloom: true })).toast?.kind).toBe(TOAST_KIND.bloom);
    expect(toastStepFor(bloom, sample(lastTickUp + 1, { isBloom: true })).toast).toBeNull();
  });

  it('keeps counting while the own progress is missing', () => {
    const lastTickUp = bloomAt + TOAST_DURATION_TICKS - 1;
    expect(toastStepFor(bloom, sample(lastTickUp, { ownProgress: null })).toast?.kind).toBe(TOAST_KIND.bloom);
    expect(toastStepFor(bloom, sample(lastTickUp + 1, { ownProgress: null })).toast).toBeNull();
  });
});
