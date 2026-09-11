// The living broth (#140 option B, docs/AUDIO.md §3): one ambient stem per ladder stage,
// crossfaded on the stage change; a zone overlay crossfaded on the zone change; both on an
// ambient sub-bus under `music` that ducks while any reason (the danger drone, an essential cue)
// holds it, so the drone and the motif themselves are never ducked. Crossfade tails are
// scheduled on the audio clock (`voice.stop(afterSeconds)`), never on a JS timer.

import {
  AMBIENT_CROSSFADE_SECONDS,
  BLOOM_STEM_INDEX,
  DUCK_DECIBELS,
  DUCK_RAMP_SECONDS,
  SOUND_EVENT,
  ZONE_CROSSFADE_SECONDS,
  ambientStemForStage,
  decibelsToGain,
  nearestAvailableStem,
  resolveAudioFile,
  resolveAudioFileAt,
  type AudioManifest,
  type CellStage,
  type ValueOf,
  type ZoneId,
} from '@evolution/shared';
import { START_NOW_SECONDS, type AudioBackend, type AudioGainHandle, type AudioVoice } from './audio-backend';
import type { AudioAssetCache } from './audio-asset-cache';

const SILENT = 0;
const FULL = 1;
const UNITY_RATE = 1;

interface Layer {
  key: string;
  voice: AudioVoice;
}

/** Why the music is ducked; the duck lifts when the last reason is released. */
export const DUCK_REASON = { danger: 'danger', essentialCue: 'essential_cue' } as const;
export type DuckReason = ValueOf<typeof DUCK_REASON>;

export class AmbientMixer {
  private manifest: AudioManifest | null = null;
  private stem: Layer | null = null;
  private zone: Layer | null = null;
  /** What the game last asked for; applied as soon as the manifest and its files allow (`refresh`). */
  private wantedStage: CellStage | null = null;
  private wantedZone: ZoneId | null = null;
  private isBloom = false;
  private readonly duckReasons = new Set<DuckReason>();
  private readonly ambientBus: AudioGainHandle;

  constructor(
    private readonly backend: AudioBackend,
    private readonly assets: AudioAssetCache,
    musicBus: AudioGainHandle,
  ) {
    this.ambientBus = backend.createBus(musicBus, FULL);
  }

  setManifest(manifest: AudioManifest | null): void {
    this.manifest = manifest;
  }

  /** The stem playing now, by manifest key (a stage id); `null` while silent. */
  get currentStemKey(): string | null {
    return this.stem?.key ?? null;
  }

  get currentZoneKey(): string | null {
    return this.zone?.key ?? null;
  }

  get isDucked(): boolean {
    return this.duckReasons.size > 0;
  }

  /** Crossfades to the stage's stem, or the nearest one that shipped (docs/AUDIO.md §3). */
  setStage(stage: CellStage): void {
    this.wantedStage = stage;
    this.applyStage();
  }

  /** From the bloom the bed is the full mix whatever the stage (#140 B); released by `stop` or the caller. */
  setBloom(isBloom: boolean): void {
    this.isBloom = isBloom;
    this.applyStage();
  }

  /** The overlay of a zone; a zone without one (the open broth) fades the overlay out. */
  setZone(zone: ZoneId): void {
    this.wantedZone = zone;
    this.applyZone();
  }

  /** After the manifest and its files landed: the stage and zone asked for meanwhile start now. */
  refresh(): void {
    this.applyStage();
    this.applyZone();
  }

  private applyStage(): void {
    if (!this.manifest || this.wantedStage === null) return;
    const manifest = this.manifest;
    const wanted = this.isBloom ? BLOOM_STEM_INDEX : ambientStemForStage(this.wantedStage);
    const isShipped = (stem: number) => {
      const file = resolveAudioFileAt(manifest, SOUND_EVENT.ambientBed, stem);
      return file !== null && this.assets.peek(file.path) !== null;
    };
    const available = nearestAvailableStem(wanted, isShipped);
    const file = available === null ? null : resolveAudioFileAt(manifest, SOUND_EVENT.ambientBed, available);
    this.stem = this.crossfade(this.stem, file?.key ?? null, file?.path ?? null, AMBIENT_CROSSFADE_SECONDS);
  }

  private applyZone(): void {
    if (!this.manifest || this.wantedZone === null) return;
    const file = resolveAudioFile(this.manifest, SOUND_EVENT.zoneLayer, this.wantedZone);
    this.zone = this.crossfade(this.zone, file?.key ?? null, file?.path ?? null, ZONE_CROSSFADE_SECONDS);
  }

  duck(reason: DuckReason): void {
    this.duckReasons.add(reason);
    this.applyDuck();
  }

  release(reason: DuckReason): void {
    this.duckReasons.delete(reason);
    this.applyDuck();
  }

  /** Fades both layers out and forgets what was wanted; the next `setStage` starts them again. */
  stop(): void {
    this.wantedStage = null;
    this.wantedZone = null;
    this.isBloom = false;
    this.stem = this.crossfade(this.stem, null, null, AMBIENT_CROSSFADE_SECONDS);
    this.zone = this.crossfade(this.zone, null, null, ZONE_CROSSFADE_SECONDS);
  }

  private applyDuck(): void {
    this.ambientBus.rampGain(this.isDucked ? decibelsToGain(DUCK_DECIBELS) : FULL, DUCK_RAMP_SECONDS);
  }

  private crossfade(current: Layer | null, key: string | null, path: string | null, seconds: number): Layer | null {
    if (current?.key === key) return current;
    if (current) {
      current.voice.rampGain(SILENT, seconds);
      current.voice.stop(seconds);
    }
    const sound = path === null ? null : this.assets.peek(path);
    if (key === null || !sound) return null;
    const voice = this.backend.play(sound, {
      destination: this.ambientBus,
      isLoop: true,
      gain: current ? SILENT : FULL,
      playbackRate: UNITY_RATE,
      startAfterSeconds: START_NOW_SECONDS,
    });
    if (current) voice.rampGain(FULL, seconds);
    return { key, voice };
  }
}
