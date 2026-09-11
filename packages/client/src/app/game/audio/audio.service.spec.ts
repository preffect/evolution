import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_BUS,
  CELL_STAGE,
  MAX_OVERLAPPING_CUES,
  MILLISECONDS_PER_SECOND,
  ManualClock,
  SOUND_EVENT,
  ZONE_ID,
  soundEventRule,
} from '@evolution/shared';
import { AudioService } from './audio.service';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';
import {
  FakeAudioAssetLoader,
  FakeAudioBackend,
  FakeGain,
  MemoryMutePreference,
} from '../../../testing/fake-audio-backend';
import { createTestAudioManifest, testManifestFileNames } from '../../../testing/builders';

describe('AudioService', () => {
  let backend: FakeAudioBackend;
  let loader: FakeAudioAssetLoader;
  let clock: ManualClock;
  let preference: MemoryMutePreference;
  let service: AudioService;

  function configure(files: Set<string>, manifest: unknown = createTestAudioManifest()): void {
    TestBed.resetTestingModule();
    backend = new FakeAudioBackend();
    loader = new FakeAudioAssetLoader(manifest, files);
    clock = new ManualClock();
    preference = new MemoryMutePreference();
    TestBed.configureTestingModule({
      providers: [
        { provide: AUDIO_BACKEND, useValue: backend },
        { provide: AUDIO_ASSET_LOADER, useValue: loader },
        { provide: CLOCK, useValue: clock },
        { provide: MUTE_PREFERENCE, useValue: preference },
      ],
    });
    service = TestBed.inject(AudioService);
  }

  beforeEach(async () => {
    configure(testManifestFileNames());
    await service.initialize();
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the manifest once and preloads its files', async () => {
    expect(service.hasManifest).toBe(true);
    const requests = loader.requestedUrls.length;
    await service.initialize();
    expect(loader.requestedUrls).toHaveLength(requests);
    expect(backend.decodedLabels).toHaveLength(testManifestFileNames().size);
  });

  it('plays a one-shot through the rule bus with the round-robin file', () => {
    service.play(SOUND_EVENT.eat);
    service.play(SOUND_EVENT.eat);
    expect(backend.labelsPlayed()).toEqual([`${SOUND_EVENT.eat}-note-1.mp3`]);
    const voice = backend.voices[0]!;
    expect(voice.options.isLoop).toBe(false);
    expect(voice.options.destination as FakeGain).toBe(backend.buses[2]);
    clock.advanceMilliseconds(soundEventRule(SOUND_EVENT.eat).cooldownMs);
    service.play(SOUND_EVENT.eat);
    expect(backend.labelsPlayed()).toEqual([`${SOUND_EVENT.eat}-note-1.mp3`, `${SOUND_EVENT.eat}-note-2.mp3`]);
  });

  it('consumes the cooldown even when the play found no file', () => {
    service.play(SOUND_EVENT.dnaAbsorb, 'missing-variant');
    service.play(SOUND_EVENT.dnaAbsorb);
    expect(backend.voices).toHaveLength(0);
    clock.advanceMilliseconds(soundEventRule(SOUND_EVENT.dnaAbsorb).cooldownMs);
    service.play(SOUND_EVENT.dnaAbsorb);
    expect(backend.voices).toHaveLength(1);
  });

  it('is silent for an event whose file never shipped and for an unknown variant', () => {
    configure(new Set([`${SOUND_EVENT.eat}-note-1.mp3`]));
    return service.initialize().then(() => {
      service.play(SOUND_EVENT.dnaAbsorb);
      service.play(SOUND_EVENT.levelUp, 'instrument-3');
      service.startLoop(SOUND_EVENT.dangerWarning);
      expect(backend.voices).toHaveLength(0);
      service.play(SOUND_EVENT.eat);
      expect(backend.voices).toHaveLength(1);
    });
  });

  it('starts the bed and the loops asked for before the assets landed once they do', async () => {
    configure(testManifestFileNames());
    service.setAmbientStage(CELL_STAGE.protocell);
    service.setDanger(true);
    service.startLoop(SOUND_EVENT.engulfProgress);
    service.stopLoop(SOUND_EVENT.engulfProgress);
    expect(backend.voices).toHaveLength(0);
    await service.initialize();
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`,
      `${SOUND_EVENT.dangerWarning}.mp3`,
    ]);
    expect(backend.voices[1]!.startAfterSeconds).toBe(0);
  });

  it('is silent without a manifest and never throws', async () => {
    configure(testManifestFileNames(), { version: 'nope' });
    await service.initialize();
    expect(service.hasManifest).toBe(false);
    expect(() => {
      service.play(SOUND_EVENT.eat);
      service.startLoop(SOUND_EVENT.softFlutter);
      service.setAmbientStage(CELL_STAGE.protocell);
      service.setZone(ZONE_ID.warmVent);
      service.setDanger(true);
    }).not.toThrow();
    expect(backend.voices).toHaveLength(0);
  });

  it('survives a platform that throws, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    backend.shouldThrow = true;
    expect(() => {
      service.play(SOUND_EVENT.eat);
      service.unlock();
      service.setAmbientStage(CELL_STAGE.protocell);
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('drops a filler cue at capacity and lets an essential cue through, ducking the bed', () => {
    for (let index = 0; index < MAX_OVERLAPPING_CUES; index += 1) {
      service.play(SOUND_EVENT.uiClick, 'default');
      clock.advanceMilliseconds(soundEventRule(SOUND_EVENT.uiClick).cooldownMs);
    }
    expect(backend.playing).toHaveLength(MAX_OVERLAPPING_CUES);
    service.play(SOUND_EVENT.softClick);
    expect(backend.playing).toHaveLength(MAX_OVERLAPPING_CUES);
    expect(backend.voices.filter((voice) => voice.label === `${SOUND_EVENT.softClick}.mp3`)).toHaveLength(1);
    service.play(SOUND_EVENT.engulfComplete);
    const ambientBus = backend.buses[3]!;
    expect(ambientBus.ramps.at(-1)?.value).toBeLessThan(1);
    backend.voices.at(-1)!.end();
    expect(ambientBus.ramps.at(-1)?.value).toBe(1);
  });

  it('starts a loop once, changes its rate, and stops it', () => {
    service.startLoop(SOUND_EVENT.engulfProgress);
    service.startLoop(SOUND_EVENT.engulfProgress);
    expect(backend.voices).toHaveLength(1);
    expect(backend.voices[0]!.options.isLoop).toBe(true);
    service.setLoopPlaybackRate(SOUND_EVENT.engulfProgress, 1.25);
    expect(backend.voices[0]!.playbackRate).toBe(1.25);
    service.stopLoop(SOUND_EVENT.engulfProgress);
    expect(backend.playing).toHaveLength(0);
    service.play(SOUND_EVENT.softFlutter);
    expect(backend.voices[1]!.options.isLoop).toBe(true);
  });

  it('plays the danger drone and ducks the bed while danger shows, once per change', () => {
    service.setAmbientStage(CELL_STAGE.protocell);
    service.setDanger(true);
    service.setDanger(true);
    expect(backend.labelsPlayed()).toContain(`${SOUND_EVENT.dangerWarning}.mp3`);
    expect(backend.voices).toHaveLength(2);
    const ambientBus = backend.buses[3]!;
    expect(ambientBus.ramps.at(-1)?.value).toBeLessThan(1);
    service.setDanger(false);
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`,
    ]);
    expect(ambientBus.ramps.at(-1)?.value).toBe(1);
  });

  it('crossfades the bed by stage and stops everything on stopAll', () => {
    service.setAmbientStage(CELL_STAGE.protocell);
    service.setAmbientStage(CELL_STAGE.specialised);
    service.setZone(ZONE_ID.viscousGel);
    service.setDanger(true);
    service.play(SOUND_EVENT.eat);
    service.stopAll();
    expect(backend.playing).toHaveLength(0);
    service.setDanger(true);
    expect(backend.playing.map((voice) => voice.label)).toEqual([`${SOUND_EVENT.dangerWarning}.mp3`]);
  });

  it('defers a loop inside its cooldown to the end of the gap instead of dropping it', () => {
    const cooldownMs = soundEventRule(SOUND_EVENT.dangerWarning).cooldownMs;
    service.setDanger(true);
    clock.advanceMilliseconds(cooldownMs / 2);
    service.setDanger(false);
    service.setDanger(true);
    const drones = backend.voices.filter((voice) => voice.label === `${SOUND_EVENT.dangerWarning}.mp3`);
    expect(drones.map((voice) => voice.startAfterSeconds)).toEqual([0, cooldownMs / 2 / MILLISECONDS_PER_SECOND]);
    expect(backend.playing).toHaveLength(1);
    service.setDanger(false);
    expect(backend.playing).toHaveLength(0);
  });

  it('persists the mute and sets bus volumes', () => {
    service.setMuted(true);
    expect(service.isMuted).toBe(true);
    expect(preference.isMuted).toBe(true);
    expect(backend.buses[0]!.gain).toBe(0);
    service.setVolume(AUDIO_BUS.sfx, 0.4);
    expect(backend.buses[2]!.gain).toBe(0.4);
  });

  it('unlocks the platform from a gesture', () => {
    service.unlock();
    expect(backend.unlockCount).toBe(1);
  });
});
