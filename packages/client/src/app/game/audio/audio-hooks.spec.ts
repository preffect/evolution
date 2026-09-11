import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  ManualClock,
  SOUND_EVENT,
  ZONE_ID,
  createTestSnapshot,
  parseAudioManifest,
  resolveAudioFile,
} from '@evolution/shared';
import { AudioHooks, type AudioHooksHandle } from './audio-hooks';
import { AudioService } from './audio.service';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';
import { GAME_EVENT_KIND, GameEventBus } from '../state/game-event-bus';
import { FakeAudioAssetLoader, FakeAudioBackend, MemoryMutePreference } from '../../../testing/fake-audio-backend';
import {
  TEST_OTHER_CELL_ID,
  TEST_OTHER_PLAYER_ID,
  createTestAudioManifest,
  createTestCellView,
  createTestTransitionOptions,
  testManifestFileNames,
} from '../../../testing/builders';

const PROTOCELL_BED = `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`;
const PREDATOR_MASS = 100;
const SHALLOWS_OVERLAY = resolveAudioFile(
  parseAudioManifest(createTestAudioManifest())!,
  SOUND_EVENT.zoneLayer,
  ZONE_ID.sunlitShallows,
)!.path;

describe('AudioHooks', () => {
  let backend: FakeAudioBackend;
  let events: GameEventBus;
  let hooks: AudioHooks;
  let handle: AudioHooksHandle;

  function configure(): void {
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
  }

  beforeEach(async () => {
    configure();
    await handle.ready;
  });

  it('plays what the first snapshot asked for once the assets land, in the production order', async () => {
    TestBed.resetTestingModule();
    configure();
    const predator = createTestCellView({
      id: TEST_OTHER_CELL_ID,
      playerId: TEST_OTHER_PLAYER_ID,
      mass: PREDATOR_MASS,
    });
    handle.observe(createTestSnapshot({ cells: [createTestCellView(), predator] }));
    events.emit({ kind: GAME_EVENT_KIND.zoneChanged, zone: ZONE_ID.sunlitShallows });
    expect(backend.voices).toHaveLength(0);
    await handle.ready;
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      PROTOCELL_BED,
      SHALLOWS_OVERLAY,
      `${SOUND_EVENT.dangerWarning}.mp3`,
    ]);
    handle.observe(createTestSnapshot({ cells: [createTestCellView(), predator] }));
    expect(backend.voices).toHaveLength(3);
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
