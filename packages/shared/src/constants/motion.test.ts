// docs/RENDERING.md §9: one snapshot per clip; durations and keyframe times equal sheet 03's; every
// pulse ≤ 1.14; tracks are monotonic in `at`; every easing is an EasingName; the server never imports
// the file and `balance.json` carries no key from it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EASING_NAMES,
  MOTION_CLIP,
  MOTION_CLIPS,
  MOTION_DOMAIN,
  MOTION_PULSE_MAX,
  sampleTrack,
  type EasingName,
  type MotionClip,
} from './motion.js';

const SERVER_SOURCE_DIR = new URL('../../../server/src', import.meta.url).pathname;
const BALANCE_FILE = new URL('../../../../data/balance.json', import.meta.url);

/** Sheet 03's strips table plus VISUAL-STYLE §5: clip → [domain, duration, keyframe times]. */
const SHEET_03 = {
  [MOTION_CLIP.eat]: { domain: MOTION_DOMAIN.milliseconds, duration: 300, at: [0, 100, 160, 220, 300] },
  [MOTION_CLIP.engulf]: { domain: MOTION_DOMAIN.progress, duration: 1, at: [0, 0.5, 1] },
  [MOTION_CLIP.absorbed]: { domain: MOTION_DOMAIN.milliseconds, duration: 600, at: [0, 200, 400, 600] },
  [MOTION_CLIP.levelUp]: { domain: MOTION_DOMAIN.milliseconds, duration: 900, at: [0, 120, 250, 450, 700, 900] },
  [MOTION_CLIP.respawn]: { domain: MOTION_DOMAIN.milliseconds, duration: 400, at: [0, 400] },
  [MOTION_CLIP.sprintRelease]: { domain: MOTION_DOMAIN.milliseconds, duration: 200, at: [0, 200] },
  [MOTION_CLIP.organelleBirth]: { domain: MOTION_DOMAIN.milliseconds, duration: 3000, at: [0, 3000] },
} as const;

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return listTypeScriptFiles(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

const linear = (_name: EasingName, x: number): number => x;

describe('MOTION_CLIPS', () => {
  const clips = Object.values(MOTION_CLIPS);

  it('declares exactly the clips of MOTION_CLIP', () => {
    expect(Object.keys(MOTION_CLIPS).sort()).toEqual(Object.values(MOTION_CLIP).sort());
    for (const clip of clips) expect(MOTION_CLIPS[clip.id]).toBe(clip);
  });

  it.each(Object.entries(SHEET_03))('%s has sheet 03 domain, duration and keyframe times', (id, sheet) => {
    const clip = MOTION_CLIPS[id as MotionClip['id']];
    expect(clip.domain).toBe(sheet.domain);
    expect(clip.duration).toBe(sheet.duration);
    for (const track of Object.values(clip.tracks)) {
      expect(track.map((keyframe) => keyframe.at)).toEqual(sheet.at);
    }
  });

  it('keeps every pulse keyframe within the sheet 03 pulse cap', () => {
    for (const clip of clips) {
      for (const keyframe of clip.tracks['pulse'] ?? []) expect(keyframe.value).toBeLessThanOrEqual(MOTION_PULSE_MAX);
    }
  });

  it('uses only EasingName easings and strictly increasing keyframe times', () => {
    const tracks = clips.flatMap((clip) => Object.values(clip.tracks));
    for (const track of tracks) {
      track.forEach((keyframe, index) => {
        expect(EASING_NAMES).toContain(keyframe.easingTo);
        if (index > 0) expect(keyframe.at).toBeGreaterThan(track[index - 1]!.at);
      });
    }
  });

  it('pins the engulf amplitudes and the absorbed seal relax of RENDERING §4', () => {
    const engulf = MOTION_CLIPS.engulf.tracks;
    expect(engulf['arm']!.map((keyframe) => keyframe.value)).toEqual([0, 0.62, 0]);
    expect(engulf['notch']!.map((keyframe) => keyframe.value)).toEqual([0, -0.1, 0]);
    expect(engulf['seal']!.map((keyframe) => keyframe.value)).toEqual([0, 0, 0.6]);
    expect(MOTION_CLIPS.absorbed.tracks['seal']!.map((keyframe) => keyframe.value)).toEqual([0.6, 0.42, 0.22, 0]);
    expect(MOTION_CLIPS.level_up.isInterruptible).toBe(false);
    expect(MOTION_CLIPS.eat.isInterruptible).toBe(true);
  });

  it('is never imported by the server', () => {
    const files = listTypeScriptFiles(SERVER_SOURCE_DIR);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/constants\/motion|MOTION_CLIPS/);
    }
  });

  it('contributes no key to balance.json', () => {
    const balance = readFileSync(BALANCE_FILE, 'utf8');
    expect(balance).not.toContain('MOTION_CLIPS');
    expect(balance).not.toContain('MOTION_PULSE_MAX');
  });
});

describe('sampleTrack', () => {
  const track = MOTION_CLIPS.eat.tracks['pulse']!;

  it('holds the first and last values outside the track', () => {
    expect(sampleTrack(track, -10, linear)).toBe(1);
    expect(sampleTrack(track, 1000, linear)).toBe(1);
  });

  it('tweens between the bracketing keyframes through the easing', () => {
    expect(sampleTrack(track, 130, linear)).toBeCloseTo(1.045, 6);
    const halfEase = (_name: EasingName, x: number) => x * x;
    expect(sampleTrack(track, 130, halfEase)).toBeCloseTo(1 + 0.09 * 0.25, 6);
  });

  it('returns exactly a keyframe value at its time and 0 for an empty track', () => {
    expect(sampleTrack(track, 160, linear)).toBe(1.09);
    expect(sampleTrack([], 5, linear)).toBe(0);
  });
});
