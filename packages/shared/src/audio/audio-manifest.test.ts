import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_EVENT } from '../types/audio.js';
import { ZONE_ID } from '../types/game.js';
import { AMBIENT_STEM_COUNT, AUDIO_MANIFEST_VERSION, MOTIF_INSTRUMENT_COUNT } from '../constants/audio.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import { SOUND_EVENT_IDS, soundEventRule } from './sound-events.js';
import {
  audioFilePrompt,
  parseAudioManifest,
  resolveAudioFile,
  resolveAudioFileAt,
  type AudioManifest,
} from './audio-manifest.js';

const MANIFEST_URL = new URL('../../../../assets/audio/manifest.json', import.meta.url);
const AUDIO_FILE_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(mp3|ogg|wav)$/;
const MOOD_WORD_PATTERN = /^[a-z]+(, [a-z]+){1,4}$/;

function loadManifestJson(): unknown {
  return JSON.parse(readFileSync(MANIFEST_URL, 'utf8'));
}

function loadManifest(): AudioManifest {
  const manifest = parseAudioManifest(loadManifestJson());
  expect(manifest).not.toBeNull();
  return manifest!;
}

describe('assets/audio/manifest.json', () => {
  const manifest = loadManifest();

  it('carries the current version', () => {
    expect(manifest.version).toBe(AUDIO_MANIFEST_VERSION);
  });

  it.each(SOUND_EVENT_IDS)('%s has a mood, a length, a prompt hint and a loop flag matching the catalogue', (id) => {
    const entry = manifest.events[id];
    expect(entry.mood).toMatch(MOOD_WORD_PATTERN);
    expect(entry.lengthSeconds).toBeGreaterThan(0);
    expect(entry.promptHint.length).toBeGreaterThan(0);
    expect(entry.isLoop).toBe(soundEventRule(id).isLoop);
    expect(entry.files.length).toBeGreaterThan(0);
    for (const file of entry.files) expect(file.path).toMatch(AUDIO_FILE_PATTERN);
  });

  it('names every file once', () => {
    const paths = SOUND_EVENT_IDS.flatMap((id) => manifest.events[id].files.map((file) => file.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ships one ambient stem per stage, keyed by stage in ladder order', () => {
    const keys = manifest.events[SOUND_EVENT.ambientBed].files.map((file) => file.key);
    expect(keys).toEqual([...STAGE_ORDER]);
    expect(keys).toHaveLength(AMBIENT_STEM_COUNT);
  });

  it('ships one level-up motif per instrument', () => {
    const keys = manifest.events[SOUND_EVENT.levelUp].files.map((file) => file.key);
    expect(keys).toEqual(Array.from({ length: MOTIF_INSTRUMENT_COUNT }, (_unused, index) => `instrument-${index}`));
  });

  it('keys the zone overlays by zone id and leaves the open broth to the bed', () => {
    const keys = manifest.events[SOUND_EVENT.zoneLayer].files.map((file) => file.key);
    expect(keys).toEqual([ZONE_ID.sunlitShallows, ZONE_ID.warmVent, ZONE_ID.viscousGel]);
    expect(keys).not.toContain(ZONE_ID.openBroth);
  });

  it('gives the eat cue several round-robin notes', () => {
    expect(manifest.events[SOUND_EVENT.eat].files.length).toBeGreaterThan(1);
  });

  it('gives every file of a multi-file entry its own prompt, so the pipeline generates per item without parsing', () => {
    for (const id of SOUND_EVENT_IDS) {
      const entry = manifest.events[id];
      if (entry.files.length === 1) {
        expect(audioFilePrompt(entry, entry.files[0]!)).toBe(entry.promptHint);
        continue;
      }
      const prompts = entry.files.map((file) => audioFilePrompt(entry, file));
      for (const prompt of prompts) expect(prompt).not.toBe(entry.promptHint);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });
});

describe('parseAudioManifest', () => {
  it('rejects a manifest of another version', () => {
    const json = loadManifestJson() as Record<string, unknown>;
    expect(parseAudioManifest({ ...json, version: AUDIO_MANIFEST_VERSION + 1 })).toBeNull();
  });

  it('rejects a manifest missing an event or carrying a malformed entry', () => {
    const json = loadManifestJson() as { events: Record<string, unknown> };
    const withoutEat: Record<string, unknown> = { ...json.events };
    delete withoutEat[SOUND_EVENT.eat];
    expect(parseAudioManifest({ ...json, events: withoutEat })).toBeNull();
    const malformed = { ...json.events, [SOUND_EVENT.eat]: { mood: 'wet', lengthSeconds: 0 } };
    expect(parseAudioManifest({ ...json, events: malformed })).toBeNull();
    const badFile = {
      ...json.events,
      [SOUND_EVENT.eat]: { ...(json.events[SOUND_EVENT.eat] as object), files: [{ key: 1 }] },
    };
    expect(parseAudioManifest({ ...json, events: badFile })).toBeNull();
    const badPrompt = {
      ...json.events,
      [SOUND_EVENT.eat]: {
        ...(json.events[SOUND_EVENT.eat] as object),
        files: [{ key: 'a', path: 'a.mp3', prompt: 1 }],
      },
    };
    expect(parseAudioManifest({ ...json, events: badPrompt })).toBeNull();
  });

  it('rejects anything that is not an object with events', () => {
    expect(parseAudioManifest(null)).toBeNull();
    expect(parseAudioManifest([])).toBeNull();
    expect(parseAudioManifest({ version: AUDIO_MANIFEST_VERSION, events: 'none' })).toBeNull();
  });
});

describe('resolving files', () => {
  const manifest = loadManifest();

  it('finds a variant by key and falls back to the first file without a key', () => {
    expect(resolveAudioFile(manifest, SOUND_EVENT.ambientBed, STAGE_ORDER[2])?.key).toBe(STAGE_ORDER[2]);
    expect(resolveAudioFile(manifest, SOUND_EVENT.ambientBed)?.key).toBe(STAGE_ORDER[0]);
    expect(resolveAudioFile(manifest, SOUND_EVENT.zoneLayer, ZONE_ID.openBroth)).toBeNull();
  });

  it('wraps a round-robin index and answers null for an event with no files', () => {
    const notes = manifest.events[SOUND_EVENT.eat].files;
    expect(resolveAudioFileAt(manifest, SOUND_EVENT.eat, notes.length)).toBe(notes[0]);
    const empty: AudioManifest = {
      ...manifest,
      events: { ...manifest.events, [SOUND_EVENT.eat]: { ...manifest.events[SOUND_EVENT.eat], files: [] } },
    };
    expect(resolveAudioFileAt(empty, SOUND_EVENT.eat, 0)).toBeNull();
    expect(resolveAudioFile(empty, SOUND_EVENT.eat)).toBeNull();
  });
});
