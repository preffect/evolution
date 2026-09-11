// Test double (docs/TESTING.md §4): an `AudioBackend` that records every bus, decode and play and
// lets a test end a voice by hand. Nothing here makes a sound.

import type {
  AudioBackend,
  AudioGainHandle,
  AudioVoice,
  DecodedAudio,
  PlayOptions,
} from '../app/game/audio/audio-backend';

export interface FakeSound extends DecodedAudio {
  /** The file's bytes as text, so a test can tell sounds apart. */
  label: string;
}

export class FakeGain implements AudioGainHandle {
  gain: number;
  readonly ramps: { value: number; seconds: number }[] = [];

  constructor(
    initialGain: number,
    readonly parent: FakeGain | null,
  ) {
    this.gain = initialGain;
  }

  setGain(value: number): void {
    this.gain = value;
  }

  rampGain(value: number, seconds: number): void {
    this.ramps.push({ value, seconds });
    this.gain = value;
  }
}

export class FakeVoice extends FakeGain implements AudioVoice {
  playbackRate: number;
  isStopped = false;
  stopAfterSeconds: number | null = null;
  private endedCallbacks: (() => void)[] = [];

  constructor(
    readonly sound: FakeSound,
    readonly options: PlayOptions,
  ) {
    super(options.gain, options.destination as FakeGain);
    this.playbackRate = options.playbackRate;
  }

  get label(): string {
    return this.sound.label;
  }

  get startAfterSeconds(): number {
    return this.options.startAfterSeconds;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }

  stop(afterSeconds = 0): void {
    this.isStopped = true;
    this.stopAfterSeconds = afterSeconds;
    this.end();
  }

  onEnded(callback: () => void): void {
    this.endedCallbacks.push(callback);
  }

  /** The sound reached its end (or was stopped): fires the ended callbacks once. */
  end(): void {
    const callbacks = this.endedCallbacks;
    this.endedCallbacks = [];
    for (const callback of callbacks) callback();
  }
}

export class FakeAudioBackend implements AudioBackend {
  isAvailable = true;
  readonly buses: FakeGain[] = [];
  readonly voices: FakeVoice[] = [];
  readonly decodedLabels: string[] = [];
  /** Labels the backend refuses to decode (an unreadable file). */
  readonly undecodable = new Set<string>();
  unlockCount = 0;
  /** Set to make every call throw: the service must survive it. */
  shouldThrow = false;

  createBus(parent: AudioGainHandle | null, initialGain: number): AudioGainHandle {
    this.throwIfAsked();
    const bus = new FakeGain(initialGain, parent as FakeGain | null);
    this.buses.push(bus);
    return bus;
  }

  decode(bytes: ArrayBuffer): Promise<DecodedAudio | null> {
    const label = new TextDecoder().decode(bytes);
    this.decodedLabels.push(label);
    if (this.undecodable.has(label)) return Promise.resolve(null);
    return Promise.resolve({ label, durationSeconds: 1 } satisfies FakeSound);
  }

  play(sound: DecodedAudio, options: PlayOptions): AudioVoice {
    this.throwIfAsked();
    const voice = new FakeVoice(sound as FakeSound, options);
    this.voices.push(voice);
    return voice;
  }

  unlock(): void {
    this.throwIfAsked();
    this.unlockCount += 1;
  }

  /** The voices still sounding. */
  get playing(): FakeVoice[] {
    return this.voices.filter((voice) => !voice.isStopped);
  }

  labelsPlayed(): string[] {
    return this.voices.map((voice) => voice.label);
  }

  private throwIfAsked(): void {
    if (this.shouldThrow) throw new Error('fake audio platform failure');
  }
}

/** A loader whose "files" are the manifest object and a set of file names that exist; bytes are the file name. */
export class FakeAudioAssetLoader {
  readonly requestedUrls: string[] = [];

  constructor(
    private manifestJson: unknown,
    private readonly existingFiles: Set<string>,
  ) {}

  setManifest(manifestJson: unknown): void {
    this.manifestJson = manifestJson;
  }

  fetchJson(url: string): Promise<unknown> {
    this.requestedUrls.push(url);
    return Promise.resolve(this.manifestJson);
  }

  fetchBytes(url: string): Promise<ArrayBuffer | null> {
    this.requestedUrls.push(url);
    const path = url.slice(url.lastIndexOf('/') + 1);
    if (!this.existingFiles.has(path)) return Promise.resolve(null);
    return Promise.resolve(new TextEncoder().encode(path).buffer as ArrayBuffer);
  }
}

export class MemoryMutePreference {
  constructor(public isMuted = false) {}

  read(): boolean {
    return this.isMuted;
  }

  write(isMuted: boolean): void {
    this.isMuted = isMuted;
  }
}
