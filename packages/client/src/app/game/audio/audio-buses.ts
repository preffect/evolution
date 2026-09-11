// The three gain stages (docs/AUDIO.md §5): `sfx` and `music` under `master`. The persisted mute
// is the master's gain, remembered in localStorage under `AUDIO_MUTE_STORAGE_KEY`; a browser that
// refuses storage keeps the session's choice only.

import { AUDIO_BUS, AUDIO_MUTE_STORAGE_KEY, DEFAULT_BUS_GAIN, type AudioBus } from '@evolution/shared';
import type { AudioBackend, AudioGainHandle } from './audio-backend';

const MUTED_FLAG = '1';
const SILENT_GAIN = 0;

/** Where the mute flag is remembered; the browser's localStorage in production, a map in tests. */
export interface MutePreferenceStore {
  read(): boolean;
  write(isMuted: boolean): void;
}

export class LocalStorageMutePreference implements MutePreferenceStore {
  read(): boolean {
    try {
      return localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === MUTED_FLAG;
    } catch {
      // localStorage unavailable (private mode, sandbox): start unmuted, remember nothing.
      return false;
    }
  }

  write(isMuted: boolean): void {
    try {
      if (isMuted) localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, MUTED_FLAG);
      else localStorage.removeItem(AUDIO_MUTE_STORAGE_KEY);
    } catch {
      // Same: the choice holds for this session only.
    }
  }
}

export class AudioBuses {
  readonly master: AudioGainHandle;
  readonly music: AudioGainHandle;
  readonly sfx: AudioGainHandle;
  private readonly volumes: Record<AudioBus, number> = { ...DEFAULT_BUS_GAIN };
  private isMasterMuted: boolean;

  constructor(
    backend: AudioBackend,
    private readonly preference: MutePreferenceStore,
  ) {
    this.isMasterMuted = preference.read();
    this.master = backend.createBus(null, this.isMasterMuted ? SILENT_GAIN : this.volumes.master);
    this.music = backend.createBus(this.master, this.volumes.music);
    this.sfx = backend.createBus(this.master, this.volumes.sfx);
  }

  get isMuted(): boolean {
    return this.isMasterMuted;
  }

  setMuted(isMuted: boolean): void {
    this.isMasterMuted = isMuted;
    this.preference.write(isMuted);
    this.master.setGain(isMuted ? SILENT_GAIN : this.volumes.master);
  }

  volumeOf(bus: AudioBus): number {
    return this.volumes[bus];
  }

  /** 0..1; the master's new volume applies only while unmuted. */
  setVolume(bus: AudioBus, volume: number): void {
    this.volumes[bus] = volume;
    if (bus === AUDIO_BUS.master && this.isMasterMuted) return;
    this.handleOf(bus).setGain(volume);
  }

  /** The bus a catalogue rule routes to. */
  handleOf(bus: AudioBus): AudioGainHandle {
    return this[bus];
  }
}
