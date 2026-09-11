// The thin seam over Web Audio (docs/ARCHITECTURE.md §7). Everything above it (buses, cache,
// scheduler, mixer, service) talks to these three handles, so the unit tests run on a fake and
// the production backend is the only file that knows `AudioContext`. When the platform has no
// `AudioContext` (a test runner, an old browser) the backend answers with inert handles: silence,
// never an exception.

/** A gain stage: a bus, or one playing voice. */
export interface AudioGainHandle {
  setGain(value: number): void;
  /** Linear ramp from the current value, reaching `value` after `seconds`. */
  rampGain(value: number, seconds: number): void;
}

/** One playing sound. */
export interface AudioVoice extends AudioGainHandle {
  setPlaybackRate(rate: number): void;
  /** Stops now, or after `afterSeconds` (a crossfade's tail) without a JS timer. */
  stop(afterSeconds?: number): void;
  /** Every subscriber is called once when the sound ends by itself or through `stop` (at once if it already has). */
  onEnded(callback: () => void): void;
}

/** A decoded, playable sound; opaque above the backend. */
export interface DecodedAudio {
  durationSeconds: number;
}

/** `startAfterSeconds` for a sound that starts now. */
export const START_NOW_SECONDS = 0;

export interface PlayOptions {
  destination: AudioGainHandle;
  isLoop: boolean;
  gain: number;
  playbackRate: number;
  /** Delay before the sound starts, on the audio clock (a loop waiting out its cooldown), never a JS timer. */
  startAfterSeconds: number;
}

export interface AudioBackend {
  /** True when sound can actually come out; false backends still honour every call. */
  readonly isAvailable: boolean;
  /** A bus under `parent`, or under the speakers when `parent` is null. */
  createBus(parent: AudioGainHandle | null, initialGain: number): AudioGainHandle;
  /** `null` when the bytes are not decodable. */
  decode(bytes: ArrayBuffer): Promise<DecodedAudio | null>;
  play(sound: DecodedAudio, options: PlayOptions): AudioVoice;
  /** Browsers start contexts suspended until a user gesture; call from the first pointer event. */
  unlock(): void;
}

const INERT_GAIN: AudioGainHandle = { setGain: () => undefined, rampGain: () => undefined };
const INERT_VOICE: AudioVoice = {
  ...INERT_GAIN,
  setPlaybackRate: () => undefined,
  stop: () => undefined,
  onEnded: () => undefined,
};

/** What a test or a platform without sound gets: every call accepted, nothing heard. */
export class SilentAudioBackend implements AudioBackend {
  readonly isAvailable = false;

  createBus(): AudioGainHandle {
    return INERT_GAIN;
  }

  decode(): Promise<DecodedAudio | null> {
    return Promise.resolve(null);
  }

  play(): AudioVoice {
    return INERT_VOICE;
  }

  unlock(): void {
    // Nothing to resume.
  }
}
