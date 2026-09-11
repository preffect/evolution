import { beforeEach, describe, expect, it } from 'vitest';
import {
  AMBIENT_CROSSFADE_SECONDS,
  CELL_STAGE,
  DUCK_DECIBELS,
  DUCK_RAMP_SECONDS,
  SOUND_EVENT,
  ZONE_CROSSFADE_SECONDS,
  ZONE_ID,
  decibelsToGain,
  parseAudioManifest,
} from '@evolution/shared';
import { AmbientMixer, DUCK_REASON } from './ambient-mixer';
import { AudioAssetCache } from './audio-asset-cache';
import { FakeAudioAssetLoader, FakeAudioBackend, FakeGain } from '../../../testing/fake-audio-backend';
import { createTestAudioManifest, testManifestFileNames } from '../../../testing/builders';

const STEM_FILE = (stage: string) => `${SOUND_EVENT.ambientBed}-${stage}.mp3`;

describe('AmbientMixer', () => {
  let backend: FakeAudioBackend;
  let cache: AudioAssetCache;
  let musicBus: FakeGain;
  let mixer: AmbientMixer;

  async function setUp(files: Set<string>): Promise<void> {
    backend = new FakeAudioBackend();
    cache = new AudioAssetCache(new FakeAudioAssetLoader(createTestAudioManifest(), files), backend);
    musicBus = new FakeGain(1, null);
    mixer = new AmbientMixer(backend, cache, musicBus);
    const manifest = parseAudioManifest(createTestAudioManifest())!;
    mixer.setManifest(manifest);
    await cache.preload(manifest);
  }

  beforeEach(() => setUp(testManifestFileNames()));

  it('plays under an ambient sub-bus of the music bus', () => {
    expect(backend.buses).toHaveLength(1);
    expect(backend.buses[0]!.parent).toBe(musicBus);
  });

  it('starts the stage stem at full gain and crossfades to the next stage', () => {
    mixer.setStage(CELL_STAGE.protocell);
    const first = backend.voices[0]!;
    expect(first.label).toBe(STEM_FILE(CELL_STAGE.protocell));
    expect(first.options.isLoop).toBe(true);
    expect(first.options.gain).toBe(1);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.protocell);

    mixer.setStage(CELL_STAGE.eukaryote);
    const second = backend.voices[1]!;
    expect(second.label).toBe(STEM_FILE(CELL_STAGE.eukaryote));
    expect(second.options.gain).toBe(0);
    expect(second.ramps).toEqual([{ value: 1, seconds: AMBIENT_CROSSFADE_SECONDS }]);
    expect(first.ramps).toEqual([{ value: 0, seconds: AMBIENT_CROSSFADE_SECONDS }]);
    expect(first.stopAfterSeconds).toBe(AMBIENT_CROSSFADE_SECONDS);
  });

  it('does nothing for the stage already playing', () => {
    mixer.setStage(CELL_STAGE.prokaryote);
    mixer.setStage(CELL_STAGE.prokaryote);
    expect(backend.voices).toHaveLength(1);
  });

  it('falls back to the nearest shipped stem when a stage stem is missing', async () => {
    const shipped = new Set([STEM_FILE(CELL_STAGE.protocell), STEM_FILE(CELL_STAGE.endosymbiosis)]);
    await setUp(shipped);
    mixer.setStage(CELL_STAGE.prokaryote);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.protocell);
    mixer.setStage(CELL_STAGE.eukaryote);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.endosymbiosis);
  });

  it('stays silent when no stem shipped or no manifest loaded', async () => {
    await setUp(new Set());
    mixer.setStage(CELL_STAGE.protocell);
    expect(backend.voices).toHaveLength(0);
    expect(mixer.currentStemKey).toBeNull();
    mixer.setManifest(null);
    mixer.setStage(CELL_STAGE.specialised);
    mixer.setZone(ZONE_ID.warmVent);
    expect(backend.voices).toHaveLength(0);
  });

  it('crossfades zone overlays and fades out for a zone without one', () => {
    mixer.setZone(ZONE_ID.sunlitShallows);
    expect(mixer.currentZoneKey).toBe(ZONE_ID.sunlitShallows);
    mixer.setZone(ZONE_ID.openBroth);
    expect(mixer.currentZoneKey).toBeNull();
    expect(backend.voices[0]!.stopAfterSeconds).toBe(ZONE_CROSSFADE_SECONDS);
  });

  it('ducks the ambient bus while any reason holds and lifts when the last is released', () => {
    const ambientBus = backend.buses[0]!;
    mixer.duck(DUCK_REASON.danger);
    mixer.duck(DUCK_REASON.essentialCue);
    expect(mixer.isDucked).toBe(true);
    expect(ambientBus.ramps.at(-1)).toEqual({ value: decibelsToGain(DUCK_DECIBELS), seconds: DUCK_RAMP_SECONDS });
    mixer.release(DUCK_REASON.danger);
    expect(mixer.isDucked).toBe(true);
    mixer.release(DUCK_REASON.essentialCue);
    expect(mixer.isDucked).toBe(false);
    expect(ambientBus.ramps.at(-1)).toEqual({ value: 1, seconds: DUCK_RAMP_SECONDS });
  });

  it('applies the stage and zone asked for before the files landed on refresh', async () => {
    backend = new FakeAudioBackend();
    cache = new AudioAssetCache(new FakeAudioAssetLoader(createTestAudioManifest(), testManifestFileNames()), backend);
    mixer = new AmbientMixer(backend, cache, new FakeGain(1, null));
    const manifest = parseAudioManifest(createTestAudioManifest())!;
    mixer.setStage(CELL_STAGE.protocell);
    mixer.setManifest(manifest);
    mixer.setZone(ZONE_ID.sunlitShallows);
    expect(backend.voices).toHaveLength(0);
    await cache.preload(manifest);
    mixer.refresh();
    expect(mixer.currentStemKey).toBe(CELL_STAGE.protocell);
    expect(mixer.currentZoneKey).toBe(ZONE_ID.sunlitShallows);
    mixer.refresh();
    expect(backend.voices).toHaveLength(2);
    mixer.stop();
    mixer.refresh();
    expect(backend.playing).toHaveLength(0);
  });

  it('pins the full mix from the bloom whatever the stage, until released or stopped', () => {
    mixer.setStage(CELL_STAGE.protocell);
    mixer.setBloom(true);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.specialised);
    mixer.setStage(CELL_STAGE.prokaryote);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.specialised);
    mixer.setBloom(false);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.prokaryote);
    mixer.setBloom(true);
    mixer.stop();
    mixer.setStage(CELL_STAGE.protocell);
    expect(mixer.currentStemKey).toBe(CELL_STAGE.protocell);
  });

  it('stops both layers and starts again on the next stage', () => {
    mixer.setStage(CELL_STAGE.protocell);
    mixer.setZone(ZONE_ID.viscousGel);
    mixer.stop();
    expect(mixer.currentStemKey).toBeNull();
    expect(mixer.currentZoneKey).toBeNull();
    expect(backend.playing).toHaveLength(0);
    mixer.setStage(CELL_STAGE.protocell);
    expect(backend.playing).toHaveLength(1);
  });
});
