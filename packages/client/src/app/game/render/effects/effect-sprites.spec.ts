import { describe, expect, it } from 'vitest';
import { MOTION_CLIP, MOTION_CLIPS } from '@evolution/shared';
import { sampleClipTracks } from '../cells/cell-clips';
import {
  ABSORBED_STREAMS,
  DNA,
  DNA_DEEP,
  EAT_HALO_ALPHA,
  EAT_HALO_RING_ALPHA,
  LEVEL_GOLD,
  LEVEL_UP_RAYS,
  LEVEL_UP_RAY_BASE_RADII,
  LEVEL_UP_RIPPLE_RADII,
  LEVEL_UP_RIPPLES,
  WHITE,
} from '../constants';
import { GLOW_SPRITE } from '../textures/glow-atlas';
import { effectPlacements, type EffectSource } from './effect-sprites';

const source: EffectSource = { x: 100, y: 0, radius: 20, colour: '#a6f4ff', target: { x: 200, y: 0 } };
const levelUp = MOTION_CLIPS.level_up;

describe('effectPlacements', () => {
  it('shows nothing of the burst through the anticipate frame (sheet 03 strip C: a bare squash)', () => {
    expect(effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 0), 0)).toEqual([]);
    expect(effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 120), 120 / 900)).toEqual([]);
    expect(effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 249), 249 / 900)).toEqual([]);
  });

  it('bursts at 250 ms into gold rays outside the body, a white shock ring and three concentric ripples', () => {
    const atBurst = effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 250), 250 / 900);
    const rays = atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ray);
    const rings = atBurst.filter((placement) => placement.sprite === GLOW_SPRITE.ring);
    expect(rays).toHaveLength(LEVEL_UP_RAYS);
    expect(rays.every((ray) => ray.colour === LEVEL_GOLD && ray.alpha === 1)).toBe(true);
    expect(rings).toHaveLength(1 + LEVEL_UP_RIPPLES);
    expect(rings[0]!.colour).toBe(WHITE);
    // The ripples sit at 1.7 / 2.1 / 2.5 r (diameters), fading outward; the falloff never shrinks them.
    expect(rings.slice(1).map((ring) => ring.widthWu / (2 * source.radius))).toEqual([...LEVEL_UP_RIPPLE_RADII]);
    expect(rings[1]!.alpha).toBeGreaterThan(rings[2]!.alpha);
    expect(rings[2]!.alpha).toBeGreaterThan(rings[3]!.alpha);
  });

  it('keeps the rays outside the body: base at the rim, tip on the rayRadii track, gone at the end', () => {
    const atNucleus = effectPlacements(MOTION_CLIP.levelUp, source, sampleClipTracks(levelUp, 450), 450 / 900);
    const ray = atNucleus.find((placement) => placement.sprite === GLOW_SPRITE.ray)!;
    const tipRadii = sampleClipTracks(levelUp, 450)['rayRadii']!;
    const innerEnd = (ray.x - source.x - ray.heightWu / 2) / source.radius;
    const outerEnd = (ray.x - source.x + ray.heightWu / 2) / source.radius;
    expect(innerEnd).toBeCloseTo(LEVEL_UP_RAY_BASE_RADII, 9);
    expect(outerEnd).toBeCloseTo(tipRadii, 9);
    expect(ray.y).toBeCloseTo(0, 9);
    expect(ray.alpha).toBeLessThan(1);
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

  it('pulses an eat halo to 1.5 r: a glow and a ring at the pulse, the ring alone fading out at settle', () => {
    const peak = effectPlacements(MOTION_CLIP.eat, source, sampleClipTracks(MOTION_CLIPS.eat, 160), 160 / 300);
    expect(peak.map((placement) => placement.sprite)).toEqual([GLOW_SPRITE.glow, GLOW_SPRITE.ring]);
    expect(peak[0]).toMatchObject({ widthWu: 1.5 * 20 * 2, alpha: EAT_HALO_ALPHA, colour: source.colour });
    expect(peak[1]).toMatchObject({ widthWu: 1.5 * 20 * 2, alpha: EAT_HALO_RING_ALPHA });
    expect(EAT_HALO_RING_ALPHA).toBeGreaterThanOrEqual(0.5);
    const settle = effectPlacements(MOTION_CLIP.eat, source, sampleClipTracks(MOTION_CLIPS.eat, 250), 250 / 300);
    expect(settle).toHaveLength(1);
    expect(settle[0]!.sprite).toBe(GLOW_SPRITE.ring);
    expect(settle[0]!.alpha).toBeGreaterThan(0);
    expect(settle[0]!.alpha).toBeLessThan(EAT_HALO_RING_ALPHA);
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
