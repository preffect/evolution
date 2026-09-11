import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, MOTION_CLIPS } from '@evolution/shared';
import { ABSORBED_STREAMS, LEVEL_UP_RAYS, LEVEL_UP_RIPPLES } from '../constants';
import { GLOW_SPRITE } from '../textures/glow-atlas';
import { effectPlacements, type EffectSource } from './effect-sprites';
import { sampleClip } from './motion-clip-player';

const source: EffectSource = { x: 100, y: 0, radius: 20, colour: '#a6f4ff', targetX: 200, targetY: 0 };

describe('effectPlacements', () => {
  it('bursts a level-up into rays, a shock ring and ripples that fade out', () => {
    const atBurst = effectPlacements(MOTION_CLIP.levelUp, source, sampleClip(MOTION_CLIPS.level_up, 250), 250 / 900);
    expect(atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ray)).toHaveLength(LEVEL_UP_RAYS);
    expect(atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ring)).toHaveLength(1 + LEVEL_UP_RIPPLES);
    const atEnd = effectPlacements(MOTION_CLIP.levelUp, source, sampleClip(MOTION_CLIPS.level_up, 900), 1);
    expect(atEnd.every((placement) => placement.alpha === 0)).toBe(true);
  });

  it('blooms a respawn halo at 2 r that fades in over the clip', () => {
    const start = effectPlacements(MOTION_CLIP.respawn, source, sampleClip(MOTION_CLIPS.respawn, 0), 0)[0]!;
    expect(start.widthWu).toBeCloseTo(2 * 20 * 2, 9);
    expect(start.sprite).toBe(GLOW_SPRITE.glow);
    expect(start.colour).toBe(source.colour);
  });

  it('pulses an eat halo to 1.5 R and fades it over the last tween', () => {
    const peak = effectPlacements(MOTION_CLIP.eat, source, sampleClip(MOTION_CLIPS.eat, 160), 160 / 300)[0]!;
    expect(peak.widthWu).toBeCloseTo(1.5 * 20 * 2, 9);
    const end = effectPlacements(MOTION_CLIP.eat, source, sampleClip(MOTION_CLIPS.eat, 300), 1)[0]!;
    expect(end.alpha).toBeCloseTo(0, 9);
  });

  it('streams DNA from a ghost toward its predator once the streams start', () => {
    expect(effectPlacements(MOTION_CLIP.absorbed, source, sampleClip(MOTION_CLIPS.absorbed, 100), 100 / 600)).toEqual(
      [],
    );
    const streams = effectPlacements(MOTION_CLIP.absorbed, source, sampleClip(MOTION_CLIPS.absorbed, 500), 500 / 600);
    expect(streams).toHaveLength(ABSORBED_STREAMS);
    expect(streams[1]!.x).toBeGreaterThan(100);
    expect(streams[1]!.x).toBeLessThan(200);
    expect(
      effectPlacements(
        MOTION_CLIP.absorbed,
        { ...source, targetX: undefined },
        sampleClip(MOTION_CLIPS.absorbed, 500),
        0.8,
      ),
    ).toEqual([]);
    expect(effectPlacements(MOTION_CLIP.sprintReady, source, {}, 0)).toEqual([]);
  });
});
