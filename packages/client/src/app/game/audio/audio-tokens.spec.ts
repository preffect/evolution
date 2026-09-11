import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SystemClock } from '@evolution/shared';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { WebAudioBackend } from './web-audio-backend';
import { FetchAudioAssetLoader } from './audio-asset-cache';
import { LocalStorageMutePreference } from './audio-buses';
import { CLOCK } from '../clock-provider';

describe('audio injection tokens', () => {
  it('provide the production implementations by default', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(AUDIO_BACKEND)).toBeInstanceOf(WebAudioBackend);
    expect(TestBed.inject(AUDIO_ASSET_LOADER)).toBeInstanceOf(FetchAudioAssetLoader);
    expect(TestBed.inject(MUTE_PREFERENCE)).toBeInstanceOf(LocalStorageMutePreference);
    expect(TestBed.inject(CLOCK)).toBeInstanceOf(SystemClock);
  });
});
