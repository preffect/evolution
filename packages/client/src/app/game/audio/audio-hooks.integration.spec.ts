// The audio wire (docs/ARCHITECTURE.md §7): a snapshot goes through the transition tracker onto
// the game event bus, the sound bus maps it, and the audio service plays the manifest's file on
// the fake platform. Proves the seam the renderer (#99) and the HUD (#100) will call into.

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CELL_STAGE, ManualClock, ROUND_PHASE, SOUND_EVENT, createTestSnapshot } from '@evolution/shared';
import { AudioService } from './audio.service';
import { SoundEventBus } from './sound-event-bus';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';
import { GameEventBus, GAME_EVENT_KIND } from '../state/game-event-bus';
import { SnapshotTransitionTracker } from '../state/snapshot-transitions';
import { FakeAudioAssetLoader, FakeAudioBackend, MemoryMutePreference } from '../../../testing/fake-audio-backend';
import {
  TEST_OTHER_CELL_ID,
  TEST_OTHER_PLAYER_ID,
  createTestAudioManifest,
  createTestCellView,
  createTestEatEffect,
  createTestTransitionOptions,
  testManifestFileNames,
} from '../../../testing/builders';

const PREDATOR_MASS = 100;

describe('audio hooks: snapshot → transitions → game events → sound bus → audio service', () => {
  let backend: FakeAudioBackend;
  let tracker: SnapshotTransitionTracker;
  let events: GameEventBus;

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
    const audio = TestBed.inject(AudioService);
    await audio.initialize();
    events = TestBed.inject(GameEventBus);
    new SoundEventBus(events, audio).connect();
    tracker = new SnapshotTransitionTracker(events, createTestTransitionOptions());
  });

  it('starts the bed on the first snapshot and plays the eat note for the own cell', () => {
    tracker.observe(createTestSnapshot({ cells: [createTestCellView()], effects: [createTestEatEffect()] }));
    expect(backend.labelsPlayed()).toEqual([
      `${SOUND_EVENT.eat}-note-1.mp3`,
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`,
    ]);
  });

  it('crossfades the bed on a stage change and drones under a threat', () => {
    tracker.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    const predator = createTestCellView({
      id: TEST_OTHER_CELL_ID,
      playerId: TEST_OTHER_PLAYER_ID,
      mass: PREDATOR_MASS,
    });
    tracker.observe(createTestSnapshot({ cells: [createTestCellView({ stage: CELL_STAGE.prokaryote }), predator] }));
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.prokaryote}.mp3`,
      `${SOUND_EVENT.dangerWarning}.mp3`,
    ]);
    expect(backend.buses[3]!.ramps.at(-1)?.value).toBeLessThan(1);
  });

  it('plays the cadence and silences the bed at results', () => {
    tracker.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    tracker.observe(createTestSnapshot({ cells: [createTestCellView()], roundPhase: ROUND_PHASE.results }));
    expect(backend.playing.map((voice) => voice.label)).toEqual([`${SOUND_EVENT.roundEnd}.mp3`]);
  });

  it('plays a HUD click raised straight onto the bus', () => {
    events.emit({ kind: GAME_EVENT_KIND.uiClick });
    expect(backend.labelsPlayed()).toEqual([`${SOUND_EVENT.uiClick}.mp3`]);
  });
});
