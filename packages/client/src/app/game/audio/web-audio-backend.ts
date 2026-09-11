// The production `AudioBackend` over the browser's `AudioContext`. The context is created lazily
// on the first bus and resumed by `unlock()` from a user gesture. Any platform error degrades to
// the inert path: the game never stops for audio (docs/ARCHITECTURE.md §7).

import type { AudioBackend, AudioGainHandle, AudioVoice, DecodedAudio, PlayOptions } from './audio-backend';
import { SilentAudioBackend } from './audio-backend';

interface DecodedBuffer extends DecodedAudio {
  buffer: AudioBuffer;
}

class GainNodeHandle implements AudioGainHandle {
  constructor(
    readonly node: GainNode,
    private readonly context: BaseAudioContext,
  ) {}

  setGain(value: number): void {
    this.node.gain.cancelScheduledValues(this.context.currentTime);
    this.node.gain.setValueAtTime(value, this.context.currentTime);
  }

  rampGain(value: number, seconds: number): void {
    const now = this.context.currentTime;
    this.node.gain.cancelScheduledValues(now);
    this.node.gain.setValueAtTime(this.node.gain.value, now);
    this.node.gain.linearRampToValueAtTime(value, now + seconds);
  }
}

class BufferVoice extends GainNodeHandle implements AudioVoice {
  private endedCallback: (() => void) | null = null;
  private hasEnded = false;

  constructor(
    private readonly source: AudioBufferSourceNode,
    node: GainNode,
    context: BaseAudioContext,
  ) {
    super(node, context);
    source.onended = () => this.finish();
  }

  setPlaybackRate(rate: number): void {
    this.source.playbackRate.value = rate;
  }

  stop(afterSeconds = 0): void {
    this.source.stop(this.source.context.currentTime + afterSeconds);
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback;
    if (this.hasEnded) callback();
  }

  private finish(): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.source.disconnect();
    this.node.disconnect();
    this.endedCallback?.();
  }
}

/** The one `AudioContext` of the page; `SilentAudioBackend` stands in where the platform has none. */
export class WebAudioBackend implements AudioBackend {
  private context: AudioContext | null = null;
  private readonly fallback = new SilentAudioBackend();

  get isAvailable(): boolean {
    return typeof AudioContext !== 'undefined';
  }

  createBus(parent: AudioGainHandle | null, initialGain: number): AudioGainHandle {
    const context = this.contextOrNull();
    if (!context) return this.fallback.createBus();
    const node = context.createGain();
    node.gain.value = initialGain;
    node.connect(parent instanceof GainNodeHandle ? parent.node : context.destination);
    return new GainNodeHandle(node, context);
  }

  async decode(bytes: ArrayBuffer): Promise<DecodedAudio | null> {
    const context = this.contextOrNull();
    if (!context) return null;
    try {
      const buffer = await context.decodeAudioData(bytes);
      const decoded: DecodedBuffer = { buffer, durationSeconds: buffer.duration };
      return decoded;
    } catch {
      // An undecodable file is a missing asset (docs/ARCHITECTURE.md §7): the cue stays silent.
      return null;
    }
  }

  play(sound: DecodedAudio, options: PlayOptions): AudioVoice {
    const context = this.contextOrNull();
    if (!context || !isDecodedBuffer(sound) || !(options.destination instanceof GainNodeHandle)) {
      return this.fallback.play();
    }
    const source = context.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = options.isLoop;
    source.playbackRate.value = options.playbackRate;
    const gainNode = context.createGain();
    gainNode.gain.value = options.gain;
    source.connect(gainNode);
    gainNode.connect(options.destination.node);
    source.start(context.currentTime + options.startAfterSeconds);
    return new BufferVoice(source, gainNode, context);
  }

  unlock(): void {
    const context = this.contextOrNull();
    if (context && context.state === 'suspended') {
      // The promise rejects only when the page is not allowed to play yet; the next gesture retries.
      void context.resume().catch(() => undefined);
    }
  }

  private contextOrNull(): AudioContext | null {
    if (this.context) return this.context;
    if (!this.isAvailable) return null;
    try {
      this.context = new AudioContext();
    } catch {
      // A platform that refuses a context (no output device, a hardened sandbox) plays silence.
      return null;
    }
    return this.context;
  }
}

function isDecodedBuffer(sound: DecodedAudio): sound is DecodedBuffer {
  return 'buffer' in sound;
}
