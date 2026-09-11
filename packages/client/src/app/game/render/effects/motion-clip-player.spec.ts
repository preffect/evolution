import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, MOTION_CLIPS } from '@evolution/shared';
import { MotionClipPlayer, clipProgress, isClipFinished, sampleClip } from './motion-clip-player';

describe('sampleClip', () => {
  it('samples every track of a clip at a position, through the named easings', () => {
    const atPulse = sampleClip(MOTION_CLIPS.eat, 160);
    expect(atPulse['pulse']).toBeCloseTo(1.09, 9);
    expect(atPulse['dimple']).toBeCloseTo(-0.12, 9);
    expect(Object.keys(atPulse).sort()).toEqual(Object.keys(MOTION_CLIPS.eat.tracks).sort());
  });

  it('samples the engulf clip by progress: the wrap frame at 0.5', () => {
    expect(sampleClip(MOTION_CLIPS.engulf, 0.5)).toEqual({ arm: 0.62, notch: -0.1, seal: 0 });
    expect(sampleClip(MOTION_CLIPS.engulf, 1)).toEqual({ arm: 0, notch: 0, seal: 0.6 });
  });
});

describe('MotionClipPlayer', () => {
  it('plays a millisecond clip, samples it over time and drops it when finished', () => {
    const player = new MotionClipPlayer();
    expect(player.play(MOTION_CLIPS.eat, 1000)).toBe(true);
    expect(player.isPlaying(MOTION_CLIP.eat, 1100)).toBe(true);
    expect(player.sample(1160)['pulse']).toBeCloseTo(1.09, 9);
    expect(player.progressOf(MOTION_CLIP.eat, 1150)).toBeCloseTo(0.5, 9);
    expect(player.sample(1300)).toEqual({});
    expect(player.isPlaying(MOTION_CLIP.eat, 1300)).toBe(false);
    expect(player.progressOf(MOTION_CLIP.eat, 1300)).toBeNull();
    expect(player.activeCount).toBe(0);
  });

  it('restarts an interruptible clip and refuses to interrupt a non-interruptible one', () => {
    const player = new MotionClipPlayer();
    player.play(MOTION_CLIPS.eat, 0);
    expect(player.play(MOTION_CLIPS.eat, 100)).toBe(true);
    expect(player.activeCount).toBe(1);
    expect(player.progressOf(MOTION_CLIP.eat, 100)).toBe(0);
    player.play(MOTION_CLIPS.level_up, 0);
    expect(player.play(MOTION_CLIPS.level_up, 100)).toBe(false);
    expect(player.play(MOTION_CLIPS.level_up, 900)).toBe(true);
  });

  it('refuses a progress-domain clip and lets the newest clip win a shared track', () => {
    const player = new MotionClipPlayer();
    expect(player.play(MOTION_CLIPS.engulf, 0)).toBe(false);
    player.play(MOTION_CLIPS.respawn, 0);
    player.play(MOTION_CLIPS.level_up, 0);
    expect(player.sample(120)['pulse']).toBeCloseTo(0.9, 9);
    player.clear();
    expect(player.activeCount).toBe(0);
  });

  it('exposes the raw progress helpers', () => {
    const instance = { clip: MOTION_CLIPS.respawn, startMs: 100 };
    expect(clipProgress(instance, 300)).toBe(0.5);
    expect(isClipFinished(instance, 499)).toBe(false);
    expect(isClipFinished(instance, 500)).toBe(true);
  });
});
