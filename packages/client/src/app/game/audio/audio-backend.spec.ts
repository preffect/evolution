import { describe, expect, it, vi } from 'vitest';
import { SilentAudioBackend } from './audio-backend';

describe('SilentAudioBackend', () => {
  it('accepts every call and produces nothing', async () => {
    const backend = new SilentAudioBackend();
    expect(backend.isAvailable).toBe(false);
    const bus = backend.createBus();
    expect(() => {
      bus.setGain(1);
      bus.rampGain(0, 1);
    }).not.toThrow();
    expect(await backend.decode()).toBeNull();
    const voice = backend.play();
    const ended = vi.fn();
    voice.onEnded(ended);
    voice.setPlaybackRate(2);
    voice.stop();
    expect(ended).not.toHaveBeenCalled();
    expect(() => backend.unlock()).not.toThrow();
  });
});
