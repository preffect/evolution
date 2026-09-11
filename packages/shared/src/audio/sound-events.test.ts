import { describe, expect, it } from 'vitest';
import { AUDIO_BUS, SOUND_EVENT, type SoundEventId } from '../types/audio.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import {
  AMBIENT_STEM_COUNT,
  MAX_OVERLAPPING_CUES,
  MOTIF_INSTRUMENT_COUNT,
  SOUND_EVENT_CATALOG,
  SOUND_PRIORITY,
} from '../constants/audio.js';
import { TRAIT_CATALOG } from '../constants/traits.js';
import {
  SOUND_EVENT_IDS,
  TRAIT_CUE_BY_TRAIT,
  ambientStemForStage,
  decibelsToGain,
  motifInstrumentFor,
  nearestAvailableStem,
  soundEventRule,
} from './sound-events.js';

const SNAKE_CASE_ID = /^[a-z]+(_[a-z]+)*$/;
/** The longest gap #140 asks for is the zone layer's 2 s; anything longer would be a typo in seconds. */
const LONGEST_COOLDOWN_MS = 2000;
const EVENT_COUNT = 30;
const GAIN_TOLERANCE_DIGITS = 3;

describe('the sound-event catalogue', () => {
  it('lists every id once, in snake_case', () => {
    expect(SOUND_EVENT_IDS).toHaveLength(EVENT_COUNT);
    expect(new Set(SOUND_EVENT_IDS).size).toBe(EVENT_COUNT);
    for (const id of SOUND_EVENT_IDS) expect(id).toMatch(SNAKE_CASE_ID);
  });

  it.each(SOUND_EVENT_IDS)('%s has a rule with a priority and a cooldown in range', (id) => {
    const rule = soundEventRule(id);
    expect(rule).toBe(SOUND_EVENT_CATALOG[id]);
    expect(rule.priority).toBeGreaterThanOrEqual(SOUND_PRIORITY.filler);
    expect(rule.priority).toBeLessThanOrEqual(SOUND_PRIORITY.essential);
    expect(Number.isInteger(rule.priority)).toBe(true);
    expect(rule.cooldownMs).toBeGreaterThanOrEqual(0);
    expect(rule.cooldownMs).toBeLessThanOrEqual(LONGEST_COOLDOWN_MS);
    expect([AUDIO_BUS.music, AUDIO_BUS.sfx]).toContain(rule.bus);
  });

  it('keeps the bed, the zone overlays and the danger drone as music loops (#140 option B)', () => {
    for (const id of [SOUND_EVENT.ambientBed, SOUND_EVENT.zoneLayer, SOUND_EVENT.dangerWarning]) {
      expect(soundEventRule(id)).toMatchObject({ isLoop: true, bus: AUDIO_BUS.music });
    }
  });

  it('never drops the level-up, the payout, the death and the round end', () => {
    for (const id of [SOUND_EVENT.levelUp, SOUND_EVENT.engulfComplete, SOUND_EVENT.engulfed, SOUND_EVENT.roundEnd]) {
      expect(soundEventRule(id).priority).toBe(SOUND_PRIORITY.essential);
    }
  });

  it('makes the most frequent cues the first to go', () => {
    expect(soundEventRule(SOUND_EVENT.eat).priority).toBe(SOUND_PRIORITY.filler);
    expect(soundEventRule(SOUND_EVENT.uiClick).priority).toBe(SOUND_PRIORITY.filler);
    expect(MAX_OVERLAPPING_CUES).toBeGreaterThan(1);
  });
});

describe('trait cues', () => {
  it.each(TRAIT_CATALOG)('$id maps to a catalogue id', (trait) => {
    expect(TRAIT_CUE_BY_TRAIT[trait.id]).toBe(trait.audioCue);
    expect(SOUND_EVENT_IDS).toContain(trait.audioCue);
  });

  it('gives every trait its own cue', () => {
    const cues = TRAIT_CATALOG.map((trait) => trait.audioCue);
    expect(new Set(cues).size).toBe(cues.length);
  });
});

describe('ambient layering', () => {
  it('assigns one stem per stage, rising along the ladder', () => {
    const stems = STAGE_ORDER.map(ambientStemForStage);
    expect(stems).toEqual(STAGE_ORDER.map((_stage, index) => index));
    expect(AMBIENT_STEM_COUNT).toBe(STAGE_ORDER.length);
  });

  it('adds one motif instrument per organelle and caps at the bed', () => {
    const counts = Array.from({ length: MOTIF_INSTRUMENT_COUNT + 3 }, (_unused, organelles) =>
      motifInstrumentFor(organelles),
    );
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]!);
    }
    expect(counts[0]).toBe(0);
    expect(counts.at(-1)).toBe(MOTIF_INSTRUMENT_COUNT - 1);
    expect(motifInstrumentFor(-1)).toBe(0);
  });

  it('falls back to the nearest shipped stem, lower on a tie (stems 1, 3, 5 ship first)', () => {
    const isShipped = (stem: number) => [0, 2, 4].includes(stem);
    expect(nearestAvailableStem(2, isShipped)).toBe(2);
    expect(nearestAvailableStem(1, isShipped)).toBe(0);
    expect(nearestAvailableStem(3, isShipped)).toBe(2);
    expect(nearestAvailableStem(4, (stem) => stem === 1)).toBe(1);
    expect(nearestAvailableStem(0, (stem) => stem === 4)).toBe(4);
    expect(nearestAvailableStem(2, () => false)).toBeNull();
  });
});

describe('decibelsToGain', () => {
  it('maps 0 dB to unity and −20 dB to a tenth', () => {
    expect(decibelsToGain(0)).toBe(1);
    expect(decibelsToGain(-20)).toBeCloseTo(0.1, GAIN_TOLERANCE_DIGITS);
  });
});

describe('the id table', () => {
  it('is what the catalogue is keyed by', () => {
    const keys = Object.keys(SOUND_EVENT_CATALOG) as SoundEventId[];
    expect([...keys].sort()).toEqual([...SOUND_EVENT_IDS].sort());
  });
});
