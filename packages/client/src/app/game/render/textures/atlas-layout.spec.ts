import { describe, expect, it } from 'vitest';
import { ATLAS_PADDING_PX } from '../constants';
import { layoutAtlas, type AtlasFrame } from './atlas-layout';

function overlaps(first: AtlasFrame, second: AtlasFrame): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

describe('layoutAtlas', () => {
  const sizes = {
    tall: { width: 10, height: 40 },
    wide: { width: 60, height: 12 },
    small: { width: 8, height: 8 },
    other: { width: 8, height: 8 },
  } as const;

  it('keeps every sprite inside the atlas, padded from its neighbours and the edges', () => {
    const layout = layoutAtlas(sizes);
    const frames = Object.values(layout.frames);
    for (const frame of frames) {
      expect(frame.x).toBeGreaterThanOrEqual(ATLAS_PADDING_PX);
      expect(frame.y).toBeGreaterThanOrEqual(ATLAS_PADDING_PX);
      expect(frame.x + frame.width + ATLAS_PADDING_PX).toBeLessThanOrEqual(layout.width);
      expect(frame.y + frame.height + ATLAS_PADDING_PX).toBeLessThanOrEqual(layout.height);
    }
    for (const first of frames) {
      for (const second of frames) {
        if (first === second) continue;
        const padded = { ...first, width: first.width + ATLAS_PADDING_PX, height: first.height + ATLAS_PADDING_PX };
        expect(overlaps(padded, second)).toBe(false);
      }
    }
    expect(layout.frames.wide).toMatchObject({ width: 60, height: 12 });
  });

  it('packs tallest first and deterministically, wrapping onto a new shelf past the width', () => {
    const layout = layoutAtlas(sizes, 0);
    expect(layout.frames.tall).toMatchObject({ x: 0, y: 0 });
    expect(layoutAtlas(sizes, 0)).toEqual(layout);
    const shelves = new Set(Object.values(layout.frames).map((frame) => frame.y));
    expect(shelves.size).toBeGreaterThan(1);
    expect(layout.width).toBeGreaterThanOrEqual(60);
  });

  it('never packs narrower than the widest sprite', () => {
    const layout = layoutAtlas({ banner: { width: 200, height: 2 }, dot: { width: 1, height: 1 } }, 1);
    expect(layout.width).toBe(202);
    expect(layout.frames.dot.y).toBeGreaterThan(layout.frames.banner.y);
  });
});
