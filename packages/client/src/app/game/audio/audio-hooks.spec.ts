import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CELL_STAGE, ManualClock, SOUND_EVENT, createTestSnapshot } from '@evolution/shared';
import { AudioHooks, type AudioHooksHandle } from './audio-hooks';
import { AudioService } from './audio.service';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';
import { GameEventBus } from '../state/game-event-bus';
import { FakeAudioAssetLoader, FakeAudioBackend, MemoryMutePreference } from '../../../testing/fake-audio-backend';
import {
  TEST_OTHER_PLAYER_ID,
  createTestAudioManifest,
  createTestCellView,
  createTestTransitionOptions,
  testManifestFileNames,
} from '../../../testing/builders';

const PROTOCELL_BED = `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`;

describe('AudioHooks', () => {
  let backend: FakeAudioBackend;
  let events: GameEventBus;
  let hooks: AudioHooks;
  let handle: AudioHooksHandle;

  beforeEach(async () => {
    backend = new FakeAudioBackend();
    TestBed.configureTestingModule({
      providers: [
        { provide: AUDIO_BACKEND, useValue: backend },
        {
          provide: AUDIO_ASSET_LOADER,
          useValue: new FakeAudioAssetLoader(createTestAudioManifest(), testManifestFileNames()),
        },
        { provide: CLOCK, useValue: new ManualClock() },
        { provide: MUTE_PREFERENCE, useValue: new MemoryMutePreference() },
      ],
    });
    events = TestBed.inject(GameEventBus);
    hooks = TestBed.inject(AudioHooks);
    handle = hooks.connect(createTestTransitionOptions());
    await handle.ready;
  });

  it('connects the sound bus to the event bus and loads the manifest', () => {
    expect(events.listenerCount).toBe(1);
    expect(TestBed.inject(AudioService).hasManifest).toBe(true);
  });

  it('turns an observed snapshot into sound', () => {
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    expect(backend.labelsPlayed()).toEqual([PROTOCELL_BED]);
  });

  it('forwards the unlock gesture to the platform', () => {
    handle.unlock();
    expect(backend.unlockCount).toBe(1);
  });

  it('follows the own player id through updateOptions', () => {
    handle.updateOptions({ ownPlayerId: TEST_OTHER_PLAYER_ID });
    handle.observe(createTestSnapshot({ cells: [createTestCellView({ playerId: TEST_OTHER_PLAYER_ID })] }));
    expect(backend.labelsPlayed()).toEqual([PROTOCELL_BED]);
  });

  it('disconnect silences everything, leaves the bus and makes the handle inert', () => {
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    handle.disconnect();
    expect(backend.playing).toEqual([]);
    expect(events.listenerCount).toBe(0);
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    handle.disconnect();
    expect(backend.labelsPlayed()).toEqual([PROTOCELL_BED]);
  });

  it('a second connect after disconnect starts a fresh round on the same service', () => {
    handle.disconnect();
    const next = hooks.connect(createTestTransitionOptions());
    next.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    expect(backend.labelsPlayed()).toEqual([PROTOCELL_BED]);
    expect(events.listenerCount).toBe(1);
  });
});
