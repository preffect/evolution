import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebAudioBackend } from './web-audio-backend';
import type { DecodedAudio } from './audio-backend';
import { FakeAudioContext, FakeBufferSourceNode, FakeGainNode } from '../../../testing/fake-audio-context';

const SOME_BYTES = new Uint8Array([1, 2, 3]).buffer;
const NO_BYTES = new ArrayBuffer(0);

describe('WebAudioBackend', () => {
  beforeEach(() => {
    FakeAudioContext.reset();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates one context lazily and wires buses to the destination or their parent', () => {
    const backend = new WebAudioBackend();
    expect(backend.isAvailable).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(0);
    const master = backend.createBus(null, 0.5);
    const child = backend.createBus(master, 1);
    expect(FakeAudioContext.instances).toHaveLength(1);
    const context = FakeAudioContext.instances[0]!;
    expect(context.gains[0]!.gain.value).toBe(0.5);
    expect(context.gains[0]!.connections).toEqual([context.destination]);
    expect(context.gains[1]!.connections).toEqual([context.gains[0]]);
    expect(child).toBeDefined();
  });

  it('sets and ramps a gain on the audio clock', () => {
    const backend = new WebAudioBackend();
    const bus = backend.createBus(null, 1);
    const context = FakeAudioContext.instances[0]!;
    context.currentTime = 2;
    bus.setGain(0.25);
    bus.rampGain(0, 4);
    const parameter = context.gains[0]!.gain;
    expect(parameter.scheduled.map((entry) => entry.method)).toEqual(['cancel', 'set', 'cancel', 'set', 'ramp']);
    expect(parameter.scheduled.at(-1)).toEqual({ method: 'ramp', value: 0, time: 6 });
  });

  it('decodes bytes and answers null for an undecodable file', async () => {
    const backend = new WebAudioBackend();
    expect((await backend.decode(SOME_BYTES))?.durationSeconds).toBe(1);
    expect(await backend.decode(NO_BYTES)).toBeNull();
  });

  it('plays a decoded buffer as a looping voice into a bus and reports its end', async () => {
    const backend = new WebAudioBackend();
    const bus = backend.createBus(null, 1);
    const sound = (await backend.decode(SOME_BYTES))!;
    const voice = backend.play(sound, {
      destination: bus,
      isLoop: true,
      gain: 0.5,
      playbackRate: 1.5,
      startAfterSeconds: 0,
    });
    const context = FakeAudioContext.instances[0]!;
    const source = context.sources[0] as FakeBufferSourceNode;
    const voiceGain = context.gains[1] as FakeGainNode;
    expect(source.loop).toBe(true);
    expect(source.playbackRate.value).toBe(1.5);
    expect(source.startCount).toBe(1);
    expect(source.startAt).toBe(0);
    expect(voiceGain.gain.value).toBe(0.5);
    expect(voiceGain.connections).toEqual([context.gains[0]]);
    voice.setPlaybackRate(2);
    expect(source.playbackRate.value).toBe(2);
    const ended = vi.fn();
    voice.onEnded(ended);
    context.currentTime = 1;
    voice.stop(3);
    expect(source.stopAt).toBe(4);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(source.disconnectCount).toBe(1);
    voice.onEnded(ended);
    expect(ended).toHaveBeenCalledTimes(2);
  });

  it('calls every ended subscriber once: the scheduler release and the duck release share a voice', async () => {
    const backend = new WebAudioBackend();
    const bus = backend.createBus(null, 1);
    const sound = (await backend.decode(SOME_BYTES))!;
    const voice = backend.play(sound, {
      destination: bus,
      isLoop: false,
      gain: 1,
      playbackRate: 1,
      startAfterSeconds: 0,
    });
    const schedulerRelease = vi.fn();
    const duckRelease = vi.fn();
    voice.onEnded(schedulerRelease);
    voice.onEnded(duckRelease);
    const source = FakeAudioContext.instances[0]!.sources[0] as FakeBufferSourceNode;
    source.onended?.();
    expect(schedulerRelease).toHaveBeenCalledTimes(1);
    expect(duckRelease).toHaveBeenCalledTimes(1);
    voice.stop();
    expect(schedulerRelease).toHaveBeenCalledTimes(1);
  });

  it('falls back to a silent voice for a foreign sound or destination', async () => {
    const backend = new WebAudioBackend();
    const bus = backend.createBus(null, 1);
    const foreign: DecodedAudio = { durationSeconds: 1 };
    const sound = (await backend.decode(SOME_BYTES))!;
    backend.play(foreign, { destination: bus, isLoop: false, gain: 1, playbackRate: 1, startAfterSeconds: 0 });
    backend.play(sound, {
      destination: { setGain: () => undefined, rampGain: () => undefined },
      isLoop: false,
      gain: 1,
      playbackRate: 1,
      startAfterSeconds: 0,
    });
    expect(FakeAudioContext.instances[0]!.sources).toHaveLength(0);
  });

  it('schedules a deferred start on the audio clock', async () => {
    const backend = new WebAudioBackend();
    const bus = backend.createBus(null, 1);
    const sound = (await backend.decode(SOME_BYTES))!;
    const context = FakeAudioContext.instances[0]!;
    context.currentTime = 2;
    backend.play(sound, { destination: bus, isLoop: true, gain: 1, playbackRate: 1, startAfterSeconds: 1.5 });
    expect(context.sources[0]!.startAt).toBe(3.5);
  });

  it('resumes a suspended context on unlock, once running does nothing', () => {
    const backend = new WebAudioBackend();
    backend.unlock();
    const context = FakeAudioContext.instances[0]!;
    expect(context.resumeCount).toBe(1);
    backend.unlock();
    expect(context.resumeCount).toBe(1);
  });

  it('is inert without an AudioContext or when the platform refuses one', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const absent = new WebAudioBackend();
    expect(absent.isAvailable).toBe(false);
    expect(await absent.decode(SOME_BYTES)).toBeNull();
    expect(() => absent.unlock()).not.toThrow();
    absent.createBus(null, 1);

    vi.stubGlobal('AudioContext', FakeAudioContext);
    FakeAudioContext.shouldRefuseConstruction = true;
    const refused = new WebAudioBackend();
    expect(() => refused.createBus(null, 1)).not.toThrow();
    expect(await refused.decode(SOME_BYTES)).toBeNull();
  });
});
