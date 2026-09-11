import { describe, expect, it } from 'vitest';
import {
  AUDIO_BUS,
  MAX_OVERLAPPING_CUES,
  ManualClock,
  SOUND_EVENT,
  SOUND_PRIORITY,
  type SoundEventRule,
} from '@evolution/shared';
import { CueScheduler, type ActiveCue } from './cue-scheduler';
import { FakeVoice, type FakeSound } from '../../../testing/fake-audio-backend';
import { FakeGain } from '../../../testing/fake-audio-backend';

const COOLDOWN_MS = 150;
const RULE: SoundEventRule = {
  priority: SOUND_PRIORITY.filler,
  cooldownMs: COOLDOWN_MS,
  isLoop: false,
  bus: AUDIO_BUS.sfx,
};

function voice(): FakeVoice {
  const sound: FakeSound = { label: 'cue', durationSeconds: 1 };
  return new FakeVoice(sound, {
    destination: new FakeGain(1, null),
    isLoop: false,
    gain: 1,
    playbackRate: 1,
    startAfterSeconds: 0,
  });
}

function cue(priority: SoundEventRule['priority']): ActiveCue {
  return { id: SOUND_EVENT.eat, priority, voice: voice() };
}

function filled(scheduler: CueScheduler, priority: SoundEventRule['priority']): ActiveCue[] {
  const cues = Array.from({ length: MAX_OVERLAPPING_CUES }, () => cue(priority));
  for (const active of cues) scheduler.track(active);
  return cues;
}

describe('CueScheduler cooldown', () => {
  it('refuses a second play inside the cooldown and allows it once the gap has passed', () => {
    const clock = new ManualClock();
    const scheduler = new CueScheduler(clock);
    expect(scheduler.passesCooldown(SOUND_EVENT.eat, RULE)).toBe(true);
    clock.advanceMilliseconds(COOLDOWN_MS - 1);
    expect(scheduler.passesCooldown(SOUND_EVENT.eat, RULE)).toBe(false);
    clock.advanceMilliseconds(1);
    expect(scheduler.passesCooldown(SOUND_EVENT.eat, RULE)).toBe(true);
  });

  it('reports the remaining gap and counts a deferred play from its actual start', () => {
    const clock = new ManualClock();
    const scheduler = new CueScheduler(clock);
    expect(scheduler.remainingCooldownMs(SOUND_EVENT.eat, RULE)).toBe(0);
    scheduler.recordPlay(SOUND_EVENT.eat, 0);
    clock.advanceMilliseconds(50);
    expect(scheduler.remainingCooldownMs(SOUND_EVENT.eat, RULE)).toBe(COOLDOWN_MS - 50);
    scheduler.recordPlay(SOUND_EVENT.eat, COOLDOWN_MS - 50);
    expect(scheduler.remainingCooldownMs(SOUND_EVENT.eat, RULE)).toBe(2 * COOLDOWN_MS - 50);
    clock.advanceMilliseconds(2 * COOLDOWN_MS);
    expect(scheduler.remainingCooldownMs(SOUND_EVENT.eat, RULE)).toBe(0);
  });

  it('keeps cooldowns per event', () => {
    const scheduler = new CueScheduler(new ManualClock());
    expect(scheduler.passesCooldown(SOUND_EVENT.eat, RULE)).toBe(true);
    expect(scheduler.passesCooldown(SOUND_EVENT.uiClick, RULE)).toBe(true);
  });
});

describe('CueScheduler overlap', () => {
  it('admits anything below capacity', () => {
    const scheduler = new CueScheduler(new ManualClock());
    expect(scheduler.admit(RULE)).toEqual({ isAdmitted: true, evicted: [] });
  });

  it('always admits an essential cue', () => {
    const scheduler = new CueScheduler(new ManualClock());
    filled(scheduler, SOUND_PRIORITY.essential);
    expect(scheduler.admit({ ...RULE, priority: SOUND_PRIORITY.essential }).isAdmitted).toBe(true);
  });

  it('drops a filler at capacity and evicts the lowest cue for a higher one', () => {
    const scheduler = new CueScheduler(new ManualClock());
    const [lowest] = filled(scheduler, SOUND_PRIORITY.filler);
    expect(scheduler.admit(RULE)).toEqual({ isAdmitted: false, evicted: [] });
    expect(scheduler.admit({ ...RULE, priority: SOUND_PRIORITY.minor })).toEqual({
      isAdmitted: true,
      evicted: [lowest],
    });
  });

  it('drops a major cue when the four sounding are all major or better', () => {
    const scheduler = new CueScheduler(new ManualClock());
    filled(scheduler, SOUND_PRIORITY.major);
    expect(scheduler.admit({ ...RULE, priority: SOUND_PRIORITY.major }).isAdmitted).toBe(false);
  });

  it('releases a cue when its voice ends and stops every cue on stopAll', () => {
    const scheduler = new CueScheduler(new ManualClock());
    const cues = filled(scheduler, SOUND_PRIORITY.minor);
    (cues[0]!.voice as FakeVoice).end();
    expect(scheduler.activeCount).toBe(MAX_OVERLAPPING_CUES - 1);
    scheduler.release(cues[0]!);
    expect(scheduler.activeCount).toBe(MAX_OVERLAPPING_CUES - 1);
    scheduler.stopAll();
    expect(scheduler.activeCount).toBe(0);
    expect(cues.slice(1).every((active) => (active.voice as FakeVoice).isStopped)).toBe(true);
  });
});
