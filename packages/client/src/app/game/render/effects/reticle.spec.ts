import { describe, expect, it } from 'vitest';
import { RETICLE_DOT_SPACING_PX, RETICLE_LINE_MAX_DOTS, RETICLE_RADIUS_PX } from '../constants';
import { GLOW_SPRITE } from '../textures/glow-atlas';
import { reticlePlacements } from './reticle';

const ownCell = { x: 0, y: 0, radius: 10 };

describe('reticlePlacements', () => {
  it('draws nothing while hidden and only the ring without an own cell', () => {
    expect(reticlePlacements({ isVisible: false, x: 50, y: 0, zoom: 1, ownCell })).toEqual([]);
    const alone = reticlePlacements({ isVisible: true, x: 50, y: 0, zoom: 2, ownCell: null });
    expect(alone).toHaveLength(1);
    expect(alone[0]).toMatchObject({ sprite: GLOW_SPRITE.ring, x: 50, y: 0, widthWu: RETICLE_RADIUS_PX });
  });

  it('dots the line from the cell rim to the ring edge at the px spacing, capped', () => {
    const placements = reticlePlacements({ isVisible: true, x: 100, y: 0, zoom: 1, ownCell });
    const dots = placements.filter((placement) => placement.sprite === GLOW_SPRITE.glow);
    expect(dots).toHaveLength(Math.floor((100 - RETICLE_RADIUS_PX - ownCell.radius) / RETICLE_DOT_SPACING_PX));
    expect(dots[0]!.x).toBe(ownCell.radius);
    expect(dots[1]!.x - dots[0]!.x).toBeCloseTo(RETICLE_DOT_SPACING_PX, 9);
    expect(dots.at(-1)!.x).toBeLessThanOrEqual(100 - RETICLE_RADIUS_PX);
    const far = reticlePlacements({ isVisible: true, x: 100_000, y: 0, zoom: 1, ownCell });
    expect(far).toHaveLength(1 + RETICLE_LINE_MAX_DOTS);
    const touching = reticlePlacements({ isVisible: true, x: 12, y: 0, zoom: 1, ownCell });
    expect(touching).toHaveLength(1);
  });
});
