// The audio facade (docs/ARCHITECTURE.md §7, docs/AUDIO.md §5): resolves a sound event through
// the manifest and plays it through the buses under the catalogue's cooldown and priority. Silent
// when the manifest or a file is missing; never throws into the game loop. What the game asks for
// before the assets land (the first snapshot beats the load) is remembered and started then. Only
// `SoundEventBus` calls it; the HUD reaches the mute through it as well.

import { Injectable, inject } from '@angular/core';
import {
  MILLISECONDS_PER_SECOND,
  SOUND_EVENT,
  SOUND_PRIORITY,
  soundEventRule,
  resolveAudioFile,
  resolveAudioFileAt,
  type AudioBus,
  type AudioManifest,
  type CellStage,
  type SoundEventId,
  type ZoneId,
} from '@evolution/shared';
import { START_NOW_SECONDS, type AudioVoice } from './audio-backend';
import { AudioAssetCache } from './audio-asset-cache';
import { AudioBuses } from './audio-buses';
import { CueScheduler } from './cue-scheduler';
import { AmbientMixer, DUCK_REASON } from './ambient-mixer';
import { AUDIO_ASSET_LOADER, AUDIO_BACKEND, MUTE_PREFERENCE } from './audio-tokens';
import { CLOCK } from '../clock-provider';

const UNITY = 1;

/** How `startVoice` plays a resolved file. */
interface VoiceStart {
  bus: AudioBus;
  isLoop: boolean;
  variantKey: string | undefined;
  startAfterSeconds: number;
}

/** What the sound bus asks of the audio layer; the service is its one implementation. */
export interface SoundSink {
  /** A one-shot, or the start of a loop for a looping rule; `variantKey` picks a manifest file. */
  play(id: SoundEventId, variantKey?: string): void;
  startLoop(id: SoundEventId, variantKey?: string): void;
  stopLoop(id: SoundEventId): void;
  setLoopPlaybackRate(id: SoundEventId, rate: number): void;
  setAmbientStage(stage: CellStage): void;
  setZone(zone: ZoneId): void;
  stopAmbient(): void;
  setDanger(isDanger: boolean): void;
  stopAll(): void;
}

@Injectable({ providedIn: 'root' })
export class AudioService implements SoundSink {
  private readonly backend = inject(AUDIO_BACKEND);
  private readonly buses = new AudioBuses(this.backend, inject(MUTE_PREFERENCE));
  private readonly assets = new AudioAssetCache(inject(AUDIO_ASSET_LOADER), this.backend);
  private readonly scheduler = new CueScheduler(inject(CLOCK));
  private readonly ambient = new AmbientMixer(this.backend, this.assets, this.buses.music);
  private readonly loops = new Map<SoundEventId, AudioVoice>();
  /** Loops the game wants sounding, by variant; those without a decodable file yet start when it lands. */
  private readonly wantedLoops = new Map<SoundEventId, string | undefined>();
  private readonly roundRobin = new Map<SoundEventId, number>();
  private manifest: AudioManifest | null = null;
  private initialization: Promise<void> | null = null;
  private isDangerActive = false;
  private hasReportedFailure = false;

  /** Loads the manifest and every file it names; safe to call more than once. */
  initialize(): Promise<void> {
    this.initialization ??= this.loadEverything();
    return this.initialization;
  }

  get hasManifest(): boolean {
    return this.manifest !== null;
  }

  get isMuted(): boolean {
    return this.buses.isMuted;
  }

  setMuted(isMuted: boolean): void {
    this.buses.setMuted(isMuted);
  }

  setVolume(bus: AudioBus, volume: number): void {
    this.buses.setVolume(bus, volume);
  }

  /** From the first pointer event: browsers keep audio suspended until a gesture. */
  unlock(): void {
    this.guard(() => this.backend.unlock());
  }

  play(id: SoundEventId, variantKey?: string): void {
    if (soundEventRule(id).isLoop) {
      this.startLoop(id, variantKey);
      return;
    }
    this.guard(() => this.playOneShot(id, variantKey));
  }

  startLoop(id: SoundEventId, variantKey?: string): void {
    this.guard(() => {
      this.wantedLoops.set(id, variantKey);
      this.startLoopVoice(id, variantKey);
    });
  }

  stopLoop(id: SoundEventId): void {
    this.guard(() => {
      this.wantedLoops.delete(id);
      this.loops.get(id)?.stop();
      this.loops.delete(id);
    });
  }

  setLoopPlaybackRate(id: SoundEventId, rate: number): void {
    this.guard(() => this.loops.get(id)?.setPlaybackRate(rate));
  }

