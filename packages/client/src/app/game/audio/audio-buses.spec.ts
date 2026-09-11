import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_BUS, AUDIO_MUTE_STORAGE_KEY, DEFAULT_BUS_GAIN } from '@evolution/shared';
import { AudioBuses, LocalStorageMutePreference } from './audio-buses';
import { FakeAudioBackend, FakeGain, MemoryMutePreference } from '../../../testing/fake-audio-backend';

describe('AudioBuses', () => {
  it('builds sfx and music under the master at the default gains', () => {
    const backend = new FakeAudioBackend();
    const buses = new AudioBuses(backend, new MemoryMutePreference());
    const [master, music, sfx] = backend.buses as [FakeGain, FakeGain, FakeGain];
    expect(master.parent).toBeNull();
    expect(music.parent).toBe(master);
    expect(sfx.parent).toBe(master);
    expect([master.gain, music.gain, sfx.gain]).toEqual([
      DEFAULT_BUS_GAIN.master,
      DEFAULT_BUS_GAIN.music,
      DEFAULT_BUS_GAIN.sfx,
    ]);
    expect(buses.isMuted).toBe(false);
    expect(buses.handleOf(AUDIO_BUS.sfx)).toBe(sfx);
  });

  it('starts silent when the preference says muted and persists a change', () => {
    const backend = new FakeAudioBackend();
    const preference = new MemoryMutePreference(true);
    const buses = new AudioBuses(backend, preference);
    const master = backend.buses[0] as FakeGain;
    expect(master.gain).toBe(0);
    buses.setMuted(false);
    expect(master.gain).toBe(DEFAULT_BUS_GAIN.master);
    expect(preference.isMuted).toBe(false);
    buses.setMuted(true);
    expect(master.gain).toBe(0);
    expect(preference.isMuted).toBe(true);
  });

  it('sets a bus volume, holding a master change back while muted', () => {
    const backend = new FakeAudioBackend();
    const buses = new AudioBuses(backend, new MemoryMutePreference(true));
    const [master, music] = backend.buses as [FakeGain, FakeGain];
    buses.setVolume(AUDIO_BUS.music, 0.5);
    expect(music.gain).toBe(0.5);
    buses.setVolume(AUDIO_BUS.master, 0.7);
    expect(master.gain).toBe(0);
    expect(buses.volumeOf(AUDIO_BUS.master)).toBe(0.7);
    buses.setMuted(false);
    expect(master.gain).toBe(0.7);
  });
});

describe('LocalStorageMutePreference', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips the flag under the shared key', () => {
    const preference = new LocalStorageMutePreference();
    expect(preference.read()).toBe(false);
    preference.write(true);
    expect(localStorage.getItem(AUDIO_MUTE_STORAGE_KEY)).toBe('1');
    expect(preference.read()).toBe(true);
    preference.write(false);
    expect(localStorage.getItem(AUDIO_MUTE_STORAGE_KEY)).toBeNull();
  });

  it('answers unmuted and keeps quiet when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    const preference = new LocalStorageMutePreference();
    expect(preference.read()).toBe(false);
    expect(() => preference.write(true)).not.toThrow();
  });
});
