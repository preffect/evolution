import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, MOTION_CLIPS } from '@evolution/shared';
import { sampleClipTracks } from '../cells/cell-clips';
import { ABSORBED_STREAMS, DNA, DNA_DEEP, LEVEL_GOLD, LEVEL_UP_RAYS, LEVEL_UP_RIPPLES, WHITE } from '../constants';
import { GLOW_SPRITE } from '../textures/glow-atlas';
import { effectPlacements, type EffectSource } from './effect-sprites';

const source: EffectSource = { x: 100, y: 0, radius: 20, colour: '#a6f4ff', target: { x: 200, y: 0 } };
const levelUp = MOTION_CLIPS.level_up;

describe('effectPlacements', () => {
  it('bursts a level-up into gold rays, a white shock ring and fading ripples, all gone at the end', () => {
    const atBurst = effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 250), 250 / 900);
    const rays = atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ray);
    const rings = atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ring);
    expect(rays).toHaveLength(LEVEL_UP_RAYS);
    expect(rays.every((ray) => ray.colour === LEVEL_GOLD)).toBe(true);
    expect(rings).toHaveLength(1 + LEVEL_UP_RIPPLES);
    expect(rings[0]!.colour).toBe(WHITE);
    expect(rings[1]!.alpha).toBeGreaterThan(rings[2]!.alpha);
    expect(rings[1]!.widthWu).toBeGreaterThan(rings[2]!.widthWu);
    // The first ray points along +x from the cell: its centre sits half a length out.
    expect(rays[0]!.x).toBeGreaterThan(source.x);
    expect(rays[0]!.y).toBeCloseTo(0, 9);
    const atEnd = effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 900), 1);
    expect(atEnd.every((placement) => placement.alpha === 0)).toBe(true);
  });

  it('blooms a respawn halo at 2 r in the cell colour that fades over the clip', () => {
    const start = effectPlacements(MOTION_CLIP.respawn, source, sampleClipTracks(MOTION_CLIPS.respawn, 0), 0)[0]!;
    expect(start.widthWu).toBeCloseTo(2 * 20 * 2, 9);
    expect(start.sprite).toBe(GLOW_SPRITE.glow);
    expect(start.colour).toBe(source.colour);
    const late = effectPlacements(MOTION_CLIP.respawn, source, sampleClipTracks(MOTION_CLIPS.respawn, 300), 0.75)[0]!;
    expect(late.alpha).toBeLessThan(start.alpha);
    expect(late.widthWu).toBeLessThan(start.widthWu);
  });

  it('pulses an eat halo to 1.5 r, holds it, then fades it out by the end', () => {
    const peak = effectPlacements(MOTION_CLIP.eat, source, sampleClipTracks(MOTION_CLIPS.eat, 160), 160 / 300)[0]!;
    expect(peak.widthWu).toBeCloseTo(1.5 * 20 * 2, 9);
    expect(peak.alpha).toBeGreaterThan(0);
    const end = effectPlacements(MOTION_CLIP.eat, source, sampleClipTracks(MOTION_CLIPS.eat, 300), 1)[0]!;
    expect(end.alpha).toBeCloseTo(0, 9);
  });

  it('streams DNA from a ghost toward its predator once the streams start, none without a target', () => {
    const early = effectPlacements(MOTION_CLIP.absorbed, source, sampleClipTracks(MOTION_CLIPS.absorbed, 100), 1 / 6);
    expect(early).toEqual([]);
    const streams = effectPlacements(MOTION_CLIP.absorbed, source, sampleClipTracks(MOTION_CLIPS.absorbed, 450), 0.75);
    expect(streams).toHaveLength(ABSORBED_STREAMS);
    expect(streams[1]!.x).toBeGreaterThan(100);
    expect(streams[1]!.x).toBeLessThan(200);
    expect(streams[1]!.colour).toBe(DNA);
    expect(streams[0]!.colour).toBe(DNA_DEEP);
    expect(streams[0]!.y).toBeLessThan(0);
    expect(streams[2]!.y).toBeGreaterThan(0);
    const orphan = { ...source, target: null };
    expect(effectPlacements(MOTION_CLIP.absorbed, orphan, sampleClipTracks(MOTION_CLIPS.absorbed, 500), 0.8)).toEqual(
      [],
    );
    expect(effectPlacements(MOTION_CLIP.sprintReady, source, {}, 0)).toEqual([]);
  });
});