  setAmbientStage(stage: CellStage): void {
    this.guard(() => this.ambient.setStage(stage));
  }

  setZone(zone: ZoneId): void {
    this.guard(() => this.ambient.setZone(zone));
  }

  stopAmbient(): void {
    this.guard(() => this.ambient.stop());
  }

  /** The drone loops and the bed ducks while a threat ring shows (#140 option B). */
  setDanger(isDanger: boolean): void {
    if (isDanger === this.isDangerActive) return;
    this.isDangerActive = isDanger;
    if (isDanger) {
      this.startLoop(SOUND_EVENT.dangerWarning);
      this.guard(() => this.ambient.duck(DUCK_REASON.danger));
    } else {
      this.stopLoop(SOUND_EVENT.dangerWarning);
      this.guard(() => this.ambient.release(DUCK_REASON.danger));
    }
  }

  stopAll(): void {
    this.guard(() => {
      this.wantedLoops.clear();
      for (const voice of this.loops.values()) voice.stop();
      this.loops.clear();
      this.scheduler.stopAll();
      this.ambient.stop();
      this.ambient.release(DUCK_REASON.danger);
      this.isDangerActive = false;
    });
  }

  private async loadEverything(): Promise<void> {
    this.manifest = await this.assets.loadManifest();
    this.ambient.setManifest(this.manifest);
    if (this.manifest) await this.assets.preload(this.manifest);
    this.applyWantedState();
  }

  /** The assets landed: the stage, zone and loops asked for meanwhile start now. */
  private applyWantedState(): void {
    this.guard(() => {
      this.ambient.refresh();
      for (const [id, variantKey] of this.wantedLoops) this.startLoopVoice(id, variantKey);
    });
  }

  private startLoopVoice(id: SoundEventId, variantKey: string | undefined): void {
    if (this.loops.has(id)) return;
    const rule = soundEventRule(id);
    // A loop inside its cooldown is not dropped (#140: the cooldown is a minimum gap): it starts when the gap has passed.
    const delayMs = this.scheduler.remainingCooldownMs(id, rule);
    const startAfterSeconds = delayMs / MILLISECONDS_PER_SECOND;
    const voice = this.startVoice(id, { bus: rule.bus, isLoop: true, variantKey, startAfterSeconds });
    if (!voice) return;
    // The cooldown counts from a start that happened, so a loop waiting for its file is not delayed once it lands.
    this.scheduler.recordPlay(id, delayMs);
    this.loops.set(id, voice);
  }

  private playOneShot(id: SoundEventId, variantKey: string | undefined): void {
    const rule = soundEventRule(id);
    if (!this.scheduler.passesCooldown(id, rule)) return;
    const admission = this.scheduler.admit(rule);
    if (!admission.isAdmitted) return;
    for (const cue of admission.evicted) {
      cue.voice.stop();
      this.scheduler.release(cue);
    }
    const voice = this.startVoice(id, {
      bus: rule.bus,
      isLoop: false,
      variantKey,
      startAfterSeconds: START_NOW_SECONDS,
    });
    if (!voice) return;
    this.scheduler.track({ id, priority: rule.priority, voice });
    if (rule.priority === SOUND_PRIORITY.essential) {
      this.ambient.duck(DUCK_REASON.essentialCue);
      voice.onEnded(() => this.ambient.release(DUCK_REASON.essentialCue));
    }
  }

  /** The voice, or `null` when the manifest or the file is missing: the silent path. */
  private startVoice(id: SoundEventId, start: VoiceStart): AudioVoice | null {
    const path = this.resolvePath(id, start.variantKey);
    const sound = path === null ? null : this.assets.peek(path);
    if (!sound) return null;
    return this.backend.play(sound, {
      destination: this.buses.handleOf(start.bus),
      isLoop: start.isLoop,
      gain: UNITY,
      playbackRate: UNITY,
      startAfterSeconds: start.startAfterSeconds,
    });
  }

  /** The manifest's file path (relative to assets/audio/) for the event and variant, or `null`. */
  private resolvePath(id: SoundEventId, variantKey: string | undefined): string | null {
    if (!this.manifest) return null;
    if (variantKey !== undefined) return resolveAudioFile(this.manifest, id, variantKey)?.path ?? null;
    const index = this.roundRobin.get(id) ?? 0;
    this.roundRobin.set(id, index + 1);
    return resolveAudioFileAt(this.manifest, id, index)?.path ?? null;
  }

  /** Audio degrades silently by design (docs/ARCHITECTURE.md §7); the first failure is reported once. */
  private guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      if (this.hasReportedFailure) return;
      this.hasReportedFailure = true;
      console.warn('AudioService: sound disabled after a platform error', error);
    }
  }
}
