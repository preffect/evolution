// The injection seams of the audio layer (docs/ARCHITECTURE.md §7): the platform backend, the
// asset loader and the mute store. Production factories here; tests pass the fakes directly.

import { InjectionToken } from '@angular/core';
import type { AudioBackend } from './audio-backend';
import { WebAudioBackend } from './web-audio-backend';
import { FetchAudioAssetLoader, type AudioAssetLoader } from './audio-asset-cache';
import { LocalStorageMutePreference, type MutePreferenceStore } from './audio-buses';

export const AUDIO_BACKEND = new InjectionToken<AudioBackend>('AudioBackend', {
  providedIn: 'root',
  factory: () => new WebAudioBackend(),
});

export const AUDIO_ASSET_LOADER = new InjectionToken<AudioAssetLoader>('AudioAssetLoader', {
  providedIn: 'root',
  factory: () => new FetchAudioAssetLoader(),
});

export const MUTE_PREFERENCE = new InjectionToken<MutePreferenceStore>('MutePreferenceStore', {
  providedIn: 'root',
  factory: () => new LocalStorageMutePreference(),
});
