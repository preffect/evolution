# Evolution — Audio

The sound design of build 1 and the hooks that play it (#101, #35). The direction is decision
[#140](https://github.com/preffect/evolution/issues/140): **option B, "living broth"**, with option C's
danger readability as the secondary goal. This document does not restate the options; #140 holds the
storyboards, the alternatives and the trade-offs. What follows is the shipped contract: the event
catalogue, the layering rules, the asset manifest and the client seam.

Homes: ids in `packages/shared/src/types/audio.ts` (`SOUND_EVENT`, `AUDIO_BUS`), numbers in
`packages/shared/src/constants/audio.ts` (`SOUND_EVENT_CATALOG` and the layering constants), lookups
in `packages/shared/src/audio/sound-events.ts`, the manifest shape in
`packages/shared/src/audio/audio-manifest.ts`, the data in `assets/audio/manifest.json`, the client in
`packages/client/src/app/game/audio/` (ARCHITECTURE §7).

## 1. The sound in one paragraph

A constant in-key pad (D minor, no beat) that gains one instrument per ladder stage, crossfaded on the
stage change; tonal cues in the same key for eat, DNA, level-up, trait pick, engulf and death; wet foley
under the eat and engulf cues; a zone overlay per zone; a low pulsing drone with the pad ducked -8 dB
while a threat ring shows; the full mix from the bloom; a 20 s cadence at results. Adjectives: warm,
submerged, tonal, growing, dreamy.

## 2. Event catalogue

`SOUND_EVENT_CATALOG` (`constants/audio.ts`) is the source of truth; `sound-events.test.ts` pins that
every `SOUND_EVENT` id has a row and that every value is in range. This table is the readable copy.

| Event                      | Raised by (trigger)                                                             | Priority | Cooldown ms | Loop    | Bus   |
| -------------------------- | ------------------------------------------------------------------------------- | -------- | ----------- | ------- | ----- |
| `ambient_bed`              | state layer: first snapshot, own stage change (one stem per stage)              | 3        | 0           | yes     | music |
| `zone_layer`               | renderer (#99): own cell changes zone                                           | 1        | 2000        | yes     | music |
| `eat`                      | state layer: `eat` effect on the own cell, a mote (5 notes round-robin)         | 0        | 150         | no      | sfx   |
| `dna_absorb`               | state layer: `eat` effect on the own cell, a fragment                           | 1        | 300         | no      | sfx   |
| `level_up`                 | state layer: `level_up` effect on the own cell (motif on the newest instrument) | 3        | 0           | no      | music |
| `trait_pick`               | HUD (#100): a card chosen                                                       | 2        | 0           | no      | sfx   |
| `danger_warning`           | state layer: a cell that `canEngulf` the own cell appears / disappears          | 2        | 1000        | yes     | music |
| `engulf_progress`          | state layer: the own cell is engulfing (rate follows the prey's progress)       | 2        | 0           | yes     | sfx   |
| `engulf_complete`          | state layer: `cell_absorbed` effect whose predator is the own cell              | 3        | 0           | no      | sfx   |
| `engulfed`                 | state layer: `cell_absorbed` effect on the own cell (bed drops to stem 0)       | 3        | 0           | no      | sfx   |
| `respawn`                  | state layer: `respawn` effect on the own cell (stem returns)                    | 2        | 0           | no      | sfx   |
| `bloom_start`              | state layer: `roundTimeLeftMs` crosses `ROUND_BLOOM_START_FRACTION`             | 2        | 0           | no      | sfx   |
| `round_end`                | state layer: `roundPhase` becomes `results` (everything else stops)             | 3        | 0           | no      | music |
| `ui_click`                 | HUD (#100): any interaction                                                     | 0        | 60          | no      | sfx   |
| trait cues (16, TRAITS §3) | renderer (#99): the trait's moment; `isActive: false` ends a looping cue        | 1        | 300         | per cue | sfx   |

Legend. **Priority** is #140's scale: 3 never dropped and ducks the pad; 2 dropped only for a 3; 1
dropped when more than `MAX_OVERLAPPING_CUES` (4) one-shots overlap; 0 first to go. **Cooldown** is the
minimum gap between two starts of the same event in milliseconds (0 = none): a one-shot inside it is
dropped, a loop inside it is deferred to the end of the gap on the audio clock (never a JS timer).
**Loop** keeps playing until its end condition (the state leaves, the renderer ends the cue, results).
**Bus** is the gain stage the cue plays through (§5). The trait cues are the `audioCue` of each catalog
row; the ones that read "while" (`low_thrum`, `soft_flutter`, `toxin_hiss`, `rapid_flutter`, `low_hum`,
`shell_scrape`, `hiss_drone`) loop, the rest are one-shots.

## 3. Layering rules (the data the mixer follows)

- **Stems by stage.** `AMBIENT_STEM_BY_STAGE` maps each `CellStage` to a stem index in `STAGE_ORDER`
  order (protocell 0 … specialised 4); `ambientStemForStage` is monotone along the ladder, pinned by
  test. The stem crossfades over `AMBIENT_CROSSFADE_SECONDS` (4) on the stage change.
- **Degradation order (#140).** Stems ship 1, 3 and 5 first; `nearestAvailableStem` plays the nearest
  shipped stem, preferring the lower one on a tie so the bed never sounds richer than the stage. No
  stem at all is silence.
- **Motif by organelle.** The level-up motif plays on the instrument `motifInstrumentFor(organelleCount)`
  (one per owned trait, capped at `MOTIF_INSTRUMENT_COUNT − 1`); the manifest keys the files
  `instrument-0` … `instrument-4`.
- **Zones.** `zone_layer` has one overlay per zone except `open_broth`, which is the bed alone; the
  overlay crossfades over `ZONE_CROSSFADE_SECONDS` (2).
- **Duck.** The ambient sub-bus (stem + overlay) ramps to `DUCK_DECIBELS` (−8 dB) over
  `DUCK_RAMP_SECONDS` (0.5) while any reason holds it: the danger drone, or a priority-3 one-shot
  until it ends. The drone and the motif are not ducked.
- **Engulf pitch.** The `engulf_progress` loop's playback rate rises linearly from 1 to
  `ENGULF_PROGRESS_MAX_PLAYBACK_RATE` (1.5) with the prey's progress.
- **Death and respawn.** `engulfed` drops the bed to stem 0 for the spectate; `respawn` returns the
  stage's stem. Results stop every loop and the bed, then play the cadence.
- **Fatigue.** Eats fall to silence past four overlapping one-shots (the overlap cap) and never sound
  twice inside 150 ms.

## 4. The manifest (`assets/audio/manifest.json`)

The one home of "which file plays for which event", validated by
`packages/shared/src/audio/audio-manifest.test.ts` against the catalogue (every id present, loop flags
equal, unique paths, the stem keys equal `STAGE_ORDER`, the instrument keys and the zone keys as above).
`parseAudioManifest` is the one validator; the client loader treats a manifest that fails it as no
manifest (silence).

```ts
interface AudioManifest {
  version: number; // AUDIO_MANIFEST_VERSION; bumped when this shape changes
  events: Record<
    SoundEventId,
    {
      mood: string; // two to five adjectives from #140's palette
      lengthSeconds: number;
      isLoop: boolean; // equals the catalogue rule
      promptHint: string; // the Lyria / curated-SFX prompt sketch of #140, per AUDIO-PIPELINE §5
      files: { key: string; path: string }[]; // ordered; key names the variant, path is relative to assets/audio/
    }
  >;
}
```

Variant keys: a stage id for the stems, a zone id for the overlays, `instrument-N` for the motif,
`note-N` for round-robin notes, `default` otherwise. A play without a key takes the files in turn
(round-robin); a play with a key that the entry lacks is silent.

Files live next to the manifest and are **gitignored** (`assets/audio/*.mp3|ogg|wav`, AUDIO-PIPELINE
§3); the manifest is committed. The client serves the directory at `/assets/audio/` through the symlink
`packages/client/src/assets/audio` (`angular.json` follows symlinks), so a file dropped into
`assets/audio/` plays on the next reload with no code change. Generating the files is the pipeline of
[`AUDIO-PIPELINE.md`](./AUDIO-PIPELINE.md): `sync` spends money and never runs unsolicited; the
`tools/` scaffold and the generation run are their own ticket, and its track and sound lists are derived
from this manifest, never a second copy.

## 5. The client (ARCHITECTURE §6, §7)

```text
 game-setup.ts (#99) ─► AudioHooks.connect(options) ─► handle.observe(snapshot) / unlock() / disconnect()
                                                  │
 snapshot ─► SnapshotTransitionTracker ─► GameEventBus ◄─ renderer (#99): zone_changed, trait_cue
                (state/snapshot-transitions.ts)   │       ◄─ HUD (#100): trait_picked, ui_click
                                                  ▼
                                            SoundEventBus (audio/sound-event-bus.ts)
                                                  │  play / startLoop / stopLoop / setAmbientStage / setZone / setDanger
                                                  ▼
                                            AudioService (audio/audio.service.ts)
                                   ┌──────────────┼──────────────┐
                              CueScheduler   AmbientMixer    AudioBuses  ── AudioAssetCache
                                   └──────────────┴──────────────┘
                                                  ▼
                                            AudioBackend (Web Audio; SilentAudioBackend without it)
```

- **Buses.** `master` → `music` and `sfx`; the mixer adds an ambient sub-bus under `music`. Defaults
  are `DEFAULT_BUS_GAIN`; the persisted mute is the master's gain, remembered in localStorage under
  `AUDIO_MUTE_STORAGE_KEY` (`constants/audio.ts`, CODE-STANDARDS §2). The HUD's mute toggle calls
  `AudioService.setMuted`; nothing else outside the sound bus calls the service.
- **Silent by design.** A missing manifest, a missing or undecodable file, an unknown variant, a platform
  without `AudioContext` or one that throws: every path is a no-op, and the service never throws into
  the game loop (the first platform error is reported once with `console.warn`).
- **Time.** Cooldowns read the injected `Clock` (`CLOCK`, `clock-provider.ts`); crossfade tails and
  deferred loop starts are scheduled on the audio clock (`voice.stop(afterSeconds)`,
  `startAfterSeconds`); there is no `setTimeout` in the audio layer.
- **Wiring.** `AudioHooks.connect(options)` (`audio/audio-hooks.ts`) is the composition root's one call:
  it builds the tracker and the `SoundEventBus` over the shared `GameEventBus` and starts `initialize()`
  (loads the manifest, preloads every file it names). `game-setup.ts` (#99) feeds the handle every
  rendered snapshot (`observe`), the live balance (`updateOptions` on `balance_updated`), the first
  pointer event (`unlock`: browsers keep audio suspended until a gesture) and the room's teardown
  (`disconnect`: stops every sound, leaves the bus, makes the handle inert). The `options` are the
  own `PlayerId`, the balance and the session's `roundDurationSeconds` (`TransitionOptions`).
- **Tests.** `FakeAudioBackend` (records buses, decodes, voices; can throw on demand), `FakeAudioContext`
  (the slice of Web Audio the production backend touches) and `createTestAudioManifest` live in
  `packages/client/src/testing/`. `audio-hooks.integration.spec.ts` proves the chain from `AudioHooks.connect` and
  a snapshot to a voice on the fake platform.

## 6. Extending

A new cue: add the id to `SOUND_EVENT`, its rule to `SOUND_EVENT_CATALOG`, its entry to the manifest
and the mapping in `SoundEventBus`; the tests fail on each missing piece. A new trait: its `audioCue`
must be a `SOUND_EVENT` id (the catalog row is typed), and it gets a manifest entry like the others.
