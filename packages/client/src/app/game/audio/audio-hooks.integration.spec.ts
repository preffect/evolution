// The audio wire (docs/ARCHITECTURE.md §7): `AudioHooks.connect` is the composition root's one
// call; a snapshot fed to its handle goes through the transition tracker onto the game event bus,
// the sound bus maps it, and the audio service plays the manifest's file on the fake platform.
// Proves the seam the renderer (#99) and the HUD (#100) will call into.

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  ManualClock,
  ROUND_PHASE,
  SOUND_EVENT,
  createTestSnapshot,
} from '@evolution/shared';
import { AudioHooks, type AudioHooksHandle } from './audio-hooks';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';
import { GameEventBus, GAME_EVENT_KIND } from '../state/game-event-bus';
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
const ROUND_MS = createTestTransitionOptions().roundDurationSeconds * MILLISECONDS_PER_SECOND;
const BLOOM_MS_LEFT = ROUND_MS * (1 - DEFAULT_BALANCE.session.ROUND_BLOOM_START_FRACTION);
/** `AudioBuses` creates master, music and sfx; the mixer's ambient sub-bus is the fourth. */
const AMBIENT_BUS_INDEX = 3;

describe('audio hooks: snapshot → transitions → game events → sound bus → audio service', () => {
  let backend: FakeAudioBackend;
  let events: GameEventBus;
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
    handle = TestBed.inject(AudioHooks).connect(createTestTransitionOptions());
  });

  it('starts the bed for a snapshot that beats the asset load (the production order)', async () => {
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    expect(backend.voices).toHaveLength(0);
    await handle.ready;
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`,
    ]);
  });

  it('starts the bed on the first snapshot and plays the eat note for the own cell', async () => {
    await handle.ready;
    handle.observe(createTestSnapshot({ cells: [createTestCellView()], effects: [createTestEatEffect()] }));
    expect(backend.labelsPlayed()).toEqual([
      `${SOUND_EVENT.eat}-note-1.mp3`,
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`,
    ]);
  });

  it('crossfades the bed on a stage change and drones under a threat', async () => {
    await handle.ready;
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    const predator = createTestCellView({
      id: TEST_OTHER_CELL_ID,
      playerId: TEST_OTHER_PLAYER_ID,
      mass: PREDATOR_MASS,
    });
    handle.observe(createTestSnapshot({ cells: [createTestCellView({ stage: CELL_STAGE.prokaryote }), predator] }));
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.prokaryote}.mp3`,
      `${SOUND_EVENT.dangerWarning}.mp3`,
    ]);
    expect(backend.buses[AMBIENT_BUS_INDEX]!.ramps.at(-1)?.value).toBeLessThan(1);
  });

  it('crossfades a protocell to the full mix when the bloom starts', async () => {
    await handle.ready;
    handle.observe(createTestSnapshot({ cells: [createTestCellView()], roundTimeLeftMs: ROUND_MS }));
    handle.observe(createTestSnapshot({ cells: [createTestCellView()], roundTimeLeftMs: BLOOM_MS_LEFT }));
    expect(backend.playing.map((voice) => voice.label)).toEqual([
      `${SOUND_EVENT.ambientBed}-${CELL_STAGE.specialised}.mp3`,
      `${SOUND_EVENT.bloomStart}.mp3`,
    ]);
  });

  it('plays the cadence and silences the bed at results', async () => {
    await handle.ready;
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    handle.observe(createTestSnapshot({ cells: [createTestCellView()], roundPhase: ROUND_PHASE.results }));
    expect(backend.playing.map((voice) => voice.label)).toEqual([`${SOUND_EVENT.roundEnd}.mp3`]);
  });

  it('plays a HUD click raised straight onto the bus', async () => {
    await handle.ready;
    events.emit({ kind: GAME_EVENT_KIND.uiClick });
    expect(backend.labelsPlayed()).toEqual([`${SOUND_EVENT.uiClick}.mp3`]);
  });

  it('leaving the room silences the wire', async () => {
    await handle.ready;
    handle.observe(createTestSnapshot({ cells: [createTestCellView()] }));
    handle.disconnect();
    events.emit({ kind: GAME_EVENT_KIND.uiClick });
    expect(backend.playing).toEqual([]);
    expect(backend.labelsPlayed()).toEqual([`${SOUND_EVENT.ambientBed}-${CELL_STAGE.protocell}.mp3`]);
  });
});
